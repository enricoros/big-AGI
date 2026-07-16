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
 *
 * Lifecycle-safe under React StrictMode and Fast Refresh, which both run the
 * effect CLEANUP while the component stays mounted (strict: the dev-only
 * mount -> cleanup -> re-mount dance; refresh: effects re-run on every hot
 * update of the component). The cleanup disposes the instance, so the effect
 * BODY re-creates it and rebinds the render - without this, the UI stays
 * wired to a disposed instance: dead controls, frozen snapshot (empirically
 * verified: the previous dispose-only cleanup left the first post-mount click
 * a silent no-op in dev, and each further render churned a new instance,
 * disposing the one that had just started working).
 */
export function useManagedSyncStorable<Tds extends SyncExternalDisposableStorable<object>>(disposableStoreFactory: () => Tds): [
  snapshot: _SnapshotOf<Tds>,
  instance: Tds,
] {
  // create the store object (render-time, so the first paint has a snapshot; a strict-mode
  // double-render mints one throwaway instance - never started, never disposed, just GC'd)
  const ref = React.useRef<Tds | null>(null);
  if (!ref.current) ref.current = disposableStoreFactory();
  const ds = ref.current;

  // bumped only when the effect below re-creates a disposed instance
  const [, forceRebind] = React.useReducer((c: number) => c + 1, 0);

  // subscribe to snapshot changes
  const snapshot = React.useSyncExternalStore(ds.subscribe, ds.getSnapshot) as _SnapshotOf<Tds>;

  // lifecycle: dispose on unmount; re-create after a non-unmount cleanup (StrictMode, Fast Refresh)
  React.useEffect(() => {
    if (!ref.current) {
      ref.current = disposableStoreFactory();
      forceRebind(); // re-render: rebind snapshot + controls to the fresh instance
    }
    const created = ref.current;
    return () => {
      ref.current = null;
      created.dispose();
    };
    // deliberately no deps: the factory must be stable (module-level in all callers) and
    // making it a dep would churn instances per-render for any inline-closure caller
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [snapshot, ds];
}

type _SnapshotOf<T> = T extends SyncExternalDisposableStorable<infer S> ? S : never;
