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


// === Size Estimation ===

/**
 * Estimates JSON serialized size without actually stringifying.
 *
 * Avoids memory allocation spike on large objects. Useful for progress tracking,
 * batching decisions, or debug output sizing.
 *
 * Note: This is an ESTIMATE. It doesn't account for:
 * - UTF-8 multi-byte characters (assumes 1 byte per char)
 * - JSON escape sequences (\n, \t, unicode escapes)
 * - Floating point precision differences
 *
 * Returns 0 for the cyclic portion if circular references are detected.
 */
export function objectEstimateJsonSize(value: unknown, debugCaller: string): number {
  const seen = new WeakSet<object>();

  function estimate(val: unknown): number {
    if (val === null) return 4; // "null"
    if (val === undefined) return 0; // omitted in JSON

    switch (typeof val) {
      case 'string':
        return val.length + 2; // quotes
      case 'number':
        return String(val).length;
      case 'boolean':
        return val ? 4 : 5; // "true" or "false"
      case 'object': {
        // cycle detection
        if (seen.has(val as object)) {
          console.warn(`[estimateJsonSize (${debugCaller})] Circular reference detected, returning 0 for this branch`);
          return 0;
        }
        seen.add(val as object);

        if (Array.isArray(val)) {
          let size = 2; // []
          for (let i = 0; i < val.length; i++) {
            size += estimate(val[i]);
            if (i < val.length - 1) size += 1; // comma
          }
          return size;
        }

        // plain object
        let size = 2; // {}
        const keys = Object.keys(val);
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          size += key.length + 3; // "key":
          size += estimate((val as Record<string, unknown>)[key]);
          if (i < keys.length - 1) size += 1; // comma
        }
        return size;
      }
      default:
        return 0;
    }
  }

  return estimate(value);
}


// === Object Traversal ===

/**
 * Deep clones an object while truncating strings that exceed maxBytes.
 *
 * Useful for debug logging of large objects (e.g., requests with base64 images).
 * Truncates strings in the middle, preserving start and end with a byte count.
 *
 * @returns Deep clone with truncated strings, or "[Circular]" for cyclic refs
 */
export function objectDeepCloneWithStringLimit(value: unknown, debugCaller: string, maxBytes: number = 2048): unknown {
  const seen = new WeakSet<object>();

  function clone(val: unknown): unknown {
    // handle primitives first
    if (val === null || val === undefined) return val;

    // handle strings - truncate if too long
    if (typeof val === 'string') {
      if (val.length <= maxBytes) return val;
      const ellipsis = `...[${(val.length - maxBytes).toLocaleString()} bytes]...`;
      const half = Math.floor((maxBytes - ellipsis.length) / 2);
      return val.slice(0, half) + ellipsis + val.slice(-half);
    }

    // handle other primitives
    if (typeof val !== 'object') return val;

    // cycle detection
    if (seen.has(val)) return '[Circular]';
    seen.add(val);

    // handle arrays - recurse
    if (Array.isArray(val))
      return val.map(item => clone(item));

    // handle objects - recurse
    const result: Record<string, unknown> = {};
    for (const key in val)
      if (Object.prototype.hasOwnProperty.call(val, key))
        result[key] = clone((val as Record<string, unknown>)[key]);
    return result;
  }

  return clone(value);
}

/**
 * JSON.stringify with indentation only above a depth threshold.
 *
 * Levels 0..maxIndentDepth-1 are indented (like JSON.stringify(v, null, indent));
 * deeper levels collapse to a single line. Useful for debug views where deep,
 * repetitive structures (e.g., AIX request bodies with `contents[].parts[].text`)
 * become unreadable when every level is on its own line.
 *
 * Implemented as a post-processor over JSON.stringify's output so it inherits
 * all standard behavior: toJSON(), undefined/function/symbol skipping,
 * sparse-array nulls, cycle detection, BigInt errors. Peak memory is ~2x the
 * indented string, briefly. O(N) time, O(N) space.
 */
export function objectStringifyWithIndentDepth(
  value: unknown,
  debugCaller: string,
  maxIndentDepth: number = 4,
  indent: number = 2,
): string {
  // fast path: no indentation requested, single stringify pass
  if (maxIndentDepth <= 0) {
    try {
      return JSON.stringify(value) ?? '';
    } catch (e) {
      console.warn(`[stringifyWithIndentDepth (${debugCaller})]`, e);
      return '';
    }
  }

  let indented: string | undefined;
  try {
    indented = JSON.stringify(value, null, indent);
  } catch (e) {
    console.warn(`[stringifyWithIndentDepth (${debugCaller})]`, e);
    return '';
  }
  if (indented === undefined) return ''; // top-level was undefined/function/symbol

  let out = '';
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < indented.length; i++) {
    const c = indented[i];

    if (inString) {
      out += c;
      if (escape) escape = false;
      else if (c === '\\') escape = true;
      else if (c === '"') inString = false;
      continue;
    }

    if (c === '"') {
      inString = true;
      out += c;
      continue;
    }

    if (c === '{' || c === '[') {
      out += c;
      depth++;
      // skip the following \n + indent at the threshold; no padding space inside braces
      if (depth >= maxIndentDepth) {
        while (i + 1 < indented.length && (indented[i + 1] === '\n' || indented[i + 1] === ' ')) i++;
      }
      continue;
    }

    if (c === '}' || c === ']') {
      depth--;
      out += c;
      continue;
    }

    // collapse whitespace runs at or beyond the threshold; keep a single separator only
    // between value tokens (suppress when adjacent to a brace/bracket on either side)
    if ((c === '\n' || c === ' ') && depth >= maxIndentDepth) {
      while (i + 1 < indented.length && (indented[i + 1] === '\n' || indented[i + 1] === ' ')) i++;
      const last = out.length ? out[out.length - 1] : '';
      const next = i + 1 < indented.length ? indented[i + 1] : '';
      if (last !== '{' && last !== '[' && last !== ' ' && next !== '}' && next !== ']')
        out += ' ';
      continue;
    }

    out += c;
  }
  return out;
}

/**
 * Find the largest string values in an object tree
 *
 * Recursively traverses an object to find the top N largest string values,
 * returning their paths, lengths, and preview snippets.
 *
 * @returns Array of {path, length, preview} sorted by length (descending)
 */
export function objectFindLargestStringPaths(obj: unknown, debugCaller: string, topN: number = 5, maxDepth: number = 20): Array<{ path: string; length: number; preview: string }> {
  const results: Array<{ path: string; length: number; preview: string }> = [];
  const seen = new WeakSet<object>();

  function traverse(current: unknown, path: string, depth: number) {
    // prevent infinite recursion
    if (depth > maxDepth) return;

    // handle strings
    if (typeof current === 'string') {
      results.push({
        path,
        length: current.length,
        preview: current.substring(0, 100) + (current.length > 100 ? '...' : ''),
      });
      return;
    }

    // handle non-objects
    if (current === null || typeof current !== 'object') return;

    // cycle detection
    if (seen.has(current)) {
      console.warn(`[findLargestStringPaths (${debugCaller})] Circular reference at path: ${path}`);
      return;
    }
    seen.add(current);

    // handle arrays
    if (Array.isArray(current))
      return current.forEach((item, index) => traverse(item, `${path}[${index}]`, depth + 1));

    // handle objects
    for (const [key, value] of Object.entries(current))
      traverse(value, path ? `${path}.${key}` : key, depth + 1);
  }

  traverse(obj, '', 0);

  // sort by length descending and return top N
  return results
    .sort((a, b) => b.length - a.length)
    .slice(0, topN);
}
