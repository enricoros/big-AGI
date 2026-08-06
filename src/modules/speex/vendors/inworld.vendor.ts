import type { ISpeexVendor } from '../ISpeexVendor';
import { SPEEX_DEFAULTS } from '../speex.config';


export const SpeexVendorInworld: ISpeexVendor<'inworld'> = {
  vendorType: 'inworld',
  name: 'Inworld',
  protocol: 'rpc',
  location: 'cloud',
  priority: 15, // between ElevenLabs (10) and LocalAI (20)

  autoFromLlmVendorIds: undefined,

  capabilities: {
    streaming: true,
    voiceListing: true,
    speedControl: true,
    pitchControl: false,
  },

  getDefaultCredentials: () => ({
    type: 'api-key',
    apiKey: '',
  }),

  getDefaultVoice: () => ({
    dialect: 'inworld',
    ttsModel: SPEEX_DEFAULTS.INWORLD_MODEL,
    ttsVoiceId: SPEEX_DEFAULTS.INWORLD_VOICE,
  }),
};
