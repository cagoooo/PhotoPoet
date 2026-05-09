/**
 * LINE 管理員告警 — 純 Push 模式（不接 webhook）。
 *
 * - Token / userId 取自 Firebase Secret Manager (PHOTOPOET_LINE_*)
 * - Flex Message 卡片 + 純文字 fallback（雷 #9 Flex 失敗自動降級）
 * - In-memory dedupe：同類 error 1 小時內只推 1 次（cold start 會 reset，
 *   重新部署後第一次仍會推 — 對告警場景來說是好事）
 * - 永遠 best-effort：notify 失敗絕不影響主請求
 *
 * 月額度提醒：LINE 免費 channel 每月 200 條，多專案共用同一 channel 時
 * 容易爆。爆了會 429 但不影響服務。
 */

import * as logger from 'firebase-functions/logger';

const LINE_PUSH_API = 'https://api.line.me/v2/bot/message/push';

const CARD_THEMES = {
  // PhotoPoet 主色：紫粉漸層的兩極（LINE Flex 不支援漸層，取其代表紫色）
  started: {headerBg: '#3B82F6', headerSubColor: '#DBEAFE', icon: '🆕', accent: '#3B82F6'},
  success: {headerBg: '#7C3AED', headerSubColor: '#E9D5FF', icon: '✨', accent: '#EC4899'},
  failed: {headerBg: '#EF4444', headerSubColor: '#FEE2E2', icon: '❌', accent: '#DC2626'},
  warning: {headerBg: '#F59E0B', headerSubColor: '#FEF3C7', icon: '⚠️', accent: '#D97706'},
} as const;

export type AlertStatus = keyof typeof CARD_THEMES;

export interface AlertCard {
  status: AlertStatus;
  /** dedupe key — 同 key 在 dedupeWindowMs 內只推 1 次 */
  dedupeKey: string;
  title: string;
  /** 主要顯示用大字突出（卡片正中央），通常是使用者名或重點 */
  hero?: string;
  /** 進度顯示，會渲染成 emoji bar：current / total */
  progress?: {current: number; total: number; label?: string};
  fields: Array<{icon?: string; label: string; value: string}>;
  footerNote?: string;
}

const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours for successful sends
const FAIL_BACKOFF_MS = 10 * 60 * 1000; // 10 min before retry on failed push (429 等)
const lastSentByKey = new Map<string, number>();

function shouldSend(dedupeKey: string): boolean {
  const last = lastSentByKey.get(dedupeKey);
  if (last && Date.now() - last < DEDUPE_WINDOW_MS) return false;
  // 順手清理舊 entries（避免 instance 跑很久 map 變大）
  if (lastSentByKey.size > 100) {
    const cutoff = Date.now() - DEDUPE_WINDOW_MS * 2;
    for (const [k, t] of lastSentByKey.entries()) {
      if (t < cutoff) lastSentByKey.delete(k);
    }
  }
  return true;
}

/**
 * 推送結果 → 更新 dedupe map：
 *   • success → 標記為 now，下次要等 DEDUPE_WINDOW_MS (24h) 才能再推
 *   • failed  → 標記為「已過大半時間」，FAIL_BACKOFF_MS (10 min) 後可重試
 *     避免 LINE 月額度滿 / network blip 時把今天的「使用者活躍」通知卡死
 */
function markSent(dedupeKey: string, success: boolean) {
  if (success) {
    lastSentByKey.set(dedupeKey, Date.now());
  } else {
    // shouldSend 條件: now - last >= DEDUPE_WINDOW_MS
    // 我們希望 FAIL_BACKOFF_MS 後即可重試 → 設 last = now - (DEDUPE_WINDOW_MS - FAIL_BACKOFF_MS)
    lastSentByKey.set(dedupeKey, Date.now() - (DEDUPE_WINDOW_MS - FAIL_BACKOFF_MS));
  }
}

export async function notifyAdmin(card: AlertCard): Promise<void> {
  const token = process.env.PHOTOPOET_LINE_CHANNEL_ACCESS_TOKEN?.trim();
  const userId = process.env.PHOTOPOET_LINE_ADMIN_USER_ID?.trim();
  if (!token || !userId) {
    logger.debug('[notify-line] secrets not configured, skip');
    return;
  }
  if (!shouldSend(card.dedupeKey)) {
    logger.debug('[notify-line] deduped', {dedupeKey: card.dedupeKey});
    return;
  }

  const flex = buildFlexBubble(card);
  const altText = `${CARD_THEMES[card.status].icon} ${card.title}`;

  let pushSucceeded = false;
  try {
    const res = await fetch(LINE_PUSH_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: userId,
        messages: [{type: 'flex', altText, contents: flex}],
      }),
    });

    if (res.ok) {
      pushSucceeded = true;
    } else if (res.status === 429) {
      logger.warn('[notify-line] LINE monthly quota exhausted (429)');
    } else {
      // 雷 #9：Flex 失敗自動降級純文字
      logger.warn('[notify-line] flex failed, falling back to text', {status: res.status});
      const fb = await fetch(LINE_PUSH_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          to: userId,
          messages: [{type: 'text', text: cardToPlainText(card)}],
        }),
      });
      if (fb.ok) pushSucceeded = true;
    }
  } catch (err: any) {
    logger.warn('[notify-line] push failed', {msg: err?.message});
  } finally {
    markSent(card.dedupeKey, pushSucceeded);
  }
}

