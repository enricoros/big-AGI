import type { ISpeexVendor } from './ISpeexVendor';


export const SpeexVendorElevenLabs: ISpeexVendor<'elevenlabs'> = {
  vendorType: 'elevenlabs',
  name: 'ElevenLabs',
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
    ttsModel: 'eleven_turbo_v2_5',
    voiceId: undefined, // will use API default
  }),
};
