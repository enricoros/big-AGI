import type { IASRxVendor } from '../IASRxVendor';


export const ASRxVendorAssemblyAI: IASRxVendor<'assemblyai'> = {
  vendorType: 'assemblyai',
  name: 'AssemblyAI',
  protocols: new Set(['batch']),
  // last: the Dictation API caps at 20 minutes, so it must never be auto-picked over an engine without the cap
  priority: 25,

  // AssemblyAI is not an LLM service - no auto-link from LLM credentials
  autoFromLlmVendorIds: undefined,

  capabilities: {
    diarization: false,       // no speaker labels
    languageDetection: false, // 32 languages, auto-steered when unset, but the response reports none
    topicDetection: false,
    interimResults: false,    // batch only ('/v1/transcribe/live' uploads while recording, no interim results)
    wordTimestamps: false,    // words[] carries text + confidence, no times
  },

  getDefaultCredentials: () => ({
    type: 'api-key',
    apiKey: '',
  }),

  getDefaultProfile: () => ({
    dialect: 'assemblyai',
    mode: 'smart',
    // rewriteMode: undefined -> fast
    // language: undefined -> no steering
  }),
};
