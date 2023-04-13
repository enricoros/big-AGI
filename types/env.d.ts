// noinspection JSUnusedGlobalSymbols

declare namespace NodeJS {

  // available to the server-side
  interface ProcessEnv {

    // OpenAI - chat.ts
    OPENAI_API_KEY: string;
    OPENAI_API_HOST: string;
    OPENAI_API_ORG_ID: string;

    // ElevenLabs - speech.ts
    ELEVENLABS_API_KEY: string;
    ELEVENLABS_API_HOST: string;
    ELEVENLABS_VOICE_ID: string;

  }

  interface ProcessEnv {

    // set in next.config.js and available to the client-side
    HAS_SERVER_KEY_OPENAI: boolean;
    HAS_SERVER_KEY_ELEVENLABS: boolean;

  }
}
