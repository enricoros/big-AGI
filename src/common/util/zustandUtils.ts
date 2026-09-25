/**
 * The app's zustand entry point.
 *
 * - The package surface the codebase uses, under zustand's own names: an import from 'zustand',
 *   'zustand/vanilla', 'zustand/middleware' or 'zustand/react/shallow' moves here with no other change.
 * - The utility types zustand declares but keeps private, and the mutator-composed shapes.
 * - A trace layer over store creation, initialization, writes and subscriptions. Inert unless
 *   ZUSTAND_DEBUG_TRACE: off, `create` and `createStore` are zustand's own functions.
 */
import { create as _zustandCreate, useStore } from 'zustand';
import type { Mutate, StateCreator, StoreApi } from 'zustand';
import { createStore as _zustandCreateStore } from 'zustand/vanilla';


// -- Debug flags: all off in the build --

const ZUSTAND_DEBUG_TRACE = false;             // instrument create/createStore: registry and counters in globalThis.__zustandTraces
const ZUSTAND_DEBUG_LOG_CREATE = true;          // one console line per store creation
const ZUSTAND_DEBUG_LOG_WRITES = false;         // one per setState - noisy
const ZUSTAND_DEBUG_LOG_SUBSCRIPTIONS = false;  // one per subscribe/unsubscribe - noisy, React re-subscribes on every mount


// -- Package surface --

export { useStore };
export { useShallow } from 'zustand/react/shallow';
export { persist } from 'zustand/middleware';

export type { StoreApi, StateCreator, StoreMutatorIdentifier, Mutate, UseBoundStore } from 'zustand';

export const create: typeof _zustandCreate = ZUSTAND_DEBUG_TRACE ? _tracedCreate as typeof _zustandCreate : _zustandCreate;

export const createStore: typeof _zustandCreateStore = ZUSTAND_DEBUG_TRACE ? _tracedCreateStore as typeof _zustandCreateStore : _zustandCreateStore;


// -- Utility types --

/** The read side of a store, what `useStore(api, selector)` accepts. Hand this out when the writes belong to an owner (an engine, a transport). */
export type ReadonlyStoreApi<T> = Pick<StoreApi<T>, 'getState' | 'getInitialState' | 'subscribe'>;

/** A store api under the `persist` middleware: `.persist.{hasHydrated, onFinishHydration, rehydrate, clearStorage, ...}` typed. `P` is the partialized shape. */
export type PersistedStoreApi<T, P = T> = Mutate<StoreApi<T>, [['zustand/persist', P]]>;


// -- Trace layer --

interface ZustandStoreTrace {
  kind: 'bound' | 'vanilla';      // create() | createStore()
  label: string;                  // persist name, else the first state keys
  site: string;                   // creation site, best effort from the stack
  at: number;                     // ms since time origin
  initMs: number;                 // initializer duration, persist hydration included
  middleware?: string;            // keys the middlewares add to the store api, 'persist', ...; the UKV factory adds none and shows by site
  storedKB?: number;              // persist stores only: localStorage entry size at creation; none when never written, or on another backend
  writes: number;                 // setState calls, from actions and from outside
  subscriptions: number;          // subscribe calls, cumulative
  listeners: number;              // live listeners: a count that only grows is a leak
  collected?: true;               // the engine reclaimed the store: per-instance stores only, module stores never are
}

const _traces: ZustandStoreTrace[] = [];
let _finalizers: FinalizationRegistry<ZustandStoreTrace> | undefined;
const _STORE_API_KEYS: Record<keyof StoreApi<unknown>, true> = { setState: true, getState: true, getInitialState: true, subscribe: true };


function _tracedCreate(initializer?: StateCreator<unknown>) {
  return initializer
    ? _zustandCreate(_traceInitializer('bound', initializer))
    : (curried: StateCreator<unknown>) => _zustandCreate(_traceInitializer('bound', curried));
}

function _tracedCreateStore(initializer?: StateCreator<unknown>) {
  return initializer
    ? _zustandCreateStore(_traceInitializer('vanilla', initializer))
    : (curried: StateCreator<unknown>) => _zustandCreateStore(_traceInitializer('vanilla', curried));
}

