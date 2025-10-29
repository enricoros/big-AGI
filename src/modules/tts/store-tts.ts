//
// WARNING: Everything here is data at rest. Know what you're doing.
//

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { ITTSVendor } from './ITTSVendor';
import type { DTTSService, TTSServiceId, TTSVendorId } from './tts.types';


/// TTSStore - a store for configured TTS services and settings

export interface TTSStoreState {
  // TTS services (configured instances of TTS vendors)
  services: DTTSService<any>[];

  // Global active service and voice
  activeServiceId: TTSServiceId | null;
  activeVoiceId: string | null;
}

interface TTSStoreActions {
  // Service management
  createService: (vendor: ITTSVendor) => DTTSService;
  removeService: (id: TTSServiceId) => void;
  updateServiceSettings: <TServiceSettings>(id: TTSServiceId, partialSettings: Partial<TServiceSettings>) => void;

  // Active selection
  setActiveServiceId: (id: TTSServiceId | null) => void;
  setActiveVoiceId: (voiceId: string | null) => void;
}


type TTSStore = TTSStoreState & TTSStoreActions;


export const useTTSStore = create<TTSStore>()(persist(
  (set, get) => ({

    // Initial state
    services: [],
    activeServiceId: null,
    activeVoiceId: null,

    // Actions

    createService: (vendor: ITTSVendor) => {
      const service: DTTSService = {
        id: `${vendor.id}-${Date.now()}`,
        label: vendor.name,
        vId: vendor.id,
        setup: vendor.initializeSetup?.() || {},
      };

      set(state => ({
        services: [...state.services, service],
      }));

      return service;
    },

    removeService: (id: TTSServiceId) =>
      set(state => {
        const newServices = state.services.filter(s => s.id !== id);
        return {
          services: newServices,
          // Clear active service if it was removed
          activeServiceId: state.activeServiceId === id ? null : state.activeServiceId,
        };
      }),

    updateServiceSettings: <TServiceSettings>(id: TTSServiceId, partialSettings: Partial<TServiceSettings>) =>
      set(state => ({
        services: state.services.map(service =>
          service.id === id
            ? { ...service, setup: { ...service.setup, ...partialSettings } }
            : service,
        ),
      })),

    setActiveServiceId: (id: TTSServiceId | null) =>
      set({ activeServiceId: id }),

    setActiveVoiceId: (voiceId: string | null) =>
      set({ activeVoiceId: voiceId }),

  }),
  {
    name: 'app-tts',
  }),
));


// Helper functions for accessing TTS store

export function getTTSStoreState(): TTSStoreState {
  return useTTSStore.getState();
}

export function getTTSService(serviceId: TTSServiceId): DTTSService | null {
  const { services } = useTTSStore.getState();
  return services.find(s => s.id === serviceId) || null;
}

export function getActiveTTSService(): DTTSService | null {
  const { services, activeServiceId } = useTTSStore.getState();
  if (!activeServiceId) return null;
  return services.find(s => s.id === activeServiceId) || null;
}
