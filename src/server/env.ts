// noinspection ES6PreferShortImport - because the build would not find this file with ~/...
import { createEnv } from '../modules/3rdparty/t3-env';
import * as z from 'zod/v4';


// Helper to make some variables required only in production
const isProd = process.env.NODE_ENV === 'production' // True on Vercel and local builds, false on local dev
  && process.env.NEXT_PUBLIC_VERCEL_TARGET_ENV !== 'preview'; // False on Vercel dev-branch builds ('production' and 'staging' environments are treated as prod)
const requireOnProd = isProd ? z.string() : z.string().optional();


export const env = createEnv({

  /*
   * Serverside Environment variables, not available on the client.
   * Will throw if you access these variables on the client.
   */
  server: {

    // Backend Postgres, for optional storage via Prisma
    POSTGRES_PRISMA_URL: z.string().optional(),
    POSTGRES_URL_NON_POOLING: z.string().optional(),
    // Backend MongoDB, for a more complete developer data platform.
    MDB_URI: z.string().optional(),


    // LLM: OpenAI
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_API_HOST: z.url().optional(),
    OPENAI_API_ORG_ID: z.string().optional(),

    // LLM: Alibaba (OpenAI)
    ALIBABA_API_HOST: z.url().optional(),
    ALIBABA_API_KEY: z.string().optional(),

    // LLM: Azure OpenAI
    AZURE_OPENAI_API_ENDPOINT: z.url().optional(),
    AZURE_OPENAI_API_KEY: z.string().optional(),
    // The following do not need to be set
    AZURE_OPENAI_DISABLE_V1: z.string().optional(), // next-gen API is active by default, default: false
    AZURE_OPENAI_API_VERSION: z.string().optional(), // traditional API still used for non-response models, default: '2025-04-01-preview'
    AZURE_DEPLOYMENTS_API_VERSION: z.string().optional(), // default: '2023-03-15-preview'

    // LLM: Anthropic
    ANTHROPIC_API_KEY: z.string().optional(),
    ANTHROPIC_API_HOST: z.url().optional(),

    // LLM: Deepseek AI
    DEEPSEEK_API_KEY: z.string().optional(),

    // LLM: Google AI's Gemini
    GEMINI_API_KEY: z.string().optional(),

    // LLM: Groq
    GROQ_API_KEY: z.string().optional(),

    // LLM: LocalAI
    LOCALAI_API_HOST: z.url().optional(),
    LOCALAI_API_KEY: z.string().optional(),

    // LLM: Mistral
    MISTRAL_API_KEY: z.string().optional(),

    // LLM: Moonshot AI
    MOONSHOT_API_KEY: z.string().optional(),

    // LLM: Ollama
    OLLAMA_API_HOST: z.url().optional(),

    // LLM: OpenPipe
    OPENPIPE_API_KEY: z.string().optional(),

    // LLM: OpenRouter
    OPENROUTER_API_KEY: z.string().optional(),

    // LLM: Perplexity
    PERPLEXITY_API_KEY: z.string().optional(),

    // LLM: Together AI
    TOGETHERAI_API_KEY: z.string().optional(),

    // LLM: xAI
    XAI_API_KEY: z.string().optional(),


    // Helicone - works on both OpenAI and Anthropic vendors
    HELICONE_API_KEY: z.string().optional(),


    // Browsing Service
    PUPPETEER_WSS_ENDPOINT: z.url().optional(),

    // Google Custom Search
    GOOGLE_CLOUD_API_KEY: z.string().optional(),
    GOOGLE_CSE_ID: z.string().optional(),


    // Text-To-Speech: ElevenLabs - speech.ts
    ELEVENLABS_API_KEY: z.string().optional(),
    ELEVENLABS_API_HOST: z.url().optional(),
    ELEVENLABS_VOICE_ID: z.string().optional(),


    // Backend: HTTP Basic Authentication
    HTTP_BASIC_AUTH_USERNAME: z.string().optional(),
    HTTP_BASIC_AUTH_PASSWORD: z.string().optional(),

    // Build-time configuration (ignore)
    BIG_AGI_BUILD: z.enum(['standalone', 'static']).optional(),

  },

  /*
   * Environment variables available on the client (and server).
   * You'll get type errors if these are not prefixed with NEXT_PUBLIC_.
   *
   * NOTE: they must be set at build time, not runtime(!)
   */
  client: {

    // Frontend: Google Analytics GA4 Measurement ID
    NEXT_PUBLIC_GA4_MEASUREMENT_ID: z.string().optional(),

    // Frontend: server to use for PlantUML rendering
    NEXT_PUBLIC_PLANTUML_SERVER_URL: z.url().optional(),

  },

  // matches user expectations - see https://github.com/enricoros/big-AGI/issues/279
  emptyStringAsUndefined: true,

  // with Noext.JS >= 13.4.4 we'd only need to destructure client variables
  experimental__runtimeEnv: {
    NEXT_PUBLIC_GA4_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID,
    NEXT_PUBLIC_PLANTUML_SERVER_URL: process.env.NEXT_PUBLIC_PLANTUML_SERVER_URL,
  },
});

/**
 * Dummy function to validate any build-time environment variables.
 * Does nothing really, but forces the creation of the `env` object.
 *
 * At runtime the `env` object is actually used.
 */
export function verifyBuildTimeVars(): number {
  return Object.keys(env).length;
}
