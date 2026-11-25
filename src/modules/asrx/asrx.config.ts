// configuration
export const ASRX_DEBUG = false;


// default profile parameters for each vendor
export const ASRX_DEFAULTS = {

  // AssemblyAI - three APIs on one key, picked per take (see the batch adapter); hosts per data zone
  ASSEMBLYAI_HOSTS: {
    default: { sync: 'https://sync.assemblyai.com', dictation: 'https://dictation.assemblyai.com', prerecorded: 'https://api.assemblyai.com' },
    us: { sync: 'https://sync.us.assemblyai.com', dictation: 'https://dictation.us.assemblyai.com', prerecorded: 'https://api.assemblyai.com' },
    eu: { sync: 'https://sync.eu.assemblyai.com', dictation: 'https://dictation.eu.assemblyai.com', prerecorded: 'https://api.eu.assemblyai.com' },
  },
  ASSEMBLYAI_SYNC_MODEL: 'universal-3-6-pro',
  // Pre-recorded: STT-3.7 runs wherever it can, Universal-2 takes the languages outside its 32
  ASSEMBLYAI_PRERECORDED_MODELS: ['assemblyai-stt-3-7', 'universal-2'],
  // Sync and Dictation answer 413 past 20 minutes
  ASSEMBLYAI_SHORT_MAX_MS: 20 * 60 * 1000,

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

// pinnable models per vendor: a profile without one is Auto (the defaults above, resolved per call), and a stored
// model missing here (retired) resolves as Auto too - see modelPickOrAuto
export const ASRX_MODELS = {
  deepgram: ['nova-3', 'nova-2'],
  gemini: ['gemini-3.5-transcribe'],
  openai: ['gpt-transcribe', 'gpt-4o-transcribe', 'gpt-4o-mini-transcribe', 'whisper-1'],
} as const;


// engine test: a clip of known text goes through the engine, the transcript is graded against the text (asrx.engine-test.ts).
// The clips are fetched on click, never bundled. Recorded with Gemini TTS gemini-3.8-flash-tts, voice kore, the input
// spelled 'Big A-G-I' so the letters are spoken; leveled to -20 dBFS speech RMS, Opus 24 kbps mono in Ogg.
export const ASRX_TEST_CLIPS = [
  {
    url: '/audio/asrx-test-known-universe.ogg',
    mimeType: 'audio/ogg',
    text: 'Big-AGI is the best AI workspace in the known universe, and your transcription engine just agreed with me, word for word.',
  },
  {
    url: '/audio/asrx-test-loud-and-clear.ogg',
    mimeType: 'audio/ogg',
    text: 'Hello from Big-AGI. If you can read this, your transcription engine heard me loud and clear. Now go beam something brilliant.',
  },
] as const;

// share of the clip's words an engine may get wrong and still pass: 2 slips in a 21-word clip
export const ASRX_TEST_MAX_WORD_ERROR = 0.1;
