import type { ISpeexVendor } from '../ISpeexVendor';
import { SPEEX_DEFAULTS } from '../speex.config';


export const SpeexVendorGandr: ISpeexVendor<'gandr'> = {
  vendorType: 'gandr',
  name: 'Gandr',
  protocol: 'rpc',
  location: 'cloud',
  priority: 25,

  autoFromLlmVendorIds: undefined,

  capabilities: {
    streaming: true,
    voiceListing: true,   // static premade list, served through the RPC listVoices route (no API call)
    speedControl: false,
    pitchControl: false,
  },

  getDefaultCredentials: () => ({
    type: 'api-key',
    apiKey: '',
  }),

  getDefaultVoice: () => ({
    dialect: 'gandr',
    ttsModel: SPEEX_DEFAULTS.GANDR_MODEL,
    ttsVoiceId: SPEEX_DEFAULTS.GANDR_VOICE,
  }),
};
