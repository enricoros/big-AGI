import { apiStream } from '~/common/util/trpc.client';

import { useProdiaStore } from './store-module-prodia';

import type { T2iCreateImageOutput } from '../t2i.server';


export async function prodiaGenerateImages(imageText: string, count: number): Promise<T2iCreateImageOutput[]> {

  // use the most current model and settings
  const {
    apiKey,
    modelId,
    resolution,
    negativePrompt,
    fluxSteps,
    sdxlSteps,
    sdCfgScale,
    stylePreset,
    seed,
  } = useProdiaStore.getState();


  let width: number;
  let height: number;
  if (resolution) {
    const [widthStr, heightStr] = resolution.split('x');
    width = parseInt(widthStr, 10);
    height = parseInt(heightStr, 10);
  }

  const generateImage = async (): Promise<T2iCreateImageOutput[]> => {
    const operations = await apiStream.prodia.createImage.query({
      ...(apiKey && { prodiaKey: apiKey }),
      prodiaModel: modelId,
      prompt: imageText,
      ...(negativePrompt && { negativePrompt }),
      ...(width && height && { width, height }),
      ...(fluxSteps && { fluxSteps }),
      ...(sdxlSteps && { sdxlSteps }),
      ...(sdCfgScale && { sdCfgScale }),
      ...(stylePreset && { stylePreset }),
      ...(seed && { seed }),
    });

    const generatedImages: T2iCreateImageOutput[] = [];
    for await (const op of operations)
      if (op.p === 'createImage')
        generatedImages.push(op.image);

    if (!generatedImages.length)
      throw new Error('No images were generated');

    return generatedImages;
  };

  // Run the image generation 'count' times in parallel and handle all results
  const imagePromises = Array.from({ length: count }, generateImage);
  const results = await Promise.allSettled(imagePromises);

  // Filter and return only the successful results
  return results
    .filter((result): result is PromiseFulfilledResult<T2iCreateImageOutput[]> => result.status === 'fulfilled')
    .map(result => result.value)
    .flat();
}