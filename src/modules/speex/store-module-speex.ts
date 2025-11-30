import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

import { findModelVendor } from '~/modules/llms/vendors/vendors.registry';

import { agiUuidV4 } from '~/common/util/idUtils';
import { useModelsStore } from '~/common/stores/llms/store-llms';

import type { DSpeexCredentialsAny, DSpeexEngine, DSpeexEngineAny, DSpeexVendorType, SpeexEngineId } from './speex.types';
import { SPEEX_DEFAULTS } from './speex.config';
import { speexFindByVendorPriorityAsc, speexFindVendor, speexFindVendorForLLMVendor } from './speex.vendors-registry';
import { webspeechHBestVoiceDeferred, webspeechIsSupported } from './protocols/webspeech/webspeech.client';


interface SpeexStoreState {

  // map of engineId -> engine (for O(1) lookups and ZYNC preparation)
  engines: Record<SpeexEngineId, DSpeexEngineAny>;
  activeEngineId: SpeexEngineId | null; // null = no user selection = use global auto-selection

  // to avoid repeated migrations
  hasInitializedLlms: boolean;
  hasMigratedElevenLabs: boolean;

}

interface SpeexStoreActions {

  // engine CRUD
  createEngine: <TVt extends DSpeexVendorType>(vendorType: TVt, partial?: Partial<DSpeexEngine<TVt>>) => SpeexEngineId;
  updateEngine: (engineId: SpeexEngineId, partial: Partial<DSpeexEngineAny>) => void;
  deleteEngine: (engineId: SpeexEngineId) => void;

  // selection
  setActiveEngineId: (engineId: SpeexEngineId | null) => void;

  // business logic: auto-detection or migration
  syncWebSpeechEngine: () => boolean;
  syncEnginesFromLLMServices: (llmsSources: ReturnType<typeof useModelsStore.getState>['sources']) => boolean;
  syncMigrateLegacyElevenLabsStore: () => boolean;

}

type SpeexStore = SpeexStoreState & SpeexStoreActions;


