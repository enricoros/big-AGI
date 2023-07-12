import { createTRPCRouter } from './trpc.server';

import { elevenlabsRouter } from '~/modules/elevenlabs/elevenlabs.router';
import { googleSearchRouter } from '~/modules/google/search.router';
import { llmAnthropicRouter } from '~/modules/llms/anthropic/anthropic.router';
import { llmOpenAIRouter } from '~/modules/llms/openai/openai.router';
import { prodiaRouter } from '~/modules/prodia/prodia.router';
import { publishRouter } from '~/modules/publish/publish.router';

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  elevenlabs: elevenlabsRouter,
  googleSearch: googleSearchRouter,
  llmAnthropic: llmAnthropicRouter,
  llmOpenAI: llmOpenAIRouter,
  prodia: prodiaRouter,
  publish: publishRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;