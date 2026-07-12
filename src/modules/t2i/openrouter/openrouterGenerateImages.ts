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
  const transportAccess = findServiceAccessOrThrow<{}, OpenAIAccessSchema>(modelServiceIdForAccess).transportAccess;

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

  // Generate a single image per request. Most OpenRouter image models only support n=1
  // (all Gemini/FLUX/MAI/Riverflow models cap at 1), so we fan out `count` parallel
  // single-image requests rather than relying on `n` - same approach the DALL·E 3 path uses.
  async function generateSingleImage(): Promise<T2iCreateImageOutput[]> {
    throwIfAborted(); // Check before starting

    // we use an async generator to stream heartbeat events while waiting for the image
    const operations = await apiStream.llmOpenAI.dialectOpenRouter_createImages.mutate({
      access: transportAccess,
      generationConfig: {
        model: orImageModelId,
        prompt,
        count: 1,
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
      throw error; // Re-throw non-abort errors
    }

    return createdImages;
  }

  // Run all single-image requests in parallel and handle all results
  const batchResults = await Promise.allSettled(Array.from({ length: count }, () => generateSingleImage()));

  // Throw if ALL requests were rejected
  const allRejected = batchResults.every(result => result.status === 'rejected');
  if (allRejected) {

    // preserve the abort nature if the first rejection was an abort
    const firstError = (batchResults.find(result => result.status === 'rejected') as PromiseRejectedResult | undefined)?.reason;
    if (firstError?.name === 'AbortError')
      throw firstError;

    // surface the server error message(s) if available
    const errorMessages = batchResults
      .map(result => {
        const reason = (result as PromiseRejectedResult).reason as any; // TRPCClientError<TRPCErrorShape>
        return reason?.shape?.message || reason?.message || '';
      })
      .filter(message => !!message)
      .join(', ');
    throw new Error(`OpenRouter image generation: ${errorMessages || 'Unknown error'}`);
  }

  // Take successful results and return as a flat array
  return batchResults
    .filter(result => result.status === 'fulfilled')
    .map(result => (result as PromiseFulfilledResult<T2iCreateImageOutput[]>).value)
    .flat();
}
