import type { VectorClock, VectorClockMergeResult, VectorClockNodeId, VectorClockState } from './vectorclock.types';

export const VectorClockOrder = {
  BEFORE: -1,
  CONCURRENT: 0,
  AFTER: 1,
} as const;
export type VectorClockOrderType = typeof VectorClockOrder[keyof typeof VectorClockOrder];


/**
 * Creates a new vector clock for a node
 */
export function vectorClockCreate(nodeId: VectorClockNodeId, state: VectorClockState = {}): VectorClock {
  return {
    nodeId,
    state: { ...state, [nodeId]: state[nodeId] ?? 0 },
  };
}

/**
 * Creates a deep copy of a vector clock
 */
export function vectorClockClone(clock: VectorClock): VectorClock {
  return {
    nodeId: clock.nodeId,
    state: { ...clock.state },
  };
}

/**
 * Increments the vector clock for its node
 */
export function vectorClockIncrementInPlace(clock: VectorClock): void {
  clock.state[clock.nodeId] = (clock.state[clock.nodeId] ?? 0) + 1;
}

/**
 * Merges source clock into target clock
 */
export function vectorClockMergeInPlace(target: VectorClock, source: VectorClock): void {
  const allNodes = new Set([...Object.keys(target.state), ...Object.keys(source.state)]);
  for (const nodeId of allNodes)
    target.state[nodeId] = Math.max(target.state[nodeId] ?? 0, source.state[nodeId] ?? 0);
}

/**
 * Compares two vector clocks
 * @returns -1 if a < b, 0 if concurrent, 1 if a > b
 */
export function vectorClockCompare(a: VectorClock, b: VectorClock): VectorClockOrderType {
  let isGreater = false;
  let isLess = false;

  const allNodes = new Set([...Object.keys(a.state), ...Object.keys(b.state)]);
  for (const nodeId of allNodes) {
    const aTime = a.state[nodeId] ?? 0;
    const bTime = b.state[nodeId] ?? 0;
    if (aTime > bTime) isGreater = true;
    if (aTime < bTime) isLess = true;
  }

  if (isGreater && !isLess) return VectorClockOrder.AFTER;
  if (isLess && !isGreater) return VectorClockOrder.BEFORE;
  return VectorClockOrder.CONCURRENT;
}

/**
 * Validates if an object is a valid vector clock
 */
export function vectorClockIsValid(obj: unknown): obj is VectorClock {
  if (!obj || typeof obj !== 'object') return false;

  const clock = obj as VectorClock;
  // noinspection SuspiciousTypeOfGuard
  return (
    typeof clock.nodeId === 'string' && !!clock.nodeId &&
    clock.state !== null && typeof clock.state === 'object' &&
    Object.values(clock.state).every(v => typeof v === 'number')
  );
}

// /**
//  * Gets timestamp for a specific node
//  */
// export function vectorClockGetTime(clock: VectorClock, nodeId: VectorClockNodeId): VectorClockTimestamp {
//   return clock.state[nodeId] ?? 0;
// }

// /**
//  * Creates an empty vector clock state
//  */
// export function vectorClockCreateEmptyState(): VectorClockState {
//   return {};
// }

// /**
//  * Detects if two clocks are concurrent (potential conflict)
//  */
// export function vectorClockHasConcurrentUpdates(a: VectorClock, b: VectorClock): boolean {
//   return vectorClockCompare(a, b) === VectorClockOrder.CONCURRENT;
// }

/**
 * Checks if one clock dominates another (happens-before relationship)
 */
export function vectorClockIsDominating(dominant: VectorClock, other: VectorClock): boolean {
  return vectorClockCompare(dominant, other) === VectorClockOrder.AFTER;
}

/**
 * Attempts to merge data with vector clocks, detecting conflicts
 */
export function vectorClockAttemptMerge<T>(local: { data: T; clock: VectorClock }, remote: { data: T; clock: VectorClock }): VectorClockMergeResult<T> {
  const comparison = vectorClockCompare(local.clock, remote.clock);
  switch (comparison) {
    case VectorClockOrder.CONCURRENT:
      return {
        success: false,
        conflicts: [{
          local: local.data,
          remote: remote.data,
          localClock: local.clock,
          remoteClock: remote.clock,
        }],
      };
    case VectorClockOrder.BEFORE:
      return {
        success: true,
        result: remote.data,
      };
    default:
      return {
        success: true,
        result: local.data,
      };
  }
}

/**
 * Creates a merged clock after conflict resolution
 */
export function vectorClockCreateMerged(localClock: VectorClock, remoteClock: VectorClock): VectorClock {
  const merged = vectorClockClone(localClock);
  vectorClockMergeInPlace(merged, remoteClock);
  vectorClockIncrementInPlace(merged);
  return merged;
}
