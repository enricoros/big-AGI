import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

import { findModelVendor } from '~/modules/llms/vendors/vendors.registry';
import { vendorHasBackendCap } from '~/modules/llms/vendors/vendor.helpers';

import { agiUuidV4 } from '~/common/util/idUtils';
import { useModelsStore } from '~/common/stores/llms/store-llms';

import type { DASRxEngineId, DASRxCredentialsAny, DASRxEngine, DASRxEngineAny, DASRxVendorType } from './asrx.types';
import { asrxFindByVendorPriorityAsc, asrxFindVendor, asrxFindVendorForLLMVendor } from './asrx.vendors-registry';


interface ASRxStoreState {

  // map of engineId -> engine (for O(1) lookups and future ZYNC sync)
  engines: Record<DASRxEngineId, DASRxEngineAny>;
  activeEngineId: DASRxEngineId | null; // null = no user selection -> global auto-selection

  // to avoid repeated migrations / initializations
  hasInitializedLlms: boolean;

}

interface ASRxStoreActions {

  // engine CRUD
  createEngine: <TVt extends DASRxVendorType>(vendorType: TVt, partial?: Partial<DASRxEngine<TVt>>) => DASRxEngineId;
  updateEngine: (engineId: DASRxEngineId, partial: Partial<DASRxEngineAny>) => void;
  deleteEngine: (engineId: DASRxEngineId) => void;

  // selection
  setActiveEngineId: (engineId: DASRxEngineId | null) => void;

  // auto-detection / sync from LLM services
  syncEnginesFromLLMServices: (llmsSources: ReturnType<typeof useModelsStore.getState>['sources']) => boolean;

}

type ASRxStore = ASRxStoreState & ASRxStoreActions;


export const useASRxStore = create<ASRxStore>()(persist(
  (set, get) => ({

    // initial state
    engines: {},
    activeEngineId: null,
    hasInitializedLlms: false,


    // Engine CRUD

    createEngine: (vendorType, partial) => {
      type TVt = typeof vendorType;
      const v = asrxFindVendor(vendorType);
      if (!v) throw new Error(`Unknown ASRx engine type: ${vendorType}`);

      const engineId = agiUuidV4('asrx.engine.instance');
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
      } as const satisfies DASRxEngine<TVt>;

      set(state => ({ engines: { ...state.engines, [engineId]: engine as DASRxEngineAny } }));
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
            } as DASRxEngineAny,
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
      const autoLinkedIds = new Set<DASRxEngineId>();

      // restore or create auto-linked engines
      for (const source of llmsSources) {
        const vendor = asrxFindVendorForLLMVendor(source.vId);
        if (!vendor) continue;

        // secondary qualifier: e.g. OpenAI opts out when the LLM service uses a custom host
        // (likely an OpenAI-compatible proxy that doesn't implement transcription)
        if (vendor.shouldAutoLinkFromLLMSource && !vendor.shouldAutoLinkFromLLMSource(source)) continue;

        // check if we already have an auto-linked engine for this service
        let existing: DASRxEngineAny | undefined;
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
    name: 'app-module-asrx',
    version: 1,

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

export function useASRxEngines(): DASRxEngineAny[] {
  return useASRxStore(useShallow(state => {
    // non-deleted engines sorted by createdAt, oldest first
    const result: DASRxEngineAny[] = [];
    for (const engineId in state.engines) {
      const e = state.engines[engineId];
      if (!e.isDeleted) result.push(e);
    }
    return result.sort((a, b) => a.createdAt - b.createdAt);
  }));
}

export function useASRxGlobalEngine(): DASRxEngineAny | null {
  return useASRxStore(asrxFindGlobalEngine);
}


// --- Getters ---

export function asrxFindEngineById(engineId: DASRxEngineId | null, requireValidCredentials: boolean): DASRxEngineAny | null {
  if (!engineId) return null;
  const { engines } = useASRxStore.getState();
  const engine = engines[engineId];
  if (!engine || engine.isDeleted) return null;
  if (requireValidCredentials && !asrxAreCredentialsValid(engine.credentials)) return null;
  return engine;
}

export function asrxFindValidEngineByType(vendorType: DASRxVendorType): DASRxEngineAny | null {
  const { engines } = useASRxStore.getState();
  for (const engineId in engines) {
    const engine = engines[engineId];
    if (engine.vendorType === vendorType && !engine.isDeleted && asrxAreCredentialsValid(engine.credentials))
      return engine;
  }
  return null;
}

export function asrxFindGlobalEngine({ engines, activeEngineId }: ASRxStore = useASRxStore.getState()): DASRxEngineAny | null {
  // A. user-selected active engine (no extra credential check - respect the user's choice)
  if (activeEngineId) {
    const active = engines[activeEngineId];
    if (active && !active.isDeleted) return active;
  }

  // B. priority fallback: prefer engines with valid credentials, but return any
  //    non-deleted engine as a last resort so the UI doesn't spuriously go to
  //    "no engine" after a deletion when an unconfigured engine remains. The
  //    transcription path rejects invalid credentials separately in _buildBatchWireAccess.
  const validEngines: DASRxEngineAny[] = [];
  const anyEngines: DASRxEngineAny[] = [];
  for (const engineId in engines) {
    const e = engines[engineId];
    if (e.isDeleted) continue;
    anyEngines.push(e);
    if (asrxAreCredentialsValid(e.credentials)) validEngines.push(e);
  }
  return asrxFindByVendorPriorityAsc(validEngines) ?? asrxFindByVendorPriorityAsc(anyEngines);
}


/**
 * Credential validity:
 * - 'api-key' needs either an inline key or a custom host (for local/self-hosted endpoints)
 * - 'llms-service' passes when either the browser has usable credentials (csfAvailable)
 *   OR the vendor has server-side (backend env) configuration. The latter case means
 *   the browser itself can't make the request today, but the LLM service is legitimately
 *   "configured" - surfacing it as red would be misleading. The transcription adapter
 *   will return a clear error at call time if CSF isn't possible.
 */
export function asrxAreCredentialsValid(credentials: DASRxCredentialsAny): boolean {
  switch (credentials.type) {
    case 'api-key':
      return !!credentials.apiKey || !!credentials.apiHost;

    case 'llms-service':
      const { sources: llmSources } = useModelsStore.getState();
      const llmService = llmSources.find(s => s.id === credentials.serviceId);
      if (!llmService?.vId) return false;
      const vendor = findModelVendor(llmService.vId);
      if (!vendor) return false;
      return !!vendor.csfAvailable?.(llmService.setup)
        || vendorHasBackendCap(vendor);
  }
}
