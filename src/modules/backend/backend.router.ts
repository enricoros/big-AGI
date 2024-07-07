import { z } from 'zod';

import type { BackendCapabilities } from '~/modules/backend/store-backend-capabilities';

import { createTRPCRouter, publicProcedure } from '~/server/api/trpc.server';
import { env } from '~/server/env.mjs';
import { fetchJsonOrTRPCError } from '~/server/api/trpc.router.fetchers';

import { analyticsListCapabilities } from './backend.analytics';


function sdbmHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = char + (hash << 6) + (hash << 16) - hash;
  }
  // Convert to unsigned 32-bit integer and then to hex string
  return (hash >>> 0).toString(16);
}

function generateLlmEnvConfigHash(env: Record<string, unknown>): string {
  return sdbmHash(Object.keys(env)
    .filter(key => !!env[key]) // remove empty
    .filter(key => key.includes('_API_')) // only include API keys
    .sort() // ignore order
    .map(key => `${key}=${env[key]}`)
    .join(';'),
  );
}


/**
 * This is the primary router for the backend. Mainly, this deals with letting
 * the frontend know what capabilities are available, by virtue of being
 * pre-configured in the servr. In the future this will evolve to a better
 * server-side configuration system.
 */
export const backendRouter = createTRPCRouter({

  /* List server-side capabilities (pre-configured by the deployer) */
  listCapabilities: publicProcedure
    .query(async ({ ctx }): Promise<BackendCapabilities> => {
      analyticsListCapabilities(ctx.hostName);
      return {
        hasDB: (!!env.MDB_URI) || (!!env.POSTGRES_PRISMA_URL && !!env.POSTGRES_URL_NON_POOLING),
        hasBrowsing: !!env.PUPPETEER_WSS_ENDPOINT,
        hasGoogleCustomSearch: !!env.GOOGLE_CSE_ID && !!env.GOOGLE_CLOUD_API_KEY,
        hasImagingProdia: !!env.PRODIA_API_KEY,
        hasLlmAnthropic: !!env.ANTHROPIC_API_KEY,
        hasLlmAzureOpenAI: !!env.AZURE_OPENAI_API_KEY && !!env.AZURE_OPENAI_API_ENDPOINT,
        hasLlmDeepseek: !!env.DEEPSEEK_API_KEY,
        hasLlmGemini: !!env.GEMINI_API_KEY,
        hasLlmGroq: !!env.GROQ_API_KEY,
        hasLlmLocalAIHost: !!env.LOCALAI_API_HOST,
        hasLlmLocalAIKey: !!env.LOCALAI_API_KEY,
        hasLlmMistral: !!env.MISTRAL_API_KEY,
        hasLlmOllama: !!env.OLLAMA_API_HOST,
        hasLlmOpenAI: !!env.OPENAI_API_KEY || !!env.OPENAI_API_HOST,
        hasLlmOpenRouter: !!env.OPENROUTER_API_KEY,
        hasLlmPerplexity: !!env.PERPLEXITY_API_KEY,
        hasLlmTogetherAI: !!env.TOGETHERAI_API_KEY,
        hasVoiceElevenLabs: !!env.ELEVENLABS_API_KEY,
        llmConfigHash: generateLlmEnvConfigHash(env),
      };
    }),


  // The following are used for various OAuth integrations

  /* Exchange the OpenrRouter 'code' (from PKCS) for an OpenRouter API Key */
  exchangeOpenRouterKey: publicProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ input }) => {
      // Documented here: https://openrouter.ai/docs#oauth
      return await fetchJsonOrTRPCError<{ key: string }, { code: string }>('https://openrouter.ai/api/v1/auth/keys', 'POST', {}, {
        code: input.code,
      }, 'Backend.exchangeOpenRouterKey');
    }),

});
