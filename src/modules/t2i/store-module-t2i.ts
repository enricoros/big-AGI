import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

import { agiUuidV4 } from '~/common/util/idUtils';
import { llmsStoreState, useModelsStore } from '~/common/stores/llms/store-llms';

import type { DT2ICredentialsAny, DT2IEngine, DT2IEngineAny, DT2IEngineId, DT2IVendorType } from './t2i.types';
import { t2iFindByVendorPriorityAsc, t2iFindVendor, t2iFindVendorForLLMVendor } from './t2i.vendors-registry';


interface T2IStoreState {

  // map of engineId -> engine (for O(1) lookups and future ZYNC sync)
  engines: Record<DT2IEngineId, DT2IEngineAny>;
  activeEngineId: DT2IEngineId | null; // null = no user selection -> global auto-selection

  // to avoid repeated migrations / initializations
  hasInitializedLlms: boolean;

}

interface T2IStoreActions {

  // engine CRUD
  createEngine: <TVt extends DT2IVendorType>(vendorType: TVt, partial?: Partial<DT2IEngine<TVt>>) => DT2IEngineId;
  updateEngine: (engineId: DT2IEngineId, partial: Partial<DT2IEngineAny>) => void;
  deleteEngine: (engineId: DT2IEngineId) => void;

  // selection
  setActiveEngineId: (engineId: DT2IEngineId | null) => void;

  // auto-detection / sync from LLM services
  syncEnginesFromLLMServices: (llmsSources: ReturnType<typeof useModelsStore.getState>['sources']) => boolean;

}

type T2IStore = T2IStoreState & T2IStoreActions;


export const useT2IStore = create<T2IStore>()(persist(
  (set, get) => ({

    // initial state
    engines: {},
    activeEngineId: null,
    hasInitializedLlms: false,


    // Engine CRUD

    createEngine: (vendorType, partial) => {
      type TVt = typeof vendorType;
      const v = t2iFindVendor(vendorType);
      if (!v) throw new Error(`Unknown T2I engine type: ${vendorType}`);

      const engineId = agiUuidV4('t2i.engine.instance');
      const now = Date.now();

      const engine = {
        engineId,
        vendorType,
        label: partial?.label ?? v.name,
        isAutoDetected: partial?.isAutoDetected ?? false,
        isAutoLinked: partial?.isAutoLinked ?? false,
        isDeleted: false,
        credentials: partial?.credentials ?? v.getDefaultCredentials(),
        profile: partial?.profile ?? v.getDefaultProfile(),
        createdAt: now,
        updatedAt: now,
      } as const satisfies DT2IEngine<TVt>;

      set(state => ({ engines: { ...state.engines, [engineId]: engine as DT2IEngineAny } }));
      return engineId;
    },

    updateEngine: (engineId, partial) => {
      set(state => {
        const engine = state.engines[engineId];
        if (!engine) return state;
        return {
          engines: {
            ...state.engines,
            [engineId]: {
              ...engine,
              ...partial,
              updatedAt: Date.now(),
            } as DT2IEngineAny,
          },
        };
      });
    },

    deleteEngine: (engineId) => {
      set(state => {
        const engine = state.engines[engineId];
        if (!engine) return state;

        // soft-delete for auto-detected engines (so sync can restore them if the source returns)
        if (engine.isAutoDetected)
          return {
            engines: { ...state.engines, [engineId]: { ...engine, isDeleted: true, updatedAt: Date.now() } },
            activeEngineId: state.activeEngineId === engineId ? null : state.activeEngineId,
          };

        // hard removal for user-created engines
        const { [engineId]: _removed, ...restEngines } = state.engines;
        return {
          engines: restEngines,
          activeEngineId: state.activeEngineId === engineId ? null : state.activeEngineId,
        };
      });
    },


    // Selection

    setActiveEngineId: (engineId) => {
      set({ activeEngineId: engineId });
    },


    // Auto-detection

    syncEnginesFromLLMServices: (llmsSources) => {
      const { engines, createEngine, updateEngine } = get();

      let hasChanges = false;
      const autoLinkedIds = new Set<DT2IEngineId>();

      // restore or create auto-linked engines
      for (const source of llmsSources) {
        const vendor = t2iFindVendorForLLMVendor(source.vId);
        if (!vendor) continue;

        // secondary qualifier: e.g. OpenAI opts out when the LLM service uses a custom host
        // (likely an OpenAI-compatible proxy that doesn't implement image generation)
        if (vendor.shouldAutoLinkFromLLMSource && !vendor.shouldAutoLinkFromLLMSource(source)) continue;

        // check if we already have an auto-linked engine for this service
        let existing: DT2IEngineAny | undefined;
        for (const engineId in engines) {
          const e = engines[engineId];
          if (e.isAutoLinked && e.credentials?.type === 'llms-service' && e.credentials.serviceId === source.id) {
            existing = e;
            break;
          }
        }

        // existing: mark as valid and restore if soft-deleted
        if (existing) {
          if (existing.isDeleted) {
            hasChanges = true;
            updateEngine(existing.engineId, { isDeleted: false });
          }
          autoLinkedIds.add(existing.engineId);
          continue;
        }

        // non-existing: create
        hasChanges = true;
        const engineId = createEngine(vendor.vendorType, {
          label: source?.label || vendor.name,
          isAutoDetected: true,
          isAutoLinked: true,
          credentials: {
            type: 'llms-service',
            serviceId: source.id,
          },
        });
        autoLinkedIds.add(engineId);
      }

      // soft-delete auto-linked engines whose service disappeared
      for (const engineId in engines) {
        const engine = engines[engineId];
        if (engine.isAutoLinked && !autoLinkedIds.has(engine.engineId) && !engine.isDeleted) {
          hasChanges = true;
          updateEngine(engine.engineId, { isDeleted: true });
        }
      }

      if (hasChanges)
        set({ hasInitializedLlms: true });

      return hasChanges;
    },

  }), {
    name: 'app-module-t2i',
    version: 2,

    // 2: engine-instance store (ASRx-style) - discard the v1 shape ({selectedT2IProviderId});
    //    auto-detection re-creates engines and re-resolves the active one
    migrate: (state: unknown, fromVersion) => {
      if (fromVersion < 2)
        return { engines: {}, activeEngineId: null, hasInitializedLlms: false };
      return state;
    },

    // Run auto-detections & migrations after rehydrate
    onRehydrateStorage: () => (store) => {
      if (!store) return;

      // initial auto-sync from LLM services (only runs once until marked initialized)
      if (!store.hasInitializedLlms)
        store.syncEnginesFromLLMServices(useModelsStore.getState().sources);

      // ongoing sync when LLM services change
      useModelsStore.subscribe((state, prevState) => {
        if (state.sources === prevState.sources) return;
        store.syncEnginesFromLLMServices(state.sources);
      });
    },
  },
));


