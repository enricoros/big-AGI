import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

import { agiUuidV4 } from '~/common/util/idUtils';
import { useModelsStore } from '~/common/stores/llms/store-llms';

import type { DSpeexCredentials, DSpeexEngine, DSpeexEngineAny, SpeexEngineId, SpeexVendorType } from './speex.types';
import { isWebSpeechSupported } from './vendors/webspeech.client';
import { speexFindByVendorPriorityAsc, speexFindVendor, speexFindVendorForLLMVendor } from './speex.vendors-registry';


interface SpeexStoreState {

  // TODO: convert this to a map (using the engineId as key) and haven 'updatedAt' timestamps for implicit sorting (to replace the array order)
  engines: DSpeexEngineAny[];
  activeEngineId: SpeexEngineId | null;

}

interface SpeexStoreActions {

  // engine CRUD
  createEngine: <TVt extends SpeexVendorType>(vendorType: TVt, partial?: Partial<DSpeexEngine<TVt>>) => SpeexEngineId;
  updateEngine: (engineId: SpeexEngineId, partial: Partial<DSpeexEngineAny>) => void;
  deleteEngine: (engineId: SpeexEngineId) => void;

  // selection
  setActiveEngineId: (engineId: SpeexEngineId | null) => void;

  // auto-detection
  syncWebSpeechEngine: () => void;
  syncEnginesFromLLMServices: () => void;

}


export const useSpeexStore = create<SpeexStoreState & SpeexStoreActions>()(persist(
  (set, get) => ({

    // initial state - TODO: convert to map
    engines: [],
    activeEngineId: null,


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
      if (!isWebSpeechSupported()) return;

      const { engines, createEngine, updateEngine } = get();

      // restore if soft-deleted
      const existing = engines.find(e => e.vendorType === 'webspeech');
      if (existing?.isDeleted)
        return updateEngine(existing.engineId, { isDeleted: false });

      // otherwise create
      createEngine('webspeech', {
        label: 'System Voice',
        isAutoDetected: true,
        isAutoLinked: false, // not linked to LLM service
      });
    },

    syncEnginesFromLLMServices: () => {
      const { createEngine, engines, updateEngine } = get();
      const { sources: llmSources } = useModelsStore.getState() || [];

      const autoLinkedIds = new Set<SpeexEngineId>();

      // restore or create auto-linked engines
      for (const source of llmSources) {
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
          if (existing.isDeleted)
            updateEngine(existing.engineId, { isDeleted: false });
          autoLinkedIds.add(existing.engineId);
          continue;
        }

        // non-existing: create
        const engineId = createEngine(vendor.vendorType, {
          label: `${vendor.name} (${source.label})`,
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
        if (engine.isAutoLinked && !autoLinkedIds.has(engine.engineId) && !engine.isDeleted)
          updateEngine(engine.engineId, { isDeleted: true });
    },

  }),
  {
    name: 'app-module-speex',
    version: 1,
  },
));


// Hooks

export function useSpeexEngines() {
  return useSpeexStore(useShallow(state => state.engines.filter(e => !e.isDeleted)));
}

export function useSpeexActiveEngineId() {
  return useSpeexStore(state => state.activeEngineId);
}


// Getters

export function speexFindActiveEngine(): DSpeexEngineAny | null {
  return speexFindEngineById(useSpeexStore.getState().activeEngineId);
}

export function speexFindEngineById(engineId: SpeexEngineId | null): DSpeexEngineAny | null {
  if (!engineId) return null;
  const { engines } = useSpeexStore.getState();
  return engines.find(e => e.engineId === engineId && !e.isDeleted) || null;
}

export function speexFindValidEngineByType(vendorType: SpeexVendorType): DSpeexEngineAny | null {
  const { engines } = useSpeexStore.getState();
  for (const engine of engines)
    if (engine.vendorType === vendorType && !engine.isDeleted && speexAreCredentialsValid(engine.credentials))
      return engine;
  return null;
}

export function speexFindGlobalEngine(): DSpeexEngineAny | null {
  const { engines, activeEngineId } = useSpeexStore.getState();

  // A. return active engine
  if (activeEngineId) {
    const active = engines.find(e => e.engineId === activeEngineId && !e.isDeleted);
    if (active) return active;
  }

  // B. rank available engines by vendor priority
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
      const llmService = llmSources.find(s => s.id === credentials.serviceId);
      // NOTE: does not further validate the LLM Service's configuration, maybe in the future, but now now
      return !!llmService; // ok if present

    case 'none':
      return true;
  }
}

