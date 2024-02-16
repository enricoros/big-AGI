import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {

    // Backend Postgres, for optional storage via Prisma
    POSTGRES_PRISMA_URL: z.string().optional(),
    POSTGRES_URL_NON_POOLING: z.string().optional(),
    // Backend MongoDB, for a more complete developer data platform.
    MDB_URI: z.string().optional(),

    // LLM: OpenAI
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_API_HOST: z.string().url().optional(),
    OPENAI_API_ORG_ID: z.string().optional(),

    // LLM: Azure OpenAI
    AZURE_OPENAI_API_ENDPOINT: z.string().url().optional(),
    AZURE_OPENAI_API_KEY: z.string().optional(),

    // LLM: Anthropic
    ANTHROPIC_API_KEY: z.string().optional(),
    ANTHROPIC_API_HOST: z.string().url().optional(),

    // LLM: Google AI's Gemini
    GEMINI_API_KEY: z.string().optional(),

    // LLM: Mistral
    MISTRAL_API_KEY: z.string().optional(),

    // LLM: Ollama
    OLLAMA_API_HOST: z.string().url().optional(),

    // LLM: OpenRouter
    OPENROUTER_API_KEY: z.string().optional(),

    // LLM: Perplexity
    PERPLEXITY_API_KEY: z.string().optional(),

    // LLM: Toghether AI
    TOGETHERAI_API_KEY: z.string().optional(),

    // Helicone - works on both OpenAI and Anthropic vendors
    HELICONE_API_KEY: z.string().optional(),

    // ElevenLabs - speech.ts
    ELEVENLABS_API_KEY: z.string().optional(),
    ELEVENLABS_API_HOST: z.string().url().optional(),
    ELEVENLABS_VOICE_ID: z.string().optional(),

    // Prodia
    PRODIA_API_KEY: z.string().optional(),

    // Google Custom Search
    GOOGLE_CLOUD_API_KEY: z.string().optional(),
    GOOGLE_CSE_ID: z.string().optional(),

    // Browsing Service
    PUPPETEER_WSS_ENDPOINT: z.string().url().optional(),

    // Backend: Analytics flags (e.g. which hostname responds) for managed installs
    BACKEND_ANALYTICS: z.string().optional().transform(list => (list || '').split(';').filter(flag => !!flag)),

    // Backend: HTTP Basic Authentication
    HTTP_BASIC_AUTH_USERNAME: z.string().optional(),
    HTTP_BASIC_AUTH_PASSWORD: z.string().optional(),

  },

  onValidationError: error => {
    console.error('❌ Invalid environment variables:', error.issues);
    throw new Error('Invalid environment variable');
  },

  // matches user expectations - see https://github.com/enricoros/big-AGI/issues/279
  emptyStringAsUndefined: true,

  // with Noext.JS >= 13.4.4 we'd only need to destructure client variables
  experimental__runtimeEnv: {},
});
