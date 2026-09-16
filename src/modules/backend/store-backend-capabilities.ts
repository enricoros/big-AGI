import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

/*
 NOTE: this file is used IN THE FRONTEND - it's meant to be telling the frontend what the backend capabilities are.
 NOTE: this file is also used in the BACKEND for type safety of the returned payload.
 */

/**
 * Legacy server conf: the flat flags a server reports about the keys and features it holds (env vars).
 * The cloud branch calls this shape legacy too, superseded there by the tenant configuration; clients
 * read it through the ServerConf seam (src/common/app.serverconf.ts), never directly.
 */
export interface LegacyServerConf {
  // llms
  hasLlmAlibaba: boolean;
  hasLlmAnthropic: boolean;
  hasLlmAzureOpenAI: boolean;
  hasLlmBedrock: boolean;
  hasLlmDeepseek: boolean;
  hasLlmGemini: boolean;
  hasLlmGroq: boolean;
  hasLlmLocalAIHost: boolean;
  hasLlmLocalAIKey: boolean;
  hasLlmMistral: boolean;
  hasLlmMoonshot: boolean;
  hasLlmNvidiaNIM: boolean;
  hasLlmOllama: boolean;
  hasLlmOpenAI: boolean;
  hasLlmOpenRouter: boolean;
  hasLlmPerplexity: boolean;
  hasLlmTogetherAI: boolean;
  hasLlmXAI: boolean;
  // others
  hasDB: boolean;
  hasBrowsing: boolean;
  hasGoogleCustomSearch: boolean;
  hasVoiceElevenLabs: boolean;
}

/** The capabilities payload of the backend router: the legacy server conf, plus what the client boot gate needs. */
export interface BackendCapabilities extends LegacyServerConf {
  // hashes - TODO(2026-11): remove, unread since LLM-Defs (per-vendor defsV), kept for pre-LLM-Defs clients
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
    hasLlmAlibaba: false,
    hasLlmAnthropic: false,
    hasLlmBedrock: false,
    hasLlmAzureOpenAI: false,
    hasLlmDeepseek: false,
    hasLlmGemini: false,
    hasLlmGroq: false,
    hasLlmLocalAIHost: false,
    hasLlmLocalAIKey: false,
    hasLlmMistral: false,
    hasLlmMoonshot: false,
    hasLlmNvidiaNIM: false,
    hasLlmOllama: false,
    hasLlmOpenAI: false,
    hasLlmOpenRouter: false,
    hasLlmPerplexity: false,
    hasLlmTogetherAI: false,
    hasLlmXAI: false,
    hasDB: false,
    hasBrowsing: false,
    hasGoogleCustomSearch: false,
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