export const useSpeexStore = create<SpeexStore>()(persist(
  (set, get) => ({

    // initial state
    engines: {},
    activeEngineId: null,
    hasInitializedLlms: false,
    hasMigratedElevenLabs: false,


    // Engine CRUD

    createEngine: (vendorType, partial) => {
      type TVt = typeof vendorType;
      const v = speexFindVendor(vendorType);
      if (!v) throw new Error(`Unknown engine type: ${vendorType}`);

      const engineId = agiUuidV4('speex.engine.instance');
      const now = Date.now();

      const engine = {
        engineId,
        vendorType,
        label: partial?.label ?? v.name,
        isAutoDetected: partial?.isAutoDetected ?? false,
        isAutoLinked: partial?.isAutoLinked ?? false,
        isDeleted: false,
        credentials: partial?.credentials ?? v.getDefaultCredentials(),
        voice: partial?.voice ?? v.getDefaultVoice(),
        createdAt: now,
        updatedAt: now,
      } as const satisfies DSpeexEngine<TVt>;

      // add the engine to the map
      set(state => ({ engines: { ...state.engines, [engineId]: engine as DSpeexEngineAny } }));
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
            } as DSpeexEngineAny,
          },
        };
      });
    },

    deleteEngine: (engineId) => {
      set(state => {
        const engine = state.engines[engineId];
        if (!engine) return state;

        // soft-delete for auto-detected engines
        if (engine.isAutoDetected)
          return {
            engines: { ...state.engines, [engineId]: { ...engine, isDeleted: true, updatedAt: Date.now() } },
            activeEngineId: state.activeEngineId === engineId ? null : state.activeEngineId,
          };

        // hard removal for user created engines
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


    // Auto-detections

    syncWebSpeechEngine: () => {
      if (!webspeechIsSupported()) return false;
      const { engines, createEngine, updateEngine } = get();

      // restore if soft-deleted
      for (const engineId in engines) {
        const engine = engines[engineId];
        if (engine.vendorType === 'webspeech') {
          if (engine.isDeleted) {
            updateEngine(engine.engineId, { isDeleted: false });
            return true;
          }
          return false;
        }
      }

      // otherwise create
      const engineId = createEngine('webspeech', {
        label: 'System Voice',
        isAutoDetected: true,
        isAutoLinked: false,
      });

      // deferred: heuristic to pick a best voice
      webspeechHBestVoiceDeferred((voiceURI) => {
        updateEngine(engineId, { voice: { dialect: 'webspeech', ttsVoiceURI: voiceURI } });
      });

      return true;
    },

    syncEnginesFromLLMServices: (llmsSources) => {
      const { engines, createEngine, updateEngine } = get();

      let hasChanges = false;
      const autoLinkedIds = new Set<SpeexEngineId>();

      // restore or create auto-linked engines
      for (const source of llmsSources) {
        const vendor = speexFindVendorForLLMVendor(source.vId);
        if (!vendor) continue;

        // check if we already have an auto-linked engine for this service
        let existing: DSpeexEngineAny | undefined;
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

      // the first time we migrate something, we mark as migrated
      if (hasChanges)
        set({ hasInitializedLlms: true });

      return hasChanges;
    },

    syncMigrateLegacyElevenLabsStore: () => {
      const { hasMigratedElevenLabs, engines, createEngine } = get();
      if (hasMigratedElevenLabs || typeof localStorage === 'undefined') return false;

      let hasChanges = false;
      try {
        const LEGACY_STORAGE_KEY = 'app-module-elevenlabs';
        const legacyStoreRaw = localStorage.getItem(LEGACY_STORAGE_KEY);

        // with legacy store
        if (legacyStoreRaw) {
          const legacyState = JSON.parse(legacyStoreRaw)?.state;
          const apiKey = legacyState?.elevenLabsApiKey;
          const voiceId = legacyState?.elevenLabsVoiceId;

          // with legacy key
          if (apiKey && typeof apiKey === 'string' && apiKey.trim().length > 0) {
            // check for existing engine with same API key
            let existingEngine: DSpeexEngineAny | undefined;
            for (const engineId in engines) {
              const e = engines[engineId];
              if (e.vendorType === 'elevenlabs' && e.credentials?.type === 'api-key' && e.credentials.apiKey === apiKey) {
                existingEngine = e;
                break;
              }
            }

            // with no existing engine
            if (!existingEngine) {
              hasChanges = true;
              createEngine('elevenlabs', {
                label: 'ElevenLabs', // (migrated) // no need as the user can't change..
                isAutoDetected: false,  // both false to make this delete-able
                isAutoLinked: false,    // both false
                credentials: { type: 'api-key', apiKey: apiKey.trim() },
                voice: {
                  dialect: 'elevenlabs',
                  ttsModel: SPEEX_DEFAULTS.ELEVENLABS_MODEL,
                  ttsVoiceId: (typeof voiceId === 'string' && voiceId.trim()) ? voiceId.trim() : SPEEX_DEFAULTS.ELEVENLABS_VOICE,
                },
              });
              console.log('[DEV] Speex: Migrated legacy ElevenLabs configuration');
            }
          }

          // optionally remove the old store data
          // localStorage.removeItem(LEGACY_ELEVENLABS_STORAGE_KEY);
        }
      } catch (error) {
        console.warn('[DEV] Speex: Failed to migrate legacy ElevenLabs store:', error);
      }

      // in any case mark as migrated
      set({ hasMigratedElevenLabs: true });
      return hasChanges;
    },

  }), {
    name: 'app-module-speex',
    version: 1,

    // Performs the business logic here
    onRehydrateStorage: () => (store) => {
      if (!store) return;

      // perform initial auto-detections & migrations
      store.syncWebSpeechEngine();

      if (!store.hasInitializedLlms)
        store.syncEnginesFromLLMServices(useModelsStore.getState().sources);

      if (!store.hasMigratedElevenLabs)
        store.syncMigrateLegacyElevenLabsStore();

      // perform sync on LLM services changes
      useModelsStore.subscribe((state, prevState) => {
        if (state.sources === prevState.sources) return;
        // with changes to the sources
        store.syncEnginesFromLLMServices(state.sources);
      });
    },
  },
));


