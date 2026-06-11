import type { DOpenAIServiceSettings } from '~/modules/llms/vendors/openai/openai.vendor';
import { llmsIsNativeOpenAIHost } from '~/modules/llms/shared/llm.isomorphic';

import type { IASRxVendor } from '../IASRxVendor';
import { ASRX_DEFAULTS } from '../asrx.config';


export const ASRxVendorOpenAI: IASRxVendor<'openai'> = {
  vendorType: 'openai',
  name: 'OpenAI',
  protocols: new Set(['batch']),
  priority: 20,

  // Auto-link: configured OpenAI LLM service -> ASRx engine sharing the key
  autoFromLlmVendorIds: [
    'openai',
  ],

  // Skip auto-link when oaiHost is set to a non-OpenAI endpoint. OpenAI-compatible
  // proxies (ChutesAI, MiniMax, self-hosted, ...) advertise the chat/completions
  // surface but usually don't implement /v1/audio/transcriptions. Users wanting
  // transcription against a proxy can still add a manual OpenAI engine.
  shouldAutoLinkFromLLMSource: (source) => {
    return llmsIsNativeOpenAIHost((source?.setup as Partial<DOpenAIServiceSettings> | undefined)?.oaiHost?.trim());
  },

  capabilities: {
    languageDetection: false, // whisper auto-detects but the simple response doesn't return it
    diarization: false,
    interimResults: false,    // batch only
    wordTimestamps: true,     // via verbose_json response_format (whisper-1)
  },

  getDefaultCredentials: () => ({
    type: 'api-key',
    apiKey: '',
  }),

  getDefaultProfile: () => ({
    dialect: 'openai',
    asrModel: ASRX_DEFAULTS.OPENAI_MODEL,
    // language: undefined -> auto-detect
  }),
};