/** Outermost middleware: wraps `set`/`setState` (one function in zustand, kept so) and `subscribe`, then times the initializer. */
function _traceInitializer(kind: ZustandStoreTrace['kind'], initializer: StateCreator<unknown>): StateCreator<unknown> {
  return (set, get, api) => {

    const index = _traces.length; // the row in console.table(__zustandTraces)
    const trace: ZustandStoreTrace = { kind, label: '(init)', site: _creationSite(), at: Math.round(performance.now()), initMs: 0, writes: 0, subscriptions: 0, listeners: 0 };
    if (!_traces.length)
      Object.assign(globalThis, { __zustandTraces: _traces }); // console: console.table(__zustandTraces)
    _traces.push(trace);
    if (typeof FinalizationRegistry !== 'undefined')
      (_finalizers ??= new FinalizationRegistry<ZustandStoreTrace>((t) => {
        t.collected = true;
        if (ZUSTAND_DEBUG_LOG_CREATE) console.log(`[zustand] #${_traces.indexOf(t)} ${t.label} collected`);
      })).register(api, trace);
    const tag = () => `[zustand] #${index} ${trace.label}`;

    // writes
    const tracedSet: typeof set = (...args) => {
      trace.writes++;
      if (ZUSTAND_DEBUG_LOG_WRITES) {
        const [partial, replace] = args;
        const shape = typeof partial === 'function' ? 'updater' : (typeof partial === 'object' && partial !== null) ? Object.keys(partial).join(',') : String(partial);
        console.log(`${tag()} set${replace ? ' replace' : ''}: ${shape}`);
      }
      set(...(args as Parameters<typeof set>));
    };
    api.setState = tracedSet;

    // subscriptions
    const subscribe = api.subscribe;
    api.subscribe = (listener) => {
      trace.subscriptions++;
      trace.listeners++;
      if (ZUSTAND_DEBUG_LOG_SUBSCRIPTIONS) console.log(`${tag()} subscribe (${trace.listeners} live)`);
      const unsubscribe = subscribe(listener);
      let live = true;
      return () => {
        if (live) {
          live = false;
          trace.listeners--;
          if (ZUSTAND_DEBUG_LOG_SUBSCRIPTIONS) console.log(`${tag()} unsubscribe (${trace.listeners} live)`);
        }
        unsubscribe();
      };
    };

    // initialization: the inner middlewares run here, persist hydrates within on sync storages
    const t0 = performance.now();
    const state = initializer(tracedSet, get, api);
    trace.initMs = Math.round((performance.now() - t0) * 100) / 100;

    const persistApi = 'persist' in api ? api.persist as PersistedStoreApi<unknown>['persist'] : undefined;
    const persistName = persistApi?.getOptions().name;
    trace.label = persistName ?? _stateLabel(state);
    const added = Object.keys(api).filter(k => !(k in _STORE_API_KEYS)).join(',');
    if (added) trace.middleware = added;
    if (persistName !== undefined) {
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(persistName) : null; // absent until the first write: hydration alone does not write back
      if (stored !== null) trace.storedKB = Math.round(stored.length / 102.4) / 10;
    }
    if (ZUSTAND_DEBUG_LOG_CREATE)
      console.log(`${tag()} ${kind} ${trace.initMs}ms${trace.middleware ? ` ${trace.middleware}` : ''}${trace.storedKB !== undefined ? ` ${trace.storedKB}kB` : persistName !== undefined ? ' no-entry' : ''} @ ${trace.site}`);

    return state;
  };
}

function _stateLabel(state: unknown): string {
  if (typeof state !== 'object' || state === null) return typeof state;
  const keys = Object.entries(state).filter(([, v]) => typeof v !== 'function').map(([k]) => k);
  return keys.slice(0, 3).join(',') + (keys.length > 3 ? ',..' : '');
}

function _creationSite(): string {
  const frames = (new Error().stack ?? '').split('\n');
  const frame = frames.find(f => f.includes('/') && !f.includes('zustandUtils') && !f.includes('/zustand/'));
  if (!frame) return '?';
  return frame.match(/src\/[^)\s]+/)?.[0] ?? frame.trim().replace(/^at /, ''); // 'src/...:line:col' when the frame has it
}
