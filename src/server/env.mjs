import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {

    // Postgres, for optional storage via Prisma
    POSTGRES_PRISMA_URL: z.string().url().optional(),
    POSTGRES_URL_NON_POOLING: z.string().url().optional(),

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

    // LLM: Ollama
    OLLAMA_API_HOST: z.string().url().optional(),

    // LLM: OpenRouter
    OPENROUTER_API_KEY: z.string().optional(),

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
    
  },

  onValidationError: error => {
    console.error('❌ Invalid environment variables:', error.issues);
    throw new Error('Invalid environment variable');
  },

  // with Noext.JS >= 13.4.4 we'd only need to destructure client variables
  experimental__runtimeEnv: {},
});