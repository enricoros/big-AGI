import { apiAsync } from '~/common/util/trpc.client';

import type { DModelSourceId } from '../../llms/store-llms';
import { findAccessForSourceOrThrow } from '../../llms/vendors/vendors.registry';

import { useDalleStore } from './store-module-dalle';


/**
 * Client function to call the OpenAI image generation API.
 */
export async function openAIGenerateImagesOrThrow(modelSourceId: DModelSourceId, prompt: string, count: number): Promise<string[]> {

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

  // call the OpenAI image generation API
  const images = await apiAsync.llmOpenAI.createImages.mutate({
    access: findAccessForSourceOrThrow(modelSourceId),
    request: {
      prompt: prompt,
      count: count,
      model: dalleModelId,
      quality: dalleQuality,
      asUrl: true,
      size: dalleSize,
      style: dalleStyle,
    },
  });

  // return a list of strings as markdown images
  return images.map(({ imageUrl, altText }) => {
    return `![${altText}](${imageUrl})`;
  });
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