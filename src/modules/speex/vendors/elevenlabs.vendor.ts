import type { ISpeexVendor } from '../ISpeexVendor';
import { SPEEX_DEFAULTS } from '../speex.config';


export const SpeexVendorElevenLabs: ISpeexVendor<'elevenlabs'> = {
  vendorType: 'elevenlabs',
  name: 'ElevenLabs',
  protocol: 'rpc',
  location: 'cloud',
  priority: 10,

  autoFromLlmVendorIds: undefined,

  capabilities: {
    streaming: true,
    voiceListing: true,
    speedControl: false,
    pitchControl: false,
  },

  getDefaultCredentials: () => ({
    type: 'api-key',
    apiKey: '',
  }),

  getDefaultVoice: () => ({
    dialect: 'elevenlabs',
    ttsModel: SPEEX_DEFAULTS.ELEVENLABS_MODEL,
    ttsVoiceId: SPEEX_DEFAULTS.ELEVENLABS_VOICE,
  }),
};
