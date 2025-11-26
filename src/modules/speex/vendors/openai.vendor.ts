import type { ISpeexVendor } from './ISpeexVendor';


// -- Hardcoded OpenAI TTS info --

export const OPENAI_TTS_MODELS = [
  { id: 'tts-1', name: 'TTS-1', description: 'Standard quality, lower latency' },
  { id: 'tts-1-hd', name: 'TTS-1 HD', description: 'Higher quality' },
] as const;

export const OPENAI_TTS_VOICES = [
  { id: 'alloy', name: 'Alloy', description: 'Neutral and balanced' },
  { id: 'ash', name: 'Ash', description: 'Warm and engaging' },
  { id: 'coral', name: 'Coral', description: 'Warm and friendly' },
  { id: 'echo', name: 'Echo', description: 'Clear and resonant' },
  { id: 'fable', name: 'Fable', description: 'Expressive and dynamic' },
  { id: 'onyx', name: 'Onyx', description: 'Deep and authoritative' },
  { id: 'nova', name: 'Nova', description: 'Friendly and upbeat' },
  { id: 'sage', name: 'Sage', description: 'Calm and wise' },
  { id: 'shimmer', name: 'Shimmer', description: 'Clear and bright' },
] as const;


export const SpeexVendorOpenAI: ISpeexVendor<'openai'> = {
  vendorType: 'openai',
  name: 'OpenAI',
  location: 'cloud',
  priority: 30,

  autoFromLlmVendorIds: [
    'azure',    // have ModelVendorId 'azure' also map to OpenAI TTS
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
    vendorType: 'openai',
    ttsModel: 'tts-1',
    voiceId: 'alloy',
    speed: 1.0,
  }),
};
