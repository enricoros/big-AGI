import { apiAsync } from '~/common/util/trpc.client';

import { useProdiaStore } from './store-module-prodia';

import type { T2iCreateImageOutput } from '../t2i.server';


export async function prodiaGenerateImages(imageText: string, count: number): Promise<T2iCreateImageOutput[]> {
  // Use the most current model and settings
  const {
    prodiaApiKey: prodiaKey, prodiaModelId, prodiaModelGen,
    prodiaNegativePrompt: negativePrompt, prodiaSteps: steps, prodiaCfgScale: cfgScale,
    prodiaAspectRatio: aspectRatio, prodiaUpscale: upscale,
    prodiaResolution: resolution,
    prodiaSeed: seed,
  } = useProdiaStore.getState();

  // Function to generate a single image
  const generateImage = async (): Promise<T2iCreateImageOutput[]> => {
    const generatedImages = await apiAsync.prodia.createImage.query({
      ...(!!prodiaKey && { prodiaKey }),
      prodiaModel: prodiaModelId || 'sd_xl_base_1.0.safetensors [be9edd61]', // was: Realistic_Vision_V5.0.safetensors [614d1063]
      prodiaGen: prodiaModelGen || 'sd', // data versioning fix
      prompt: imageText,
      ...(!!negativePrompt && { negativePrompt }),
      ...(!!steps && { steps }),
      ...(!!cfgScale && { cfgScale }),
      ...(!!aspectRatio && aspectRatio !== 'square' && { aspectRatio }),
      ...(upscale && { upscale }),
      ...(!!resolution && { resolution }),
      ...(!!seed && { seed }),
    });

    if (generatedImages.length !== 1)
      throw new Error('Prodia image generation failed - expected 1 image, got ' + generatedImages.length);

    return generatedImages;
  };

  // Run the image generation 'count' times in parallel and handle all results
  const imagePromises = Array.from({ length: count }, generateImage);
  const results = await Promise.allSettled(imagePromises);

  // Filter and return only the successful results
  return results
    .filter(result => result.status === 'fulfilled')
    .map(result => (result as PromiseFulfilledResult<T2iCreateImageOutput[]>).value)
    .flat();
}