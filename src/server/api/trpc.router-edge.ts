import { createTRPCRouter } from './trpc.server';

import { backendRouter } from '~/modules/backend/backend.router';
import { elevenlabsRouter } from '~/modules/elevenlabs/elevenlabs.router';
import { googleSearchRouter } from '~/modules/google/search.router';
import { llmAnthropicRouter } from '~/modules/llms/transports/server/anthropic/anthropic.router';
import { llmOllamaRouter } from '~/modules/llms/transports/server/ollama/ollama.router';
import { llmOpenAIRouter } from '~/modules/llms/transports/server/openai/openai.router';
import { prodiaRouter } from '~/modules/prodia/prodia.router';
import { ytPersonaRouter } from '../../apps/personas/ytpersona.router';

/**
 * Primary rooter, and will be sitting on an Edge Runtime.
 */
export const appRouterEdge = createTRPCRouter({
  backend: backendRouter,
  elevenlabs: elevenlabsRouter,
  googleSearch: googleSearchRouter,
  llmAnthropic: llmAnthropicRouter,
  llmOllama: llmOllamaRouter,
  llmOpenAI: llmOpenAIRouter,
  prodia: prodiaRouter,
  ytpersona: ytPersonaRouter,
});

// export type definition of API
export type AppRouterEdge = typeof appRouterEdge;