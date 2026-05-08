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
  started: {headerBg: '#3B82F6', headerSubColor: '#DBEAFE', icon: '🆕'},
  success: {headerBg: '#10B981', headerSubColor: '#D1FAE5', icon: '✅'},
  failed: {headerBg: '#EF4444', headerSubColor: '#FEE2E2', icon: '❌'},
  warning: {headerBg: '#F59E0B', headerSubColor: '#FEF3C7', icon: '⚠️'},
} as const;

export type AlertStatus = keyof typeof CARD_THEMES;

export interface AlertCard {
  status: AlertStatus;
  /** dedupe key — 同 key 在 dedupeWindowMs 內只推 1 次 */
  dedupeKey: string;
  title: string;
  fields: Array<{icon?: string; label: string; value: string}>;
  footerNote?: string;
}

const DEDUPE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const lastSentByKey = new Map<string, number>();

function shouldSend(dedupeKey: string): boolean {
  const last = lastSentByKey.get(dedupeKey);
  if (last && Date.now() - last < DEDUPE_WINDOW_MS) return false;
  lastSentByKey.set(dedupeKey, Date.now());
  // 順手清理舊 entries（避免 instance 跑很久 map 變大）
  if (lastSentByKey.size > 100) {
    const cutoff = Date.now() - DEDUPE_WINDOW_MS * 2;
    for (const [k, t] of lastSentByKey.entries()) {
      if (t < cutoff) lastSentByKey.delete(k);
    }
  }
  return true;
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

    if (res.ok) return;

    const status = res.status;
    if (status === 429) {
      logger.warn('[notify-line] LINE monthly quota exhausted (429)');
      return;
    }
    // 雷 #9：Flex 失敗自動降級純文字
    logger.warn('[notify-line] flex failed, falling back to text', {status});
    await fetch(LINE_PUSH_API, {
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
  } catch (err: any) {
    logger.warn('[notify-line] push failed', {msg: err?.message});
  }
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

  return {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: theme.headerBg,
      paddingAll: '16px',
      contents: [
        {
          type: 'text',
          text: `${theme.icon}  ${card.title}`,
          color: '#FFFFFF',
          weight: 'bold',
          size: 'md',
          wrap: true,
        },
        {
          type: 'text',
          text: 'PhotoPoet · 點亮詩意',
          color: theme.headerSubColor,
          size: 'xs',
          margin: 'sm',
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      paddingAll: '16px',
      contents: card.fields.map(f => ({
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          {
            type: 'text',
            text: `${f.icon ? f.icon + ' ' : ''}${f.label}`,
            color: '#888888',
            size: 'sm',
            flex: 3,
          },
          {
            type: 'text',
            text: f.value || '—',
            color: '#1E293B',
            size: 'sm',
            flex: 7,
            wrap: true,
          },
        ],
      })),
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '12px',
      contents: [
        {
          type: 'text',
          text: card.footerNote ? `${now} · ${card.footerNote}` : now,
          color: '#94A3B8',
          size: 'xxs',
          align: 'end',
          wrap: true,
        },
      ],
    },
  };
}

function cardToPlainText(card: AlertCard): string {
  const theme = CARD_THEMES[card.status];
  return [
    `${theme.icon} ${card.title}`,
    '(PhotoPoet · 點亮詩意)',
    '',
    ...card.fields.map(f => `${f.icon || ''} ${f.label}：${f.value || '—'}`),
    card.footerNote ? `\n${card.footerNote}` : '',
  ]
    .filter(Boolean)
    .join('\n')
    .substring(0, 4900);
}
