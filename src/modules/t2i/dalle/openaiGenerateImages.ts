import { apiAsync } from '~/common/util/trpc.client';

import type { OpenAIAccessSchema } from '../../llms/server/openai/openai.router';

import type { DModelsServiceId } from '~/common/stores/llms/modelsservice.types';
import { findServiceAccessOrThrow } from '~/modules/llms/vendors/vendor.helpers';

import type { T2iCreateImageOutput } from '../t2i.server';
import { useDalleStore } from './store-module-dalle';


/**
 * Client function to call the OpenAI image generation API.
 */
export async function openAIGenerateImagesOrThrow(modelServiceId: DModelsServiceId, prompt: string, count: number): Promise<T2iCreateImageOutput[]> {

  // Use the current settings
  const {
    dalleModelId,
    dalleQuality,
    dalleSize,
    dalleStyle,
    dalleNoRewrite,
  } = useDalleStore.getState();

  // This trick is explained on: https://platform.openai.com/docs/guides/images/usage?context=node
  if (dalleNoRewrite)
    prompt = 'I NEED to test how the tool works with extremely simple prompts. DO NOT add any detail, just use it AS-IS: ' + prompt;


  // Function to generate images in batches
  const generateImagesBatch = async (imageCount: number): Promise<T2iCreateImageOutput[]> =>
    apiAsync.llmOpenAI.createImages.mutate({
      access: findServiceAccessOrThrow<{}, OpenAIAccessSchema>(modelServiceId).transportAccess,
      config: {
        prompt,
        count: imageCount,
        model: dalleModelId,
        quality: dalleQuality,
        size: dalleSize,
        style: dalleStyle,
        responseFormat: 'b64_json',
      },
    });


  // Calculate the number of batches required
  const isD3 = dalleModelId === 'dall-e-3';
  const maxBatchSize = isD3 ? 1 : 10;
  const totalBatches = Math.ceil(count / maxBatchSize);

  // Create an array of promises for image generation
  const imagePromises = Array.from({ length: totalBatches }, (_, index) => {
    const batchCount = Math.min(count - index * maxBatchSize, maxBatchSize);
    return generateImagesBatch(batchCount);
  });

  // Run all image generation requests in parallel and handle all results
  const imageRefsBatchesResults = await Promise.allSettled(imagePromises);


  // Throw if ALL promises were rejected
  const allRejected = imageRefsBatchesResults.every(result => result.status === 'rejected');
  if (allRejected) {
    const errorMessages = imageRefsBatchesResults
      .map(result => {
        const reason = (result as PromiseRejectedResult).reason as any; // TRPCClientError<TRPCErrorShape>;
        return reason?.shape?.message || reason?.message || '';
      })
      .filter(message => !!message)
      .join(', ');

    throw new Error(`OpenAI image generation: ${errorMessages}`);
  }

  // Take successful results and return as a flat array
  return imageRefsBatchesResults
    .filter(result => result.status === 'fulfilled') // Only take fulfilled promises
    .map(result => (result as PromiseFulfilledResult<T2iCreateImageOutput[]>).value) // Get the value
    .flat();
}


/**
 * Return the pricing for the OpenAI image generation API.
 * TODO: update this when the OpenAI pricing changes.
 */
export function openAIImageModelsPricing(dalleModelId: 'dall-e-3' | 'dall-e-2', dalleQuality: 'standard' | 'hd', dalleSize: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792'): string {
  if (dalleModelId === 'dall-e-3') {
    if (dalleQuality === 'hd') {
      if (dalleSize === '1024x1024') return '0.08';
      if (dalleSize === '1792x1024' || dalleSize === '1024x1792') return '0.12';
    } else if (dalleQuality === 'standard') {
      if (dalleSize === '1024x1024') return '0.04';
      if (dalleSize === '1792x1024' || dalleSize === '1024x1792') return '0.08';
    }
  } else if (dalleModelId === 'dall-e-2') {
    if (dalleSize === '256x256') return '0.016';
    if (dalleSize === '512x512') return '0.018';
    if (dalleSize === '1024x1024') return '0.02';
  }
  return '?';
}