/** 把 5/20 渲染成 emoji bar：●●●●●○○○○○ */
function progressBar(current: number, total: number, slots = 10): string {
  const filled = Math.max(0, Math.min(slots, Math.round((current / total) * slots)));
  return '●'.repeat(filled) + '○'.repeat(slots - filled);
}

function buildFlexBubble(card: AlertCard) {
  const theme = CARD_THEMES[card.status];
  const now = new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());

  const bodyContents: any[] = [];

  // Hero：主要強調的字（如使用者名）— 大字置中
  if (card.hero) {
    bodyContents.push({
      type: 'box',
      layout: 'vertical',
      paddingAll: 'sm',
      contents: [
        {
          type: 'text',
          text: card.hero,
          weight: 'bold',
          size: 'xl',
          color: theme.accent,
          align: 'center',
          wrap: true,
        },
      ],
    });
    bodyContents.push({
      type: 'separator',
      color: '#E5E7EB',
      margin: 'md',
    });
  }

  // 一般 fields：icon + label : value
  if (card.fields && card.fields.length > 0) {
    bodyContents.push({
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      margin: 'md',
      contents: card.fields.map(f => ({
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          {
            type: 'text',
            text: `${f.icon ? f.icon + '  ' : ''}${f.label}`,
            color: '#6B7280',
            size: 'sm',
            flex: 4,
          },
          {
            type: 'text',
            text: f.value || '—',
            color: '#111827',
            size: 'sm',
            weight: 'bold',
            flex: 6,
            wrap: true,
            align: 'end',
          },
        ],
      })),
    });
  }

  // Progress bar (emoji)
  if (card.progress) {
    const {current, total, label} = card.progress;
    const pct = Math.round((current / total) * 100);
    bodyContents.push({
      type: 'separator',
      color: '#E5E7EB',
      margin: 'md',
    });
    bodyContents.push({
      type: 'box',
      layout: 'vertical',
      spacing: 'xs',
      margin: 'md',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'text',
              text: label || '今日進度',
              color: '#6B7280',
              size: 'sm',
              flex: 5,
            },
            {
              type: 'text',
              text: `${current} / ${total}（${pct}%）`,
              color: theme.accent,
              size: 'sm',
              weight: 'bold',
              flex: 5,
              align: 'end',
            },
          ],
        },
        {
          type: 'text',
          text: progressBar(current, total),
          color: theme.accent,
          size: 'md',
          align: 'center',
          margin: 'sm',
        },
      ],
    });
  }

  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: theme.headerBg,
      paddingAll: '20px',
      paddingBottom: '16px',
      contents: [
        {
          type: 'text',
          text: theme.icon + '  ' + card.title,
          color: '#FFFFFF',
          weight: 'bold',
          size: 'lg',
          wrap: true,
        },
        {
          type: 'text',
          text: 'PhotoPoet Pro · 點亮詩意',
          color: theme.headerSubColor,
          size: 'xs',
          margin: 'sm',
          weight: 'bold',
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '20px',
      paddingTop: '16px',
      backgroundColor: '#FAFAFA',
      contents: bodyContents,
    },
    footer: {
      type: 'box',
      layout: 'horizontal',
      paddingAll: '12px',
      paddingTop: '8px',
      backgroundColor: '#FFFFFF',
      borderColor: '#E5E7EB',
      borderWidth: 'light',
      contents: [
        {
          type: 'text',
          text: now,
          color: '#9CA3AF',
          size: 'xxs',
          flex: 4,
        },
        {
          type: 'text',
          text: card.footerNote || '✨',
          color: '#9CA3AF',
          size: 'xxs',
          flex: 6,
          align: 'end',
          wrap: true,
        },
      ],
    },
  };
}

function cardToPlainText(card: AlertCard): string {
  const theme = CARD_THEMES[card.status];
  const lines: string[] = [
    `${theme.icon} ${card.title}`,
    '(PhotoPoet Pro · 點亮詩意)',
    '',
  ];
  if (card.hero) {
    lines.push(`▸ ${card.hero}`);
    lines.push('');
  }
  for (const f of card.fields) {
    lines.push(`${f.icon || ''} ${f.label}：${f.value || '—'}`);
  }
  if (card.progress) {
    const {current, total, label} = card.progress;
    const pct = Math.round((current / total) * 100);
    lines.push('');
    lines.push(`📊 ${label || '今日進度'}：${current} / ${total}（${pct}%）`);
    lines.push(progressBar(current, total));
  }
  if (card.footerNote) {
    lines.push('');
    lines.push(card.footerNote);
  }
  return lines.join('\n').substring(0, 4900);
}
