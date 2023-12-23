import { apiAsync } from '~/common/util/trpc.client';

import type { OpenAIAccessSchema } from '../../server/openai/openai.router';
import { DModelSource, DModelSourceId, useModelsStore } from '../../store-llms';
import { findVendorById } from '../vendors.registry';

import type { SourceSetupOpenAI } from './openai.vendor';


/**
 * Client function to call the OpenAI image generation API.
 *
 * Doesn't belong to the 'llms' module, but it's conveniently located close to the Vendor, and
 * is called by the t2i module. It's located here to reduce dependencies.
 */
export async function openAIGenerateImagesOrThrow(modelSourceId: DModelSourceId, prompt: string, count: number): Promise<string[]> {

  // get the OpenAI access from the DModelSourceId
  const source: DModelSource<SourceSetupOpenAI> | undefined = useModelsStore.getState().sources.find(source => source.id === modelSourceId);
  if (!source) throw new Error(`ModelSource ${modelSourceId} not found`);

  const vendor = findVendorById<SourceSetupOpenAI, OpenAIAccessSchema>(source.vId);
  if (!vendor) throw new Error(`ModelSource ${modelSourceId} has no vendor`);

  const openAIAccess: OpenAIAccessSchema = vendor.getTransportAccess(source.setup);

  // call the OpenAI image generation API
  const images = await apiAsync.llmOpenAI.createImages.mutate({
    access: openAIAccess,
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