import type { AixParts_InlineImagePart } from '~/modules/aix/server/api/aix.wiretypes';
import type { DGeminiServiceSettings } from '~/modules/llms/vendors/gemini/gemini.vendor';
import type { GeminiAccessSchema } from '~/modules/llms/server/gemini/gemini.access';
import { findServiceAccessOrThrow } from '~/modules/llms/vendors/vendor.helpers';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { apiStream } from '~/common/util/trpc.client';

// IMPORTANT: Import TYPE (!)
import type { T2iCreateImageOutput, T2iGenerateOptions } from '../t2i.server';
import type { DProfileGeminiImages } from '../t2i.types';
import { geminiImageResolveForGeneration } from './geminiImageModels';


/**
 * Client function to generate (or edit, with reference images) images with the Gemini Nano Banana models.
 * Server-routed (geminiRouter.createImages), so a server-side GEMINI_API_KEY works too.
 */
export async function geminiGenerateImagesOrThrow(
  modelServiceIdForAccess: DModelsServiceId,
  profile: DProfileGeminiImages,
  prompt: string,
  aixInlineImageParts: AixParts_InlineImagePart[],
  count: number,
  { t2iContextName, agiProfilePic, abortSignal }: T2iGenerateOptions,
): Promise<T2iCreateImageOutput[]> {

  // resolve the model and the profile options it accepts
  const { model, aspectRatio, imageSize } = geminiImageResolveForGeneration(modelServiceIdForAccess, profile);
  const transportAccess = findServiceAccessOrThrow<DGeminiServiceSettings, GeminiAccessSchema>(modelServiceIdForAccess).transportAccess;

  // [special] Profile pic generation mode: square, smallest size the model offers (we're rescaling to 256x256 anyway)
  const generationConfig = {
    model: model.modelRef,
    prompt,
    ...(agiProfilePic ? {
      ...(model.aspectRatios.includes('1:1') && { aspectRatio: '1:1' as const }),
      ...(model.imageSizes.length && { imageSize: model.imageSizes[0] }),
    } : {
      ...(aspectRatio && { aspectRatio }),
      ...(imageSize && { imageSize }),
    }),
  };

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

  // One image per request: fan out `count` parallel requests
  async function generateSingleImage(): Promise<T2iCreateImageOutput[]> {
    throwIfAborted(); // Check before starting

    // we use an async generator to stream heartbeat events while waiting for the image
    const operations = await apiStream.llmGemini.createImages.mutate({
      access: transportAccess,
      generationConfig,
      ...(aixInlineImageParts?.length && { editConfig: { inputImages: aixInlineImageParts } }),
      t2iContextName,
    }, {
      signal: abortSignal, // aborts the tRPC request
    });

    const createdImages: T2iCreateImageOutput[] = [];
    try {
      for await (const op of operations) {
        throwIfAborted(); // Check during iteration
        if (op.p === 'createImage')
          createdImages.push({ ...op.image, generatorName: model.label }); // painter = model label (see t2iIsPainterName)
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
    throw new Error(`Gemini image generation: ${errorMessages || 'Unknown error'}`);
  }

  // Take successful results and return as a flat array
  return batchResults
    .filter(result => result.status === 'fulfilled')
    .map(result => (result as PromiseFulfilledResult<T2iCreateImageOutput[]>).value)
    .flat();
}
