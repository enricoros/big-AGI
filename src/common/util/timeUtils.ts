export function prettyTimestampForFilenames(useSeconds: boolean = true) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0'); // JavaScript months are 0-based.
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}-${hour}${minute}${useSeconds ? second : ''}`; // YYYY-MM-DD_HHMM[SS] format
}

/**
 * Creates a time bucket classifier with precomputed calendar boundaries.
 * Buckets: Today, Yesterday, This Week, This Month, Last Month, Older
 * Call once, then use returned function for each item - avoids redundant Date computations.
 */
export function createTimeBucketClassifierEn() {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth();
  const todayMs = new Date(y, m, now.getDate()).getTime();
  const DAY_MS = 86400000;
  const yesterdayMs = todayMs - DAY_MS;
  // Week starts Monday (ISO 8601) - locale-aware: new Intl.Locale(navigator.language).getWeekInfo?.().firstDay
  const weekStartMs = todayMs - ((now.getDay() + 6) % 7) * DAY_MS;
  const monthStartMs = new Date(y, m, 1).getTime();
  const lastMonthStartMs = new Date(y, m - 1, 1).getTime();

  return (itemTimestamp: number): string => {
    const t = new Date(itemTimestamp).setHours(0, 0, 0, 0);
    if (t >= todayMs) return 'Today';
    if (t >= yesterdayMs) return 'Yesterday';
    if (t >= weekStartMs) return 'This Week';
    if (t >= monthStartMs) return 'This Month';
    if (t >= lastMonthStartMs) return 'Last Month';
    return 'Older';
  };
}