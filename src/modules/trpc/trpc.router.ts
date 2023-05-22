import { createTRPCRouter } from './trpc.server';

import { elevenlabsRouter } from '~/modules/elevenlabs/elevenlabs.router';
import { googleSearchRouter } from '~/modules/google/search.router';
import { openAIRouter } from '~/modules/llms/openai/openai.router';
import { prodiaRouter } from '~/modules/prodia/prodia.router';

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  elevenlabs: elevenlabsRouter,
  googleSearch: googleSearchRouter,
  openai: openAIRouter,
  prodia: prodiaRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;