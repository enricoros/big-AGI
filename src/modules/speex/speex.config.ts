import type { LlmsGeminiModelId } from '~/modules/llms/server/gemini/gemini.models';


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

  // Gemini - 3.8 Flash TTS (130+ languages) over generateContent; voices from the Voice Library (GET /v1beta/voices)
  GEMINI_MODEL: 'gemini-3.8-flash-tts',           // quality
  GEMINI_MODEL_FAST: 'gemini-3.8-flash-lite-tts', // faster, cheaper, 100+ languages
  GEMINI_VOICE: 'kore',                           // multilingual 'Firm' voice - the Voice Library lists the 30 classic voices lowercase

  // Inworld - high-quality, low-latency TTS with voice cloning
  INWORLD_MODEL: 'inworld-tts-1.5-max',       // best quality (~200ms latency, $10/1M chars)
  INWORLD_MODEL_FAST: 'inworld-tts-1.5-mini', // fastest (<100ms latency, $5/1M chars)
  INWORLD_VOICE: 'Alex',                      // default voice
  INWORLD_TTS_MAX_LEN: 2000,                  // max chars per TTS request - as of 2026-01-27 it's 2000

} as const;

// Gemini model names as defined in gemini.models.ts (without the 'models/' prefix) - type only, the defs stay out of the client bundle
type _GeminiModelName = LlmsGeminiModelId extends `models/${infer TName}` ? TName : never;

// pinnable models per vendor: a voice without one is Auto (the defaults above, resolved per call), and a stored
// model missing here (retired) resolves as Auto too - see modelPickOrAuto
export const SPEEX_MODELS = {
  elevenlabs: ['eleven_multilingual_v2', 'eleven_turbo_v2_5', 'eleven_flash_v2_5', 'eleven_v3'],
  gemini: ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'] as const satisfies readonly _GeminiModelName[], // Gemini model defs: dropping one there fails here
  inworld: ['inworld-tts-1.5-max', 'inworld-tts-1.5-mini'],
  openai: ['gpt-4o-mini-tts', 'tts-1', 'tts-1-hd'],
} as const;

// the model Auto plays for normal reading, per vendor - the pickers show it, and a saved model equal to it counts as the default
export const SPEEX_AUTO_MODELS = {
  elevenlabs: SPEEX_DEFAULTS.ELEVENLABS_MODEL,
  gemini: SPEEX_DEFAULTS.GEMINI_MODEL,
  inworld: SPEEX_DEFAULTS.INWORLD_MODEL,
  openai: SPEEX_DEFAULTS.OPENAI_MODEL,
} as const satisfies { [TVendor in keyof typeof SPEEX_MODELS]: typeof SPEEX_MODELS[TVendor][number] };