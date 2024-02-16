import { create } from 'zustand';
import { shallow } from 'zustand/shallow';

/*
 NOTE: this file is used IN THE FRONTEND - it's meant to be telling the frontend what the backend capabilities are.
 */

export interface BackendCapabilities {
  hasDB: boolean;
  hasBrowsing: boolean;
  hasGoogleCustomSearch: boolean;
  hasImagingProdia: boolean;
  hasLlmAnthropic: boolean;
  hasLlmAzureOpenAI: boolean;
  hasLlmGemini: boolean;
  hasLlmMistral: boolean;
  hasLlmOllama: boolean;
  hasLlmOpenAI: boolean;
  hasLlmOpenRouter: boolean;
  hasLlmPerplexity: boolean;
  hasLlmTogetherAI: boolean;
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
    hasLlmGemini: false,
    hasLlmMistral: false,
    hasLlmOllama: false,
    hasLlmOpenAI: false,
    hasLlmOpenRouter: false,
    hasLlmPerplexity: false,
    hasLlmTogetherAI: false,
    hasVoiceElevenLabs: false,

    loadedCapabilities: false,
    setCapabilities: (capabilities: Partial<BackendCapabilities>) =>
      set({
        loadedCapabilities: true,
        ...capabilities,
      }),

  }),
);


export function useBackendCapsKnowledge(): [boolean, (capabilities: Partial<BackendCapabilities>) => void] {
  return useBackendStore(state => [state.loadedCapabilities, state.setCapabilities], shallow);
}

export function backendCaps(): BackendCapabilities {
  return useBackendStore.getState();
}
