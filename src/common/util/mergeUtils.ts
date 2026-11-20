/**
 * Trivial Merge Detection
 *
 * Detects when two versions of an entity can be trivially merged
 * (additive changes only, no value conflicts) and performs the merge.
 *
 * There is no common base: an item deleted on one side reads as an addition of the other.
 * 'local' and 'server' name the two sides; the second is any other copy (cloud, file).
 */


export interface MergeAnalysis<T> {
  canMerge: boolean;
  merged?: T;
  conflicts: string[];        // Paths with conflicting values, e.g. ["title", "messages[2].content"]
  localOnlyCount: number;     // Number of items/props only in local
  serverOnlyCount: number;    // Number of items/props only in server
}


/**
 * Deep equality check for two values
 */
function deepEqual(a: unknown, b: unknown, ignoredFields: ReadonlySet<string>): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i], ignoredFields));
  }

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj).filter(k => !ignoredFields.has(k));
  const bKeys = Object.keys(bObj).filter(k => !ignoredFields.has(k));

  if (aKeys.length !== bKeys.length) return false;

  return aKeys.every(key => deepEqual(aObj[key], bObj[key], ignoredFields));
}


/**
 * Get the ID of an array item if it has one
 */
function getItemId(item: unknown): string | undefined {
  if (item && typeof item === 'object' && 'id' in item) {
    const id = (item as Record<string, unknown>).id;
    return typeof id === 'string' ? id : undefined;
  }
  return undefined;
}


/**
 * Analyze if two arrays can be trivially merged
 */
function analyzeArrayMerge<T>(
  local: T[],
  server: T[],
  path: string,
  ignoredFields: ReadonlySet<string>,
): { canMerge: boolean; merged?: T[]; conflicts: string[]; localOnly: number; serverOnly: number } {
  const conflicts: string[] = [];
  let localOnly = 0;
  let serverOnly = 0;

  // Check if items have IDs
  const localHasIds = local.length === 0 || local.some(item => getItemId(item) !== undefined);
  const serverHasIds = server.length === 0 || server.some(item => getItemId(item) !== undefined);

  if (localHasIds && serverHasIds) {
    // Merge by ID
    const localById = new Map<string, T>();
    const localWithoutId: T[] = [];

    for (const item of local) {
      const id = getItemId(item);
      if (id) localById.set(id, item);
      else localWithoutId.push(item);
    }

    const serverById = new Map<string, T>();
    const serverWithoutId: T[] = [];

    for (const item of server) {
      const id = getItemId(item);
      if (id) serverById.set(id, item);
      else serverWithoutId.push(item);
    }

    // Check for conflicts: same ID, different content
    for (const [id, localItem] of localById) {
      const serverItem = serverById.get(id);
      if (serverItem !== undefined && !deepEqual(localItem, serverItem, ignoredFields)) {
        conflicts.push(`${path}[id=${id}]`);
      }
    }

    if (conflicts.length > 0) {
      return { canMerge: false, conflicts, localOnly: 0, serverOnly: 0 };
    }

    // Count unique items
    for (const id of localById.keys()) {
      if (!serverById.has(id)) localOnly++;
    }
    for (const id of serverById.keys()) {
      if (!localById.has(id)) serverOnly++;
    }

    // Merge: combine all unique items
    const mergedById = new Map<string, T>();

    // Add all server items first (establishes order from server)
    for (const [id, item] of serverById) {
      mergedById.set(id, item);
    }

    // Add local-only items
    for (const [id, item] of localById) {
      if (!mergedById.has(id)) {
        mergedById.set(id, item);
      }
    }

    // Items without IDs: compare by deep equality
    const mergedWithoutId: T[] = [...serverWithoutId];
    for (const localItem of localWithoutId) {
      if (!serverWithoutId.some(serverItem => deepEqual(localItem, serverItem, ignoredFields))) {
        mergedWithoutId.push(localItem);
        localOnly++;
      }
    }
    for (const serverItem of serverWithoutId) {
      if (!localWithoutId.some(localItem => deepEqual(localItem, serverItem, ignoredFields))) {
        serverOnly++;
      }
    }

    const merged = [...mergedById.values(), ...mergedWithoutId];
    return { canMerge: true, merged, conflicts: [], localOnly, serverOnly };

  } else {
    // No IDs: compare by deep equality - by lookup for what is not an object: a list of ids can be long
    const localValues = new Set<unknown>(local);
    const serverValues = new Set<unknown>(server);
    const isObject = (item: unknown) => item !== null && typeof item === 'object';
    const merged: T[] = [...server];
    for (const localItem of local) {
      if (isObject(localItem) ? !server.some(serverItem => deepEqual(localItem, serverItem, ignoredFields)) : !serverValues.has(localItem)) {
        merged.push(localItem);
        localOnly++;
      }
    }
    for (const serverItem of server) {
      if (isObject(serverItem) ? !local.some(localItem => deepEqual(localItem, serverItem, ignoredFields)) : !localValues.has(serverItem)) {
        serverOnly++;
      }
    }

    return { canMerge: true, merged, conflicts: [], localOnly, serverOnly };
  }
}


/**
 * Analyze if two objects can be trivially merged
 */
