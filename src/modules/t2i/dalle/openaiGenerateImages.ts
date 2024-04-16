import { apiAsync } from '~/common/util/trpc.client';

import type { DModelSourceId } from '../../llms/store-llms';
import type { OpenAIAccessSchema } from '../../llms/server/openai/openai.router';
import { findAccessForSourceOrThrow } from '../../llms/vendors/vendors.registry';

import { useDalleStore } from './store-module-dalle';

/**
 * Client function to call the OpenAI image generation API.
 */
export async function openAIGenerateImagesOrThrow(modelSourceId: DModelSourceId, prompt: string, _count: number): Promise<string[]> {

  // use the current settings
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

  const isD3 = dalleModelId === 'dall-e-3';

  // parallelize the image generation depending on how many images can a model generate
  const imagePromises: Promise<string[]>[] = [];
  while (_count > 0) {

    // per-request count
    const perRequestCount = Math.min(_count, isD3 ? 1 : 10);

    const imageRefPromise = apiAsync.llmOpenAI.createImages.mutate({
      access: findAccessForSourceOrThrow<unknown, OpenAIAccessSchema>(modelSourceId).transportAccess,
      config: {
        prompt: prompt,
        count: perRequestCount,
        model: dalleModelId,
        quality: dalleQuality,
        responseFormat: 'url',
        size: dalleSize,
        style: dalleStyle,
      },
    }).then(images =>
      // convert to markdown image references
      images.map(({ imageUrl, altText }) => `![${altText}](${imageUrl})`),
    );

    imagePromises.push(imageRefPromise);
    _count -= perRequestCount;
  }

  // run all image generation requests
  const imageRefsBatchesResults = await Promise.allSettled(imagePromises);

  // throw if ALL promises were rejected
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

  // take successful results and return as string[]
  return imageRefsBatchesResults
    .filter(result => result.status === 'fulfilled') // Only take fulfilled promises
    .map(result => (result as PromiseFulfilledResult<string[]>).value) // Extract the value
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