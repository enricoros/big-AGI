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
    tti: {
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