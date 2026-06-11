import type { IASRxVendor } from '../IASRxVendor';
import { ASRX_DEFAULTS } from '../asrx.config';


export const ASRxVendorDeepgram: IASRxVendor<'deepgram'> = {
  vendorType: 'deepgram',
  name: 'Deepgram',
  protocols: new Set(['batch', 'realtime']),
  priority: 10,

  // Deepgram is not an LLM service - no auto-link from LLM credentials
  autoFromLlmVendorIds: undefined,

  capabilities: {
    languageDetection: true,
    diarization: true,
    interimResults: true,   // available via WebSocket realtime (future)
    wordTimestamps: true,
  },

  getDefaultCredentials: () => ({
    type: 'api-key',
    apiKey: '',
  }),

  getDefaultProfile: () => ({
    dialect: 'deepgram',
    asrModel: ASRX_DEFAULTS.DEEPGRAM_MODEL,
    language: ASRX_DEFAULTS.DEEPGRAM_LANGUAGE,
    smartFormat: true,
  }),
};
