// configuration
export const SPEEX_DEBUG = false;

export const SPEEX_PREVIEW_TEXT = 'Hello, this is my voice.';
export const SPEEX_PREVIEW_STREAM = true; // default: true, whether to use streaming - this is for debugging

// default voice parameters for each vendor
export const SPEEX_DEFAULTS = {

  // OpenAI TTS - gpt-4o-mini-tts is recommended: cheap, fast, expressive with instruction support
  OPENAI_MODEL: 'gpt-4o-mini-tts',
  OPENAI_VOICE: 'alloy',

  // ElevenLabs - eleven_multilingual_v2 is best for mixed/non-English content
  ELEVENLABS_MODEL: 'eleven_multilingual_v2',
  ELEVENLABS_MODEL_FAST: 'eleven_turbo_v2_5', // fastest, English-optimized
  ELEVENLABS_VOICE: '21m00Tcm4TlvDq8ikWAM', // Rachel - Conversational
  // alternatives:
  // - XrExE9yKIg1WjnnlVkGX: Matilda - Informative
  // - SAz9YHcvj6GT2YYXdXww: River - Conversational

  // LocalAI - kokoro is a high-quality neural TTS
  LOCALAI_MODEL: 'kokoro',

} as const;