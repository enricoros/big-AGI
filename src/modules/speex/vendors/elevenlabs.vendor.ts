import type { ISpeexVendor } from '../ISpeexVendor';


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
    vendorType: 'elevenlabs',
    ttsModel: 'eleven_multilingual_v2', // best for mixed/non-English; user can switch to turbo for English-only
    ttsVoiceId: undefined, // will use API default
  }),
};
