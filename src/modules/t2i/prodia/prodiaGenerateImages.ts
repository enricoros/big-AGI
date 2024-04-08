import { apiAsync } from '~/common/util/trpc.client';

import { useProdiaStore } from './store-module-prodia';


export async function prodiaGenerateImages(imageText: string, count: number) {
  // use the most current model and settings
  const {
    prodiaApiKey: prodiaKey, prodiaModelId, prodiaModelGen,
    prodiaNegativePrompt: negativePrompt, prodiaSteps: steps, prodiaCfgScale: cfgScale,
    prodiaAspectRatio: aspectRatio, prodiaUpscale: upscale,
    prodiaResolution: resolution,
    prodiaSeed: seed,
  } = useProdiaStore.getState();

  // Run the image generation 'count' times in parallel
  const imageUrls: string[] = await Promise.all(
    // using an array of 'count' number of promises
    Array(count).fill(undefined).map(async () => {

      const images = await apiAsync.prodia.createImage.query({
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

      if (images.length !== 1)
        throw new Error('Prodia image generation failed - expected 1 image, got ' + images.length);
      const { imageUrl, altText } = images[0];

      // return a list of strings as markdown images
      return `![${altText}](${imageUrl})`;
    }),
  );

  // Return the resulting image URLs
  return imageUrls;
}