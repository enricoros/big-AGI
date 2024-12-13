/**
 * Vector Clock implementation for distributed systems
 * Supports async workflows and conflict resolution
 */

export type VectorClockNodeId = string;
type VectorClockTimestamp = number;

/**
 * What's in the database
 */
export type VectorClockState = {
  [nodeId: string]: VectorClockTimestamp;
};

/**
 * What's in memory in this node (device)
 */
export interface VectorClock {
  nodeId: VectorClockNodeId;
  state: VectorClockState;
}


// Auxiliary types for comparisons, merges

export interface VectorClockConflict<T> {
  local: T;
  remote: T;
  localClock: VectorClock;
  remoteClock: VectorClock;
}

export type VectorClockMergeResult<T> = {
  success: boolean;
  conflicts?: VectorClockConflict<T>[];
  result?: T;
};
