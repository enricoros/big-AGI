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

  // OpenAI - gpt-4o-transcribe is newer, higher quality than whisper-1
  OPENAI_MODEL: 'gpt-4o-transcribe',
  OPENAI_HOST: 'https://api.openai.com',

} as const;