// Hooks

export function useSpeexEngines(): DSpeexEngineAny[] {
  return useSpeexStore(useShallow(state => {
    // collect non-deleted engines and sort by createdAt, oldest first
    const result: DSpeexEngineAny[] = [];
    for (const engineId in state.engines) {
      const e = state.engines[engineId];
      if (!e.isDeleted) result.push(e);
    }
    return result.sort((a, b) => a.createdAt - b.createdAt);
  }));
}

export function useSpeexGlobalEngine(): DSpeexEngineAny | null {
  return useSpeexStore(speexFindGlobalEngine);
}

// export function useSpeexActiveEngineId() {
//   return useSpeexStore(state => state.activeEngineId);
// }


// Getters

// export function speexFindActiveEngine(): DSpeexEngineAny | null {
//   return speexFindEngineById(useSpeexStore.getState().activeEngineId, false);
// }

export function speexFindEngineById(engineId: SpeexEngineId | null, requireValidCredentials: boolean): DSpeexEngineAny | null {
  if (!engineId) return null;
  const { engines } = useSpeexStore.getState();
  const engine = engines[engineId];
  if (!engine || engine.isDeleted) return null;
  if (requireValidCredentials && !speexAreCredentialsValid(engine.credentials)) return null;
  return engine;
}

export function speexFindValidEngineByType(vendorType: DSpeexVendorType): DSpeexEngineAny | null {
  const { engines } = useSpeexStore.getState();
  for (const engineId in engines) {
    const engine = engines[engineId];
    if (engine.vendorType === vendorType && !engine.isDeleted && speexAreCredentialsValid(engine.credentials))
      return engine;
  }
  return null;
}


export function speexFindGlobalEngine({ engines, activeEngineId }: SpeexStore = useSpeexStore.getState()): DSpeexEngineAny | null {
  // A. return active engine (O(1) lookup)
  if (activeEngineId) {
    const active = engines[activeEngineId];
    // NOTE: if it's set, we don't further check, otherwise we risk overriding a user selection
    // if (active && !speexAreCredentialsValid(active.credentials))
    //   return false;
    if (active && !active.isDeleted) return active;
  }

  // B. rank available engines by vendor priority & availability of credentials
  const availableEngines: DSpeexEngineAny[] = [];
  for (const engineId in engines) {
    const e = engines[engineId];
    if (!e.isDeleted && speexAreCredentialsValid(e.credentials))
      availableEngines.push(e);
  }
  return speexFindByVendorPriorityAsc(availableEngines);
}


export function speexAreCredentialsValid(credentials: DSpeexCredentialsAny): boolean {
  switch (credentials.type) {
    case 'api-key':
      return !!credentials.apiKey || !!credentials.apiHost;

    case 'llms-service':
      // live-searches LLM services for presence
      const { sources: llmSources } = useModelsStore.getState();

      // resolve service
      const llmService = llmSources.find(s => s.id === credentials.serviceId);
      if (!llmService?.vId) return false;

      // resolve vendor
      const vendor = findModelVendor(llmService.vId);
      if (!vendor) return false;

      // is vendor client-side configured? great
      // const isClientSideConfigured = !!vendor.csfAvailable?.(llmService.setup);
      // if (isClientSideConfigured) return true;
      //
      // // is vendor server-side configured? great
      // return modelVendorHasCloudTenantConfiguration(vendor);

      // use CSF as a validator if available (e.g. validates the key presence)
      return !!vendor.csfAvailable?.(llmService.setup);

    case 'none':
      return true;
  }
}

