import type { DGeminiServiceSettings } from '~/modules/llms/vendors/gemini/gemini.vendor';
import { llmsIsNativeGeminiHost } from '~/modules/llms/shared/llm.isomorphic';

import type { ISpeexVendor } from '../ISpeexVendor';
import { SPEEX_DEFAULTS } from '../speex.config';


export const SpeexVendorGemini: ISpeexVendor<'gemini'> = {
  vendorType: 'gemini',
  name: 'Gemini',
  protocol: 'rpc',
  location: 'cloud',
  priority: 35, // below OpenAI (30): auto-linking a Gemini service must not change an existing default engine

  autoFromLlmVendorIds: [
    'googleai',
  ],

  // auto-link only the native Gemini API, not Gemini-compatible proxies (unlikely to serve TTS + the Voice Library);
  // no client key required: synthesis also runs server-side, where geminiAccess falls back to the env key
  shouldAutoLinkFromLLMSource: (source) => {
    return llmsIsNativeGeminiHost((source?.setup as Partial<DGeminiServiceSettings> | undefined)?.geminiHost?.trim());
  },

  capabilities: {
    streaming: false, // streams headerless L16 PCM, which the MSE live player (MP3) cannot take - whole WAV per chunk
    voiceListing: true,
    speedControl: false,
    pitchControl: false,
  },

  getDefaultCredentials: () => ({
    type: 'api-key',
    apiKey: '',
  }),

  getDefaultVoice: () => ({
    dialect: 'gemini',
    // no ttsModel: Auto
    ttsVoiceId: SPEEX_DEFAULTS.GEMINI_VOICE,
  }),
};
