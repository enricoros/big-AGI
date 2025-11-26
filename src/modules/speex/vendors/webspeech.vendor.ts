import type { ISpeexVendor } from './ISpeexVendor';


export const SpeexVendorWebSpeech: ISpeexVendor<'webspeech'> = {
  vendorType: 'webspeech',
  name: 'System Voice',
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
    vendorType: 'webspeech',
    ttsVoiceURI: undefined, // will use browser default
    rate: 1.0,
    pitch: 1.0,
  }),
};
