import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

/*
 NOTE: this file is used IN THE FRONTEND - it's meant to be telling the frontend what the backend capabilities are.
 NOTE: this file is also used in the BACKEND for type safety of the returned payload.
 */

export interface BackendCapabilities {
  hasDB: boolean;
  hasBrowsing: boolean;
  hasGoogleCustomSearch: boolean;
  hasImagingProdia: boolean;
  hasLlmAnthropic: boolean;
  hasLlmAzureOpenAI: boolean;
  hasLlmDeepseek: boolean;
  hasLlmGemini: boolean;
  hasLlmGroq: boolean;
  hasLlmLocalAIHost: boolean;
  hasLlmLocalAIKey: boolean;
  hasLlmMistral: boolean;
  hasLlmOllama: boolean;
  hasLlmOpenAI: boolean;
  hasLlmOpenRouter: boolean;
  hasLlmPerplexity: boolean;
  hasLlmTogetherAI: boolean;
  hasVoiceElevenLabs: boolean;
  llmConfigHash: string;
}

interface BackendStore extends BackendCapabilities {
  loadedCapabilities: boolean;
  setCapabilities: (capabilities: Partial<BackendCapabilities>) => void;
}

const useBackendCapabilitiesStore = create<BackendStore>()(
  (set) => ({

    // capabilities
    hasDB: false,
    hasBrowsing: false,
    hasGoogleCustomSearch: false,
    hasImagingProdia: false,
    hasLlmAnthropic: false,
    hasLlmAzureOpenAI: false,
    hasLlmDeepseek: false,
    hasLlmGemini: false,
    hasLlmGroq: false,
    hasLlmLocalAIHost: false,
    hasLlmLocalAIKey: false,
    hasLlmMistral: false,
    hasLlmOllama: false,
    hasLlmOpenAI: false,
    hasLlmOpenRouter: false,
    hasLlmPerplexity: false,
    hasLlmTogetherAI: false,
    hasVoiceElevenLabs: false,
    llmConfigHash: '',

    loadedCapabilities: false,
    setCapabilities: (capabilities: Partial<BackendCapabilities>) =>
      set({
        loadedCapabilities: true,
        ...capabilities,
      }),

  }),
);


export function useKnowledgeOfBackendCaps(): [boolean, (capabilities: Partial<BackendCapabilities>) => void] {
  return useBackendCapabilitiesStore(useShallow(state => [state.loadedCapabilities, state.setCapabilities]));
}

export function getBackendCapabilities(): BackendCapabilities {
  return useBackendCapabilitiesStore.getState();
}
