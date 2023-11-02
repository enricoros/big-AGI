import { createTRPCRouter } from './trpc.server';

import { elevenlabsRouter } from '~/modules/elevenlabs/elevenlabs.router';
import { googleSearchRouter } from '~/modules/google/search.router';
import { llmAnthropicRouter } from '~/modules/llms/transports/server/anthropic/anthropic.router';
import { llmOllamaRouter } from '~/modules/llms/transports/server/ollama/ollama.router';
import { llmOpenAIRouter } from '~/modules/llms/transports/server/openai/openai.router';
import { prodiaRouter } from '~/modules/prodia/prodia.router';
import { tradeRouter } from '../../apps/chat/trade/server/trade.router';
import { ytPersonaRouter } from '../../apps/personas/ytpersona.router';

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouterEdge = createTRPCRouter({
  elevenlabs: elevenlabsRouter,
  googleSearch: googleSearchRouter,
  llmAnthropic: llmAnthropicRouter,
  llmOllama: llmOllamaRouter,
  llmOpenAI: llmOpenAIRouter,
  prodia: prodiaRouter,
  ytpersona: ytPersonaRouter,
});

export const appRouterNode = createTRPCRouter({
  trade: tradeRouter,
});

// export type definition of API
export type AppRouterEdge = typeof appRouterEdge;
export type AppRouterNode = typeof appRouterNode;