import type { ISpeexVendor } from './ISpeexVendor';


export const SpeexVendorLocalAI: ISpeexVendor<'localai'> = {
  vendorType: 'localai',
  name: 'LocalAI',
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
    vendorType: 'localai',
    ttsModel: undefined, // depends on what's installed
    voiceId: undefined,
  }),
};
