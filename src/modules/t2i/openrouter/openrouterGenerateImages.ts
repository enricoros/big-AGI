import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { apiStream } from '~/common/util/trpc.client';

import type { OpenAIAccessSchema } from '~/modules/llms/server/openai/openai.access';
import { findServiceAccessOrThrow } from '~/modules/llms/vendors/vendor.helpers';

import type { T2iCreateImageOutput, T2iGenerateOptions } from '../t2i.server';
import { useOpenRouterT2IStore } from './store-module-openrouter';


/**
 * Client function to call the OpenRouter image generation API (dedicated /api/v1/images endpoint).
 */
export async function openRouterGenerateImagesOrThrow(
  modelServiceIdForAccess: DModelsServiceId,
  prompt: string,
  count: number,
  { abortSignal }: T2iGenerateOptions = {},
): Promise<T2iCreateImageOutput[]> {

  // Use the current settings
  const { orImageModelId } = useOpenRouterT2IStore.getState();

  // helper to check for abort conditions and throw consistent error
  function throwIfAborted(error?: any) {
    if (abortSignal?.aborted ||
      error?.name === 'AbortError' ||
      error?.message?.includes('aborted') ||
      error?.message?.includes('BodyStreamBuffer was aborted')) {
      const abortError = new Error('Image generation was cancelled');
      abortError.name = 'AbortError';
      throw abortError;
    }
  }

  throwIfAborted(); // Check before starting

  // we use an async generator to stream heartbeat events while waiting for the images
  const operations = await apiStream.llmOpenAI.dialectOpenRouter_createImages.mutate({
    access: findServiceAccessOrThrow<{}, OpenAIAccessSchema>(modelServiceIdForAccess).transportAccess,
    generationConfig: {
      model: orImageModelId,
      prompt,
      count,
    },
  }, {
    signal: abortSignal, // aborts the tRPC request
  });

  const createdImages: T2iCreateImageOutput[] = [];
  try {
    for await (const op of operations) {
      throwIfAborted(); // Check during iteration
      if (op.p === 'createImage')
        createdImages.push(op.image);
    }
  } catch (error: any) {
    throwIfAborted(error);
    // surface the server error message if available
    const message = error?.shape?.message || error?.message || '';
    throw new Error(`OpenRouter image generation: ${message || 'Unknown error'}`);
  }

  return createdImages;
}
