/**
 * Google Chat admin notifications.
 *
 * Webhook URL is read from Firebase Secret Manager:
 * GOOGLE_CHAT_WEBHOOK_URL
 *
 * Best-effort only: notification failure must never block user requests.
 */

import * as logger from 'firebase-functions/logger';
import type {AlertCard} from './notify-line';

const STATUS_META = {
  started: {emoji: '🔵', label: '開始', color: '#3B82F6'},
  success: {emoji: '✅', label: '成功', color: '#16A34A'},
  failed: {emoji: '❌', label: '失敗', color: '#DC2626'},
  warning: {emoji: '⚠️', label: '注意', color: '#D97706'},
} as const;

const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;
const FAIL_BACKOFF_MS = 10 * 60 * 1000;
const lastSentByKey = new Map<string, number>();

function shouldSend(dedupeKey: string): boolean {
  const last = lastSentByKey.get(dedupeKey);
  if (last && Date.now() - last < DEDUPE_WINDOW_MS) return false;
  if (lastSentByKey.size > 100) {
    const cutoff = Date.now() - DEDUPE_WINDOW_MS * 2;
    for (const [key, time] of lastSentByKey.entries()) {
      if (time < cutoff) lastSentByKey.delete(key);
    }
  }
  return true;
}

function markSent(dedupeKey: string, success: boolean) {
  lastSentByKey.set(
    dedupeKey,
    success ? Date.now() : Date.now() - (DEDUPE_WINDOW_MS - FAIL_BACKOFF_MS)
  );
}

function taipeiTime(): string {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

function progressText(progress: AlertCard['progress']): string {
  if (!progress) return '';
  const pct = Math.round((progress.current / progress.total) * 100);
  return `${progress.label || '進度'}：${progress.current} / ${progress.total}（${pct}%）`;
}

function cardToText(card: AlertCard): string {
  const meta = STATUS_META[card.status];
  const lines = [
    `${meta.emoji} ${card.title}`,
    `狀態：${meta.label}`,
    `時間：${taipeiTime()}`,
  ];
  if (card.hero) lines.push(`摘要：${card.hero}`);
  for (const field of card.fields) {
    lines.push(`${field.icon || ''} ${field.label}：${field.value || '—'}`);
  }
  if (card.progress) lines.push(progressText(card.progress));
  if (card.footerNote) lines.push(`備註：${card.footerNote}`);
  return lines.join('\n').slice(0, 4000);
}

function buildCardsV2(card: AlertCard) {
  const meta = STATUS_META[card.status];
  const widgets: any[] = [
    {
      decoratedText: {
        topLabel: '狀態',
        text: `<font color="${meta.color}"><b>${meta.label}</b></font>`,
      },
    },
    {
      decoratedText: {
        topLabel: '時間',
        text: taipeiTime(),
      },
    },
  ];

  if (card.hero) {
    widgets.push({
      textParagraph: {
        text: `<b>${escapeCardText(card.hero)}</b>`,
      },
    });
  }

  for (const field of card.fields) {
    widgets.push({
      decoratedText: {
        topLabel: `${field.icon ? `${field.icon} ` : ''}${escapeCardText(field.label)}`,
        text: escapeCardText(field.value || '—'),
        wrapText: true,
      },
    });
  }

  if (card.progress) {
    widgets.push({
      decoratedText: {
        topLabel: card.progress.label || '進度',
        text: progressText(card.progress),
        wrapText: true,
      },
    });
  }

  if (card.footerNote) {
    widgets.push({
      decoratedText: {
        topLabel: '備註',
        text: escapeCardText(card.footerNote),
        wrapText: true,
      },
    });
  }

  return [
    {
      cardId: `photopoet-${card.status}`,
      card: {
        header: {
          title: `${meta.emoji} ${card.title}`,
          subtitle: 'PhotoPoet 即時通知',
        },
        sections: [{widgets}],
      },
    },
  ];
}

function escapeCardText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function notifyGoogleChat(card: AlertCard): Promise<void> {
  const webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    logger.debug('[notify-google-chat] secret not configured, skip');
    return;
  }

  if (!shouldSend(card.dedupeKey)) {
    logger.debug('[notify-google-chat] deduped', {dedupeKey: card.dedupeKey});
    return;
  }

  let pushSucceeded = false;
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {'Content-Type': 'application/json; charset=utf-8'},
      body: JSON.stringify({
        text: cardToText(card),
        cardsV2: buildCardsV2(card),
      }),
    });

    if (res.ok) {
      pushSucceeded = true;
    } else {
      logger.warn('[notify-google-chat] webhook failed', {
        status: res.status,
        body: (await res.text()).slice(0, 300),
      });
    }
  } catch (err: any) {
    logger.warn('[notify-google-chat] push failed', {msg: err?.message});
  } finally {
    markSent(card.dedupeKey, pushSucceeded);
  }
}
