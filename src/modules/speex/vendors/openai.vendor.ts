import type { ISpeexVendor } from '../ISpeexVendor';
import { SPEEX_DEFAULTS } from '../speex.config';


export const SpeexVendorOpenAI: ISpeexVendor<'openai'> = {
  vendorType: 'openai',
  name: 'OpenAI',
  protocol: 'rpc',
  location: 'cloud',
  priority: 30,

  autoFromLlmVendorIds: [
    // NOTE: azure not tested yet
    // 'azure',    // have ModelVendorId 'azure' also map to OpenAI TTS
    'openai',   // default OpenAI mapping, note that this is
    // more.. ?
  ],

  capabilities: {
    streaming: true,
    voiceListing: false, // hardcoded voice list
    speedControl: true,
    pitchControl: false,
  },

  getDefaultCredentials: () => ({
    type: 'api-key',
    apiKey: '',
  }),

  getDefaultVoice: () => ({
    dialect: 'openai',
    ttsModel: SPEEX_DEFAULTS.OPENAI_MODEL,
    ttsVoiceId: SPEEX_DEFAULTS.OPENAI_VOICE,
    ttsSpeed: 1.0,
  }),
};
