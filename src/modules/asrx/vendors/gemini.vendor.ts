import type { DGeminiServiceSettings } from '~/modules/llms/vendors/gemini/gemini.vendor';
import { llmsIsNativeGeminiHost } from '~/modules/llms/shared/llm.isomorphic';

import type { IASRxVendor } from '../IASRxVendor';
import { ASRX_DEFAULTS } from '../asrx.config';


export const ASRxVendorGemini: IASRxVendor<'gemini'> = {
  vendorType: 'gemini',
  name: 'Gemini',
  protocols: new Set(['batch']),
  // above OpenAI: covers ~65-minute takes where OpenAI's endpoint caps at 25MB / 25 min;
  // below Deepgram, whose key is always an explicit ASR choice (no LLM auto-link source)
  priority: 15,

  // Auto-link: configured Gemini LLM service -> ASRx engine sharing the key
  autoFromLlmVendorIds: [
    'googleai',
  ],

  // Skip auto-link when geminiHost points away from Google (a proxy is unlikely to implement
  // the Interactions + Files APIs), or when the service has no client-side key: ASRx is
  // CSF-only, so a server-side env key is unreachable from the browser (see openai.vendor).
  shouldAutoLinkFromLLMSource: (source) => {
    const setup = source?.setup as Partial<DGeminiServiceSettings> | undefined;
    return !!setup?.geminiKey && llmsIsNativeGeminiHost(setup.geminiHost?.trim());
  },

  capabilities: {
    languageDetection: false, // auto-detects 85+ languages but never reports which (verified 2026-08-28)
    diarization: false,       // the API supports it (30-min cap, conflicts with vocabulary) - not exposed in v1
    interimResults: false,    // batch only ('-live' is a separate bidi model)
    wordTimestamps: false,    // word_info annotations exist upstream - no ASRx consumer, not exposed in v1
  },

  getDefaultCredentials: () => ({
    type: 'api-key',
    apiKey: '',
  }),

  getDefaultProfile: () => ({
    dialect: 'gemini',
    asrModel: ASRX_DEFAULTS.GEMINI_MODEL,
    mode: 'smart',
    // language: undefined -> auto-detect
  }),
};
