import { apiAsync } from '~/common/util/trpc.client';

import type { DModelSourceId } from '../../llms/store-llms';
import { findAccessForSourceOrThrow } from '../../llms/vendors/vendors.registry';


/**
 * Client function to call the OpenAI image generation API.
 *
 * Doesn't belong to the 'llms' module, although it refers a lot to it.
 */
export async function openAIGenerateImagesOrThrow(modelSourceId: DModelSourceId, prompt: string, count: number): Promise<string[]> {

  // call the OpenAI image generation API
  const images = await apiAsync.llmOpenAI.createImages.mutate({
    access: findAccessForSourceOrThrow(modelSourceId),
    tti: {
      prompt: prompt,
      count: count,
      model: 'dall-e-3',
      highQuality: true,
      asUrl: true,
      size: '1024x1024',
      style: 'vivid',
    },
  });

  // return a list of strings
  return images.map(i => i.imageUrl!);
}