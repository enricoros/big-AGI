import * as React from 'react';


/**
 * Can be extended to make an object useSyncExternalStore-compatible,
 * or used as field in such an object to avoid boilerplate.
 */
export class SyncExternalStorable<TSnapshot extends object> {

  #listeners: Set<() => void> | null = null;
  #snapshot: TSnapshot;

  constructor(initialSnapshot: TSnapshot) {
    this.#snapshot = initialSnapshot;
  }

  // subscribe/getSnapshot - stable arrow functions for useSyncExternalStore
  getSnapshot = (): TSnapshot => this.#snapshot;
  subscribe = (listener: () => void): (() => void) => {
    const listeners = (this.#listeners ??= new Set());
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  /** Patch fields and notify listeners. */
  protected _snapshotPatch(patch: Partial<TSnapshot>): void {
    this.#snapshot = { ...this.#snapshot, ...patch };
    this.#notifyListeners();
  }

  /** Full replace and notify listeners. */
  protected _snapshotSet(snapshot: TSnapshot): void {
    this.#snapshot = snapshot;
    this.#notifyListeners();
  }

  /** Full replace, no notification. For dispose/reset. */
  protected _snapshotSetSilent(snapshot: TSnapshot): void {
    this.#snapshot = snapshot;
  }

  #notifyListeners() {
    if (this.#listeners) for (const fn of this.#listeners) fn();
  }

}


// --- Managed Lifecycle Helper hook ---

export abstract class SyncExternalDisposableStorable<TSnapshot extends object> extends SyncExternalStorable<TSnapshot> {
  abstract dispose(): void;
}

/**
 * Hook: creates a SyncExternalStorable instance via factory (once, in a ref),
 * subscribes to snapshot changes, and disposes on unmount.
 * Returns `[snapshot, instance]`.
 */
export function useManagedSyncStorable<Tds extends SyncExternalDisposableStorable<object>>(disposableStoreFactory: () => Tds): [
  snapshot: _SnapshotOf<Tds>,
  instance: Tds,
] {
  // create the store object
  const ref = React.useRef<Tds | null>(null);
  if (!ref.current) ref.current = disposableStoreFactory();
  const ds = ref.current;

  // subscribe to snapshot changes
  const snapshot = React.useSyncExternalStore(ds.subscribe, ds.getSnapshot) as _SnapshotOf<Tds>;

  // lifecycle: dispose on unmount
  React.useEffect(() => () => {
    // [HMR] reset the ref so that a new instance will be created on next render after hot reload
    ref.current = null;
    ds.dispose();
  }, [ds]);

  return [snapshot, ds];
}

type _SnapshotOf<T> = T extends SyncExternalDisposableStorable<infer S> ? S : never;
