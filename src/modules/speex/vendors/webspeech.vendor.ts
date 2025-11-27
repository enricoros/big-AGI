import type { ISpeexVendor } from '../ISpeexVendor';


export const SpeexVendorWebSpeech: ISpeexVendor<'webspeech'> = {
  vendorType: 'webspeech',
  name: 'System Voice',
  protocol: 'webspeech',
  location: 'browser',
  priority: 100, // lowest priority, fallback

  // not linked to any LLM service
  autoFromLlmVendorIds: undefined,

  capabilities: {
    streaming: false, // browser API doesn't stream chunks
    voiceListing: true, // can list browser voices
    speedControl: true,
    pitchControl: true,
  },

  getDefaultCredentials: () => ({
    type: 'none',
  }),

  getDefaultVoice: () => ({
    dialect: 'webspeech',
    ttsVoiceURI: undefined, // will use browser default
    ttsSpeed: 1.0,
    ttsPitch: 1.0,
  }),
};
