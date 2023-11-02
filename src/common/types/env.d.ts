// noinspection JSUnusedGlobalSymbols

/** Keep this file in sync with docs/environment-variables.md */

declare namespace NodeJS {

  // available to the server-side
  interface ProcessEnv {

    // Postgres, for optional storage via Prisma
    POSTGRES_PRISMA_URL?: string;
    POSTGRES_URL_NON_POOLING?: string;

    // LLM: OpenAI
    OPENAI_API_KEY: string;
    OPENAI_API_HOST: string;
    OPENAI_API_ORG_ID: string;

    // LLM: Azure OpenAI
    AZURE_OPENAI_API_ENDPOINT: string;
    AZURE_OPENAI_API_KEY: string;

    // LLM: Anthropic
    ANTHROPIC_API_KEY?: string;
    ANTHROPIC_API_HOST?: string;

    // LLM: Ollama
    OLLAMA_API_HOST?: string;

    // LLM: OpenRouter
    OPENROUTER_API_KEY: string;

    // Helicone - works on both OpenAI and Anthropic vendors
    HELICONE_API_KEY?: string;

    // ElevenLabs - speech.ts
    ELEVENLABS_API_KEY: string;
    ELEVENLABS_API_HOST: string;
    ELEVENLABS_VOICE_ID: string;

    // Google Custom Search
    GOOGLE_CLOUD_API_KEY: string;
    GOOGLE_CSE_ID: string;

    // Prodia
    PRODIA_API_KEY: string;

  }

  interface ProcessEnv {

    // set in next.config.js and available to the client-side
    HAS_SERVER_DB_PRISMA: boolean;
    HAS_SERVER_KEYS_GOOGLE_CSE: boolean;
    HAS_SERVER_KEY_ANTHROPIC?: boolean;
    HAS_SERVER_KEY_AZURE_OPENAI?: boolean;
    HAS_SERVER_KEY_ELEVENLABS: boolean;
    HAS_SERVER_HOST_OLLAMA?: boolean;
    HAS_SERVER_KEY_OPENAI?: boolean;
    HAS_SERVER_KEY_OPENROUTER?: boolean;
    HAS_SERVER_KEY_PRODIA: boolean;

  }
}
