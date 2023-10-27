import { apiAsync } from '~/common/util/trpc.client';

import { useProdiaStore } from './store-prodia';


export const requireUserKeyProdia = !process.env.HAS_SERVER_KEY_PRODIA;

export const canUseProdia = (): boolean => !!useProdiaStore.getState().prodiaModelId || !requireUserKeyProdia;

export const isValidProdiaApiKey = (apiKey?: string) => !!apiKey && apiKey.trim()?.length >= 36;

export const CmdRunProdia: string[] = ['/imagine', '/img'];


export async function prodiaGenerateImage(count: number, imageText: string) {
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

      const { imageUrl } = await apiAsync.prodia.imagine.query({
        ...(!!prodiaKey && { prodiaKey }),
        prodiaModel: prodiaModelId || 'Realistic_Vision_V5.0.safetensors [614d1063]', // data versioning fix
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

      return imageUrl;
    }),
  );

  // Return the resulting image URLs
  return imageUrls;
}