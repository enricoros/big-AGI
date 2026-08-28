// configuration
export const ASRX_DEBUG = false;


// default profile parameters for each vendor
export const ASRX_DEFAULTS = {

  // Deepgram - nova-3 is current flagship, multi language auto-detects 10+ common languages
  DEEPGRAM_MODEL: 'nova-3',
  DEEPGRAM_LANGUAGE: 'multi',
  DEEPGRAM_HOST: 'https://api.deepgram.com',
  // topics noise floor (no wire-side threshold exists): Deepgram emits sub-1% guesses next to real detections (observed: 0.93 vs 0.005)
  DEEPGRAM_TOPICS_MIN_CONFIDENCE: 0.4,
  // one label per detection span: when a segment carries multiple topics, keep only the top-scoring one
  DEEPGRAM_TOPICS_BEST_PER_SEGMENT: true,

  // Gemini - gemini-3.5-transcribe (2026-08), Interactions API; audio bills at 25 tok/s -> the
  // 98,304-token input cap is ~65 minutes (over-cap fails with a generic 'Invalid input received.')
  // (no GEMINI_HOST here: the default host lives in the shared geminiAccess)
  GEMINI_MODEL: 'gemini-3.5-transcribe',
  // inline base64 ceiling (~2 min at 128kbps) - larger audio uploads raw bytes via the Files API
  GEMINI_INLINE_MAX_BYTES: 2 * 1024 * 1024,

  // OpenAI - gpt-transcribe (2026-07) is the newest dedicated STT model, cheaper than gpt-4o-transcribe
  OPENAI_MODEL: 'gpt-transcribe',
  OPENAI_HOST: 'https://api.openai.com',

} as const;
