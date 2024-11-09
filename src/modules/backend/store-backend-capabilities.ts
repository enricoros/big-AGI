import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

/*
 NOTE: this file is used IN THE FRONTEND - it's meant to be telling the frontend what the backend capabilities are.
 NOTE: this file is also used in the BACKEND for type safety of the returned payload.
 */

export interface BackendCapabilities {
  // llms
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
  hasLlmOpenPipe: boolean;
  hasLlmOpenRouter: boolean;
  hasLlmPerplexity: boolean;
  hasLlmTogetherAI: boolean;
  hasLlmXAI: boolean;
  // others
  hasDB: boolean;
  hasBrowsing: boolean;
  hasGoogleCustomSearch: boolean;
  hasImagingProdia: boolean;
  hasVoiceElevenLabs: boolean;
  // hashes
  hashLlmReconfig: string;
  // build data
  build?: {
    gitSha?: string;
    pkgVersion?: string;
    timestamp?: string;
  };
}

interface BackendStore extends BackendCapabilities {
  _loadedCapabilities: boolean;
  setCapabilities: (capabilities: Partial<BackendCapabilities>) => void;
}

const useBackendCapabilitiesStore = create<BackendStore>()(
  (set) => ({

    // initial values
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
    hasLlmOpenPipe: false,
    hasLlmOpenRouter: false,
    hasLlmPerplexity: false,
    hasLlmTogetherAI: false,
    hasLlmXAI: false,
    hasDB: false,
    hasBrowsing: false,
    hasGoogleCustomSearch: false,
    hasImagingProdia: false,
    hasVoiceElevenLabs: false,
    hashLlmReconfig: '',
    build: undefined,
    _loadedCapabilities: false,

    setCapabilities: (capabilities: Partial<BackendCapabilities>) =>
      set({
        ...capabilities,
        _loadedCapabilities: true,
      }),

  }),
);


export function useKnowledgeOfBackendCaps(): [boolean, (capabilities: Partial<BackendCapabilities>) => void] {
  return useBackendCapabilitiesStore(useShallow(state => [state._loadedCapabilities, state.setCapabilities]));
}

export function getBackendCapabilities(): BackendCapabilities {
  return useBackendCapabilitiesStore.getState();
}