// --- Hooks ---

export function useT2IEngines(): DT2IEngineAny[] {
  return useT2IStore(useShallow(state => {
    // non-deleted engines sorted by createdAt, oldest first
    const result: DT2IEngineAny[] = [];
    for (const engineId in state.engines) {
      const e = state.engines[engineId];
      if (!e.isDeleted) result.push(e);
    }
    return result.sort((a, b) => a.createdAt - b.createdAt);
  }));
}

export function useT2IGlobalEngine(): DT2IEngineAny | null {
  return useT2IStore(t2iFindGlobalEngine);
}


// --- Getters ---

export function t2iFindEngineById(engineId: DT2IEngineId | null): DT2IEngineAny | null {
  if (!engineId) return null;
  const { engines } = useT2IStore.getState();
  const engine = engines[engineId];
  if (!engine || engine.isDeleted) return null;
  return engine;
}

export function t2iFindGlobalEngine({ engines, activeEngineId }: T2IStore = useT2IStore.getState()): DT2IEngineAny | null {
  // A. user-selected active engine (no extra configured check - respect the user's choice)
  if (activeEngineId) {
    const active = engines[activeEngineId];
    if (active && !active.isDeleted) return active;
  }

  // B. priority fallback: prefer engines whose linked service has models loaded, but
  //    return any non-deleted engine as a last resort so the UI doesn't spuriously
  //    go to "no engine". The generation path throws a clear error at call time.
  const configuredEngines: DT2IEngineAny[] = [];
  const anyEngines: DT2IEngineAny[] = [];
  for (const engineId in engines) {
    const e = engines[engineId];
    if (e.isDeleted) continue;
    anyEngines.push(e);
    if (t2iEngineIsConfigured(e)) configuredEngines.push(e);
  }
  return t2iFindByVendorPriorityAsc(configuredEngines) ?? t2iFindByVendorPriorityAsc(anyEngines);
}

/**
 * An engine is "configured" (ready to generate) when its credentials resolve and
 * the linked LLM service has at least one model loaded (proof the service works).
 */
export function t2iEngineIsConfigured(engine: DT2IEngineAny): boolean {
  if (!t2iAreCredentialsValid(engine.credentials)) return false;
  if (engine.credentials.type === 'llms-service') {
    const { llms } = llmsStoreState();
    const serviceId = engine.credentials.serviceId;
    return llms.some(m => m.sId === serviceId);
  }
  return true;
}

/**
 * Credential validity:
 * - 'llms-service' passes when the linked LLM service still exists; generation goes
 *   through the server with the service's transport access, so no CSF check is needed.
 */
export function t2iAreCredentialsValid(credentials: DT2ICredentialsAny): boolean {
  switch (credentials.type) {
    case 'llms-service':
      const { sources: llmSources } = llmsStoreState();
      return llmSources.some(s => s.id === credentials.serviceId);
  }
}
