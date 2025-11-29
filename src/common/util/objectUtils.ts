/**
 * Object utility functions optimized for performance
 */

/**
 * Check if an object has any enumerable keys (faster than Object.keys().length > 0)
 *
 * Performance: ~2ns per call vs ~10ns for Object.keys().length
 * Benchmark: /tmp/benchmark-helper-vs-inline.html
 *
 * Note: Returns a boolean, automatically narrows out null/undefined through truthiness check
 */
export function hasKeys(obj: object | null | undefined): boolean {
  if (!obj) return false;
  // noinspection LoopStatementThatDoesntLoopJS
  for (const _ in obj) return true;
  return false;
}

/**
 * Count the number of enumerable keys in an object (faster than Object.keys().length)
 *
 * Performance: O(n) where n is number of keys, but avoids array allocation
 */
export function countKeys(obj: object | null | undefined): number {
  if (!obj) return 0;
  let count = 0;
  for (const _ in obj) count++;
  return count;
}

/**
 * Strip undefined fields from an object.
 *
 * Useful to prevent undefined becoming null over the wire (JSON serialization).
 */
export function stripUndefined<T extends object>(obj: T): T;
export function stripUndefined<T extends object>(obj: T | null): T | null;
export function stripUndefined<T extends object>(obj: T | null): T | null {
  if (!obj) return null;
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined)) as T;
}
