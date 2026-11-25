import type { IASRxVendor } from '../IASRxVendor';


export const ASRxVendorAssemblyAI: IASRxVendor<'assemblyai'> = {
  vendorType: 'assemblyai',
  name: 'AssemblyAI',
  protocols: new Set(['batch']),
  priority: 25,

  // AssemblyAI is not an LLM service - no auto-link from LLM credentials
  autoFromLlmVendorIds: undefined,

  capabilities: {
    diarization: true,        // speaker labels move the take to Pre-recorded
    languageDetection: true,  // reported by Pre-recorded only (Sync and Dictation return no language)
    topicDetection: false,
    interimResults: false,    // batch only
    wordTimestamps: true,     // Pre-recorded
  },

  getDefaultCredentials: () => ({
    type: 'api-key',
    apiKey: '',
  }),

  getDefaultProfile: () => ({
    dialect: 'assemblyai',
    // no api: Auto
    // language: undefined -> auto-detect
  }),
};
