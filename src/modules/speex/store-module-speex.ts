import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

import { findModelVendor } from '~/modules/llms/vendors/vendors.registry';

import { agiUuidV4 } from '~/common/util/idUtils';
import { useModelsStore } from '~/common/stores/llms/store-llms';

import type { DSpeexCredentials, DSpeexEngine, DSpeexEngineAny, DSpeexVendorType, SpeexEngineId } from './speex.types';
import { speexFindByVendorPriorityAsc, speexFindVendor, speexFindVendorForLLMVendor } from './speex.vendors-registry';
import { webspeechIsSupported } from './protocols/webspeech/webspeech.client';


interface SpeexStoreState {

  // TODO: convert this to a map (using the engineId as key) and haven 'updatedAt' timestamps for implicit sorting (to replace the array order)
  engines: DSpeexEngineAny[];
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

    // initial state - TODO: convert to map
    engines: [],
    activeEngineId: null,
    hasInitializedLlms: false,
    hasMigratedElevenLabs: false,


    // Engine CRUD

    createEngine: (vendorType, partial) => {
      type TVt = typeof vendorType;
      const v = speexFindVendor(vendorType);
      if (!v) throw new Error(`Unknown engine type: ${vendorType}`);

      const engineId = agiUuidV4('speex.engine.instance');

      const engine = {
        engineId,
        vendorType,
        label: partial?.label ?? v.name,
        isAutoDetected: partial?.isAutoDetected ?? false,
        isAutoLinked: partial?.isAutoLinked ?? false,
        isDeleted: false,
        credentials: partial?.credentials ?? v.getDefaultCredentials(),
        voice: partial?.voice ?? v.getDefaultVoice(),
      } as const satisfies DSpeexEngine<TVt>;

      // append the engine
      set(state => ({ engines: [...state.engines, engine as DSpeexEngineAny] }));
      return engineId;
    },

    updateEngine: (engineId, partial) => {
      set(state => ({
        engines: state.engines.map(e =>
          e.engineId !== engineId ? e : { ...e, ...partial } as DSpeexEngineAny,
        ),
      }));
    },

    deleteEngine: (engineId) => {
      set(state => {
        const engine = state.engines.find(e => e.engineId === engineId);
        if (!engine) return state;

        // soft-delete for auto-detected engines, hard delete for user-created ones
        return {
          engines: engine.isAutoDetected
            ? state.engines.map(e => e.engineId !== engineId ? e : { ...e, isDeleted: true })
            : state.engines.filter(e => e.engineId !== engineId),
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
      const existing = engines.find(e => e.vendorType === 'webspeech');
      if (existing) {
        if (existing.isDeleted) {
          updateEngine(existing.engineId, { isDeleted: false });
          return true;
        }
        return false;
      }

      // otherwise create
      createEngine('webspeech', {
        label: 'System Voice',
        isAutoDetected: true,
        isAutoLinked: false, // not linked to LLM service
      });

      // TODO - FUTURE: if we're here we may also decide to fetch voices, and choose a good default one for WebSpeech?

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
        const existing = engines.find(e =>
          e.isAutoLinked &&
          e.credentials?.type === 'llms-service' &&
          e.credentials.serviceId === source.id,
        );

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
      for (const engine of engines)
        if (engine.isAutoLinked && !autoLinkedIds.has(engine.engineId) && !engine.isDeleted) {
          hasChanges = true;
          updateEngine(engine.engineId, { isDeleted: true });
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
            const existingEngine = engines.find(e =>
              e.vendorType === 'elevenlabs' &&
              e.credentials?.type === 'api-key' &&
              e.credentials.apiKey === apiKey,
            );

            // with no existing engine
            if (!existingEngine) {
              hasChanges = true;
              createEngine('elevenlabs', {
                label: 'ElevenLabs (migrated)',
                isAutoDetected: true,
                isAutoLinked: false,
                credentials: { type: 'api-key', apiKey: apiKey.trim() },
                voice: { dialect: 'elevenlabs', ttsModel: 'eleven_multilingual_v2', ttsVoiceId: voiceId || undefined },
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

export function useSpeexEngines() {
  return useSpeexStore(useShallow(state => state.engines.filter(e => !e.isDeleted)));
}

export function useSpeexGlobalEngine(): DSpeexEngineAny | null {
  return useSpeexStore(speexFindGlobalEngine);
}

// export function useSpeexActiveEngineId() {
//   return useSpeexStore(state => state.activeEngineId);
// }


// Getters

export function speexFindActiveEngine(): DSpeexEngineAny | null {
  return speexFindEngineById(useSpeexStore.getState().activeEngineId);
}

export function speexFindEngineById(engineId: SpeexEngineId | null): DSpeexEngineAny | null {
  if (!engineId) return null;
  const { engines } = useSpeexStore.getState();
  return engines.find(e => e.engineId === engineId && !e.isDeleted) || null;
}

export function speexFindValidEngineByType(vendorType: DSpeexVendorType): DSpeexEngineAny | null {
  const { engines } = useSpeexStore.getState();
  for (const engine of engines)
    if (engine.vendorType === vendorType && !engine.isDeleted && speexAreCredentialsValid(engine.credentials))
      return engine;
  return null;
}


export function speexFindGlobalEngine({ engines, activeEngineId }: SpeexStore = useSpeexStore.getState()): DSpeexEngineAny | null {
  // A. return active engine
  if (activeEngineId) {
    const active = engines.find(e => e.engineId === activeEngineId && !e.isDeleted);
    // NOTE: if it's set, we don't further check, otherwise we risk overriding a user selection
    // if (active && !speexAreCredentialsValid(active.credentials))
    //   return false;
    if (active) return active;
  }

  // B. rank available engines by vendor priority & availability of credentials
  const availableEngines = engines.filter(e => !e.isDeleted && speexAreCredentialsValid(e.credentials));
  return speexFindByVendorPriorityAsc(availableEngines);
}


export function speexAreCredentialsValid(credentials: DSpeexCredentials): boolean {
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

