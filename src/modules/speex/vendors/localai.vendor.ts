import type { ISpeexVendor } from '../ISpeexVendor';
import { SPEEX_DEFAULTS } from '../speex.config';


/**
 * LocalAI TTS Vendor
 *
 * LocalAI supports multiple TTS backends: coqui, bark, piper, transformers-musicgen, vall-e-x.
 * When no backend is specified, LocalAI uses its default configuration.
 *
 * Default recommendation: Use 'kokoro' model without specifying a backend for the best
 * out-of-the-box experience with high-quality neural TTS.
 *
 * @see https://localai.io/features/text-to-audio/
 */
export const SpeexVendorLocalAI: ISpeexVendor<'localai'> = {
  vendorType: 'localai',
  name: 'LocalAI',
  protocol: 'rpc',
  location: 'local',
  priority: 20,

  autoFromLlmVendorIds: [
    'localai', // scans store-llms for pre-configured credentials of this type
  ],

  capabilities: {
    streaming: true,
    voiceListing: true, // can query available models
    speedControl: false,
    pitchControl: false,
  },

  getDefaultCredentials: () => ({
    type: 'api-key',
    apiKey: '',
    apiHost: 'http://localhost:8080',
  }),

  getDefaultVoice: () => ({
    dialect: 'localai',
    ttsBackend: undefined,
    ttsModel: SPEEX_DEFAULTS.LOCALAI_MODEL,
    ttsLanguage: undefined,
  }),
};
