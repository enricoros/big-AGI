import { create } from 'zustand';
import { shallow } from 'zustand/shallow';


export interface BackendCapabilities {
  hasDB: boolean;
  hasBrowsing: boolean;
  hasGoogleCustomSearch: boolean;
  hasImagingProdia: boolean;
  hasLlmAnthropic: boolean;
  hasLlmAzureOpenAI: boolean;
  hasLlmMistral: boolean;
  hasLlmOllama: boolean;
  hasLlmOpenAI: boolean;
  hasLlmOpenRouter: boolean;
  hasVoiceElevenLabs: boolean;
}

type BackendStore = {
  loadedCapabilities: boolean;
  setCapabilities: (capabilities: Partial<BackendCapabilities>) => void;
} & BackendCapabilities;

const useBackendStore = create<BackendStore>()(
  (set) => ({

    // capabilities
    hasDB: false,
    hasBrowsing: false,
    hasGoogleCustomSearch: false,
    hasImagingProdia: false,
    hasLlmAnthropic: false,
    hasLlmAzureOpenAI: false,
    hasLlmMistral: false,
    hasLlmOllama: false,
    hasLlmOpenAI: false,
    hasLlmOpenRouter: false,
    hasVoiceElevenLabs: false,

    loadedCapabilities: false,
    setCapabilities: (capabilities: Partial<BackendCapabilities>) =>
      set({
        loadedCapabilities: true,
        ...capabilities,
      }),

  }),
);


export function useBackendCapsLoader(): [boolean, (capabilities: Partial<BackendCapabilities>) => void] {
  return useBackendStore(state => [state.loadedCapabilities, state.setCapabilities], shallow);
}

export function backendCaps(): BackendCapabilities {
  return useBackendStore.getState();
}