function analyzeObjectMerge<T extends Record<string, unknown>>(
  local: T,
  server: T,
  path: string,
  ignoredFields: ReadonlySet<string>,
): { canMerge: boolean; merged?: T; conflicts: string[]; localOnly: number; serverOnly: number } {
  const conflicts: string[] = [];
  let localOnly = 0;
  let serverOnly = 0;

  const localKeys = new Set(Object.keys(local).filter(k => !ignoredFields.has(k)));
  const serverKeys = new Set(Object.keys(server).filter(k => !ignoredFields.has(k)));
  const allKeys = new Set([...localKeys, ...serverKeys]);

  const merged: Record<string, unknown> = {};

  for (const key of allKeys) {
    const keyPath = path ? `${path}.${key}` : key;
    const inLocal = localKeys.has(key);
    const inServer = serverKeys.has(key);

    if (inLocal && !inServer) {
      // Local only - additive
      merged[key] = local[key];
      localOnly++;
    } else if (!inLocal && inServer) {
      // Server only - additive
      merged[key] = server[key];
      serverOnly++;
    } else {
      // In both - need to recurse or compare
      const localVal = local[key];
      const serverVal = server[key];

      if (deepEqual(localVal, serverVal, ignoredFields)) {
        // Same value, no conflict
        merged[key] = localVal;
      } else if (localVal === null || serverVal === null) {
        // One is null, the other isn't - conflict
        conflicts.push(keyPath);
      } else if (typeof localVal !== typeof serverVal) {
        // Different types - conflict
        conflicts.push(keyPath);
      } else if (typeof localVal !== 'object') {
        // Different primitives - conflict
        conflicts.push(keyPath);
      } else if (Array.isArray(localVal) && Array.isArray(serverVal)) {
        // Both arrays - try to merge
        const arrayResult = analyzeArrayMerge(localVal, serverVal, keyPath, ignoredFields);
        if (!arrayResult.canMerge) {
          conflicts.push(...arrayResult.conflicts);
        } else {
          merged[key] = arrayResult.merged;
          localOnly += arrayResult.localOnly;
          serverOnly += arrayResult.serverOnly;
        }
      } else if (Array.isArray(localVal) !== Array.isArray(serverVal)) {
        // One is array, other is object - conflict
        conflicts.push(keyPath);
      } else {
        // Both objects - recurse
        const objResult = analyzeObjectMerge(
          localVal as Record<string, unknown>,
          serverVal as Record<string, unknown>,
          keyPath,
          ignoredFields,
        );
        if (!objResult.canMerge) {
          conflicts.push(...objResult.conflicts);
        } else {
          merged[key] = objResult.merged;
          localOnly += objResult.localOnly;
          serverOnly += objResult.serverOnly;
        }
      }
    }
  }

  if (conflicts.length > 0) {
    return { canMerge: false, conflicts, localOnly: 0, serverOnly: 0 };
  }

  // Handle ignored fields: use max for the numbers (timestamps, counters), prefer local for the rest
  for (const key of ignoredFields) {
    if (key in local || key in server) {
      const localVal = local[key as keyof T];
      const serverVal = server[key as keyof T];

      // of the numeric sides only: a null 'updated' (never updated) must not become 0
      // noinspection SuspiciousTypeOfGuard
      const localIsNum = typeof localVal === 'number';
      // noinspection SuspiciousTypeOfGuard
      const serverIsNum = typeof serverVal === 'number';
      merged[key] = localIsNum && serverIsNum ? Math.max(localVal, serverVal)
        : localIsNum ? localVal
          : serverIsNum ? serverVal
            : localVal ?? serverVal ?? null;
    }
  }

  return { canMerge: true, merged: merged as T, conflicts: [], localOnly, serverOnly };
}


/**
 * Analyze if two entities can be trivially merged.
 *
 * A merge is trivial when both versions have made independent additive changes
 * that don't conflict:
 * - Local added new array items that server doesn't have
 * - Server added new array items that local doesn't have
 * - Local added new object properties that server doesn't have
 * - Server added new object properties that local doesn't have
 * - BUT: No property/item exists in both with different values
 *
 * @param ignoredFields Fields left out of the comparison at every depth: what changes without the content changing, e.g. 'updated'
 * @returns Analysis result with canMerge flag, merged entity (if possible), and conflict paths
 */
export function analyzeMerge<T>(local: T, server: T, ignoredFields: ReadonlySet<string>): MergeAnalysis<T> {
  // Base cases
  if (local === server)
    return { canMerge: true, merged: local, conflicts: [], localOnlyCount: 0, serverOnlyCount: 0 };

  if (local === null || server === null)
    return { canMerge: false, conflicts: ['(root)'], localOnlyCount: 0, serverOnlyCount: 0 };

  if (typeof local !== typeof server)
    return { canMerge: false, conflicts: ['(root)'], localOnlyCount: 0, serverOnlyCount: 0 };

  // Primitives with different values = conflict
  if (typeof local !== 'object')
    return { canMerge: false, conflicts: ['(root)'], localOnlyCount: 0, serverOnlyCount: 0 };

  // Arrays at root level
  if (Array.isArray(local) && Array.isArray(server)) {
    const result = analyzeArrayMerge(local, server, '', ignoredFields);
    return {
      canMerge: result.canMerge,
      merged: result.merged as T,
      conflicts: result.conflicts,
      localOnlyCount: result.localOnly,
      serverOnlyCount: result.serverOnly,
    };
  }

  // Objects
  if (!Array.isArray(local) && !Array.isArray(server)) {
    const result = analyzeObjectMerge(
      local as Record<string, unknown>,
      server as Record<string, unknown>,
      '',
      ignoredFields,
    );
    return {
      canMerge: result.canMerge,
      merged: result.merged as T,
      conflicts: result.conflicts,
      localOnlyCount: result.localOnly,
      serverOnlyCount: result.serverOnly,
    };
  }

  // Mismatched types (array vs object)
  return { canMerge: false, conflicts: ['(root)'], localOnlyCount: 0, serverOnlyCount: 0 };
}
