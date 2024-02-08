import { createTRPCRouter } from './trpc.server';

import { backendRouter } from '~/modules/backend/backend.router';
import { elevenlabsRouter } from '~/modules/elevenlabs/elevenlabs.router';
import { googleSearchRouter } from '~/modules/google/search.router';
import { llmAnthropicRouter } from '~/modules/llms/server/anthropic/anthropic.router';
import { llmGeminiRouter } from '~/modules/llms/server/gemini/gemini.router';
import { llmOllamaRouter } from '~/modules/llms/server/ollama/ollama.router';
import { llmOpenAIRouter } from '~/modules/llms/server/openai/openai.router';
import { prodiaRouter } from '~/modules/t2i/prodia/prodia.router';
import { youtubeRouter } from '~/modules/youtube/youtube.router';

/**
 * Primary rooter, and will be sitting on an Edge Runtime.
 */
export const appRouterEdge = createTRPCRouter({
  backend: backendRouter,
  elevenlabs: elevenlabsRouter,
  googleSearch: googleSearchRouter,
  llmAnthropic: llmAnthropicRouter,
  llmGemini: llmGeminiRouter,
  llmOllama: llmOllamaRouter,
  llmOpenAI: llmOpenAIRouter,
  prodia: prodiaRouter,
  youtube: youtubeRouter,
});

// export type definition of API
export type AppRouterEdge = typeof appRouterEdge;