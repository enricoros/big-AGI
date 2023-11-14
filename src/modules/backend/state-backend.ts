import { create } from 'zustand';
import { shallow } from 'zustand/shallow';


export interface BackendCapabilities {
  hasDB: boolean;
  hasGoogleCustomSearch: boolean;
  hasImagingProdia: boolean;
  hasLlmAnthropic: boolean;
  hasLlmAzureOpenAI: boolean;
  hasLlmOllama: boolean;
  hasLlmOpenAI: boolean;
  hasLlmOpenRouter: boolean;
  hasVoiceElevenLabs: boolean;
}

type BackendState = {
  loadedCapabilities: boolean;
  setCapabilities: (capabilities: Partial<BackendCapabilities>) => void;
} & BackendCapabilities;

const useBackendStore = create<BackendState>()(
  (set) => ({

    // capabilities
    hasDB: false,
    hasGoogleCustomSearch: false,
    hasImagingProdia: false,
    hasLlmAnthropic: false,
    hasLlmAzureOpenAI: false,
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


export function useBackendCapabilitiesLoader(): [boolean, (capabilities: Partial<BackendCapabilities>) => void] {
  return useBackendStore(state => [state.loadedCapabilities, state.setCapabilities], shallow);
}

// export function backendCapabilities(): BackendCapabilities {
//   return useBackendStore.getState();
// }
