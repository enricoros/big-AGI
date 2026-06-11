// configuration
export const ASRX_DEBUG = false;


// default profile parameters for each vendor
export const ASRX_DEFAULTS = {

  // Deepgram - nova-3 is current flagship, multi language auto-detects 10+ common languages
  DEEPGRAM_MODEL: 'nova-3',
  DEEPGRAM_LANGUAGE: 'multi',
  DEEPGRAM_HOST: 'https://api.deepgram.com',

  // OpenAI - gpt-4o-transcribe is newer, higher quality than whisper-1
  OPENAI_MODEL: 'gpt-4o-transcribe',
  OPENAI_HOST: 'https://api.openai.com',

} as const;
