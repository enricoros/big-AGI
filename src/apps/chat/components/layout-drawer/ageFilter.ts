// pure logic for the drawer "Older than" filter - import-free for tsx --test

export const AGE_FILTER_OPTIONS: { days: number | null; label: string; shortLabel: string }[] = [
  { days: null, label: 'Any age', shortLabel: 'Any' },
  { days: 7, label: 'Older than 1 week', shortLabel: '>1w' },
  { days: 14, label: 'Older than 2 weeks', shortLabel: '>2w' },
  { days: 30, label: 'Older than 1 month', shortLabel: '>1m' },
  { days: 90, label: 'Older than 3 months', shortLabel: '>3m' },
];

/**
 * Returns true if a conversation with last-activity `updatedAtMs`
 * should be SHOWN under the "older than `cutoffDays`" filter.
 * null cutoff = no filtering. Strictly-older comparison.
 */
export function filterOlderThanMatches(updatedAtMs: number, cutoffDays: number | null, nowMs: number = Date.now()): boolean {
  if (cutoffDays === null) return true;
  return updatedAtMs < nowMs - cutoffDays * 24 * 60 * 60 * 1000;
}
