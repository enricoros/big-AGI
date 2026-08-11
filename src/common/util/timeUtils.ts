/** Formats an elapsed duration: '42s' ('42.3s' with decimalSeconds), '2m 34s', '1h 5m'; zero components are elided. */
export function prettyDuration(ms: number, decimalSeconds: boolean = false): string {
  if (decimalSeconds) {
    const tenths = Math.round(ms / 100);
    if (tenths < 600)
      return `${(tenths / 10).toLocaleString()}s`;
  }
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60)
    return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60)
    return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return remMinutes ? `${hours}h ${remMinutes}m` : `${hours}h`;
}

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

// Rolling windows vs Explorer-style calendar ladder; both starve downward, empty groups don't render
const UNANCHORED_TIME = true;

/**
 * Creates a time bucket classifier with precomputed boundaries.
 * Unanchored: Today, Yesterday, Past Week/Month/3 Months, Older.
 * Anchored: Today, Yesterday, This/Last Week, Earlier This Month, Last Month, Earlier This Year, per-year.
 * Call once, then use returned function for each item - avoids redundant Date computations.
 */
export function createTimeBucketClassifierEn() {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth();
  const todayMs = new Date(y, m, now.getDate()).getTime();
  const DAY_MS = 86400000;
  const yesterdayMs = todayMs - DAY_MS;

  if (UNANCHORED_TIME) {
    const pastWeekMs = todayMs - 7 * DAY_MS;
    const pastMonthMs = todayMs - 30 * DAY_MS;
    const past3MonthsMs = todayMs - 90 * DAY_MS;

    return (itemTimestamp: number): string => {
      const t = new Date(itemTimestamp).setHours(0, 0, 0, 0);
      if (t >= todayMs) return 'Today';
      if (t >= yesterdayMs) return 'Yesterday';
      if (t >= pastWeekMs) return 'Past Week';
      if (t >= pastMonthMs) return 'Past Month';
      if (t >= past3MonthsMs) return 'Past 3 Months';
      return 'Older';
    };
  }

  // Week starts Monday (ISO 8601) - locale-aware: new Intl.Locale(navigator.language).getWeekInfo?.().firstDay
  const weekStartMs = todayMs - ((now.getDay() + 6) % 7) * DAY_MS;
  const lastWeekStartMs = weekStartMs - 7 * DAY_MS;
  const monthStartMs = new Date(y, m, 1).getTime();
  const lastMonthStartMs = new Date(y, m - 1, 1).getTime();
  const yearStartMs = new Date(y, 0, 1).getTime();

  return (itemTimestamp: number): string => {
    const t = new Date(itemTimestamp).setHours(0, 0, 0, 0);
    if (t >= todayMs) return 'Today';
    if (t >= yesterdayMs) return 'Yesterday';
    if (t >= weekStartMs) return 'This Week';
    if (t >= lastWeekStartMs) return 'Last Week';
    if (t >= monthStartMs) return 'Earlier This Month';
    if (t >= lastMonthStartMs) return 'Last Month';
    if (t >= yearStartMs) return 'Earlier This Year';
    return String(new Date(t).getFullYear());
  };
}