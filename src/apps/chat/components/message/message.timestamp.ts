import type { DMessage } from '~/common/stores/chat/chat.message';

export type MessageTimestampSource = Pick<DMessage, 'role' | 'created' | 'updated' | 'generator' | 'pendingIncomplete'>;

/** Generation end is independent of edits. Older messages only have creation/update times. */
export function getMessageTimestamp(message: MessageTimestampSource) {
  if (message.pendingIncomplete || (message.role !== 'user' && message.role !== 'assistant')) return null;

  const { generator } = message;
  const fromUser = message.role === 'user';
  const endedAt = generator?.endedAt;
  const hasEnd = endedAt !== undefined && Number.isFinite(endedAt) && endedAt > 0;
  const at = fromUser ? message.created : hasEnd ? endedAt : message.updated || message.created;
  if (!Number.isFinite(at) || at <= 0) return null;

  const completionLabel = generator?.tokenStopReason === 'client-abort' ? 'Stopped'
    : generator?.tokenStopReason === 'issue' ? 'Failed'
      : generator?.tokenStopReason || generator?.metrics?.TsR ? 'Interrupted'
        : 'Done';
  const label = fromUser ? 'Sent' : hasEnd ? completionLabel : message.updated ? 'Updated' : 'Created';
  const duration = fromUser ? undefined : generator?.metrics?.dtWall ?? generator?.metrics?.dtAll;
  const durationMs = duration !== undefined && Number.isFinite(duration) && duration > 0 ? duration : undefined;
  return { at, label, durationMs };
}

/** Local calendar days, rather than elapsed 24-hour periods, keep midnight and DST correct. */
export function formatMessageTimestampDate(at: number, now: number, locale?: string): string {
  const date = new Date(at);
  const today = new Date(now);
  const calendarDay = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const daysAgo = (calendarDay(today) - calendarDay(date)) / 86_400_000;
  const time = date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });

  if (daysAgo === 0) return `at ${time}`;
  if (daysAgo === 1) return `yesterday at ${time}`;
  if (daysAgo > 1 && daysAgo < 7) return `${date.toLocaleDateString(locale, { weekday: 'long' })} at ${time}`;

  const day = date.toLocaleDateString(locale, {
    weekday: 'long', month: 'short', day: 'numeric',
    ...(date.getFullYear() !== today.getFullYear() && { year: 'numeric' }),
  });
  return `${day}, ${time}`;
}
