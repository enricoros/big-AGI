import { z } from 'zod';

import { createTRPCRouter, publicProcedure } from '~/modules/trpc/trpc.server';


const imagineInputSchema = z.object({
  prodiaKey: z.string().optional(),
  prodiaModel: z.string(),
  prompt: z.string(),
  negativePrompt: z.string().optional(),
  steps: z.number().optional(),
  cfgScale: z.number().optional(),
  seed: z.number().optional(),
});

const modelsInputSchema = z.object({
  prodiaKey: z.string().optional(),
});


export const prodiaRouter = createTRPCRouter({

  /**
   * Generate an image, returning the URL where it's stored
   */
  imagine: publicProcedure
    .input(imagineInputSchema)
    .query(async ({ input }) => {

      const prodiaKey = (input.prodiaKey || process.env.PRODIA_API_KEY || '').trim();
      if (!prodiaKey)
        throw new Error('A Prodia API Key is required.');

      // timeout, in seconds
      const timeout = 15;
      const tStart = Date.now();

      // crate the job, getting back a job ID
      const jobRequest: JobRequest = {
        model: input.prodiaModel,
        prompt: input.prompt,
        ...(!!input.cfgScale && { cfg_scale: input.cfgScale }),
        ...(!!input.steps && { steps: input.steps }),
        ...(!!input.negativePrompt && { negative_prompt: input.negativePrompt }),
        ...(!!input.seed && { seed: input.seed }),
      };
      let j: JobResponse = await createGenerationJob(prodiaKey, jobRequest);

      // poll the job status until it's done
      let sleepDelay = 2000;
      while (j.status !== 'succeeded' && j.status !== 'failed' && (Date.now() - tStart) < (timeout * 1000)) {
        await new Promise(resolve => setTimeout(resolve, sleepDelay));
        j = await getJobStatus(prodiaKey, j.job);
        if (sleepDelay > 250)
          sleepDelay /= 2;
      }

      // check for success
      const elapsed = Math.round((Date.now() - tStart) / 100) / 10;
      if (j.status !== 'succeeded' || !j.imageUrl)
        throw new Error(`Prodia image generation failed within ${elapsed}s`);

      // respond with the image URL
      return {
        imageUrl: j.imageUrl,
        altText: `Prodia generated "${jobRequest.prompt}". Options: ${JSON.stringify({ seed: j.params })}.`,
        elapsed,
      };
    }),

  /**
   * List models - for now just hardcode the list, as there's no endpoint
   */
  models: publicProcedure
    .input(modelsInputSchema)
    .query(async () => {
      return HARDCODED_MODELS;
    }),

});


export interface JobRequest {
  model: 'sdv1_4.ckpt [7460a6fa]' | string;
  prompt: string;
  // optional, and not even documented, but inferred from the response data
  cfg_scale?: number;
  steps?: number;
  negative_prompt?: string;
  seed?: number;
}

export interface JobResponse {
  job: string;
  params: {
    prompt: string;
    cfg_scale: number;
    steps: number;
    negative_prompt: string;
    seed: number;
    upscale: boolean;
    sampler_name: 'Euler' | string;
    width: 512 | number;
    height: 512 | number;
    options: { sd_model_checkpoint: 'sdv1_4.ckpt [7460a6fa]' | string; };
  };
  status: 'queued' | 'generating' | 'succeeded' | 'failed';
  imageUrl?: string;
}


async function createGenerationJob(apiKey: string, jobRequest: JobRequest): Promise<JobResponse> {
  const response = await fetch('https://api.prodia.com/v1/job', {
    method: 'POST',
    headers: {
      'X-Prodia-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(jobRequest),
  });
  if (response.status !== 200) {
    const errorMessage = await response.text() || response.statusText || '' + response.status || 'Unknown Error';
    throw new Error(`Bad Prodia response: ${errorMessage}`);
  }
  return await response.json();
}

async function getJobStatus(apiKey: string, jobId: string): Promise<JobResponse> {
  const response = await fetch(`https://api.prodia.com/v1/job/${jobId}`, {
    headers: {
      'X-Prodia-Key': apiKey,
    },
  });
  if (response.status !== 200) {
    const errorMessage = await response.text() || response.statusText || '' + response.status || 'Unknown Error';
    throw new Error(`Bad Prodia status response: ${errorMessage}`);
  }
  return await response.json();
}


interface ProdiaModelDescription {
  id: string;
  label: string;
  priority?: number;
}

// for lack of an API
const HARDCODED_MODELS: { models: ProdiaModelDescription[] } = {
  models: [
    { id: 'sdv1_4.ckpt [7460a6fa]', label: 'Stable Diffusion 1.4', priority: 8 },
    { id: 'v1-5-pruned-emaonly.ckpt [81761151]', label: 'Stable Diffusion 1.5', priority: 9 },
    { id: 'anythingv3_0-pruned.ckpt [2700c435]', label: 'Anything V3.0' },
    { id: 'anything-v4.5-pruned.ckpt [65745d25]', label: 'Anything V4.5' },
    { id: 'analog-diffusion-1.0.ckpt [9ca13f02]', label: 'Analog Diffusion' },
    { id: 'theallys-mix-ii-churned.safetensors [5d9225a4]', label: `TheAlly's Mix II` },
    { id: 'elldreths-vivid-mix.safetensors [342d9d26]', label: `Elldreth's Vivid Mix` },
    { id: 'deliberate_v2.safetensors [10ec4b29]', label: 'Deliberate V2', priority: 5 },
    { id: 'openjourney_V4.ckpt [ca2f377f]', label: 'Openjourney v4' },
    { id: 'dreamlike-diffusion-1.0.safetensors [5c9fd6e0]', label: 'Dreamlike Diffusion' },
    { id: 'dreamlike-diffusion-2.0.safetensors [fdcf65e7]', label: 'Dreamlike Diffusion 2' },
    { id: 'portrait+1.0.safetensors [1400e684]', label: 'Portrait' },
    { id: 'riffusion-model-v1.ckpt [3aafa6fe]', label: 'Riffusion' },
    { id: 'timeless-1.0.ckpt [7c4971d4]', label: 'Timeless' },
    { id: 'dreamshaper_5BakedVae.safetensors [a3fbf318]', label: 'Dreamshaper 5' },
    { id: 'revAnimated_v122.safetensors [3f4fefd9]', label: 'ReV Animated V1.2.2' },
    { id: 'meinamix_meinaV9.safetensors [2ec66ab0]', label: 'MeinaMix Meina V9' },
    { id: 'lyriel_v15.safetensors [65d547c5]', label: 'Lyriel' },
    { id: 'anythingV5_PrtRE.safetensors [893e49b9]', label: 'Anything v5.0' },
    { id: 'dreamshaper_6BakedVae.safetensors [114c8abb]', label: 'Dreamshaper 6' },
    { id: 'AOM3A3_orangemixs.safetensors [9600da17]', label: 'Abyss Orange v3' },
    { id: 'shoninsBeautiful_v10.safetensors [25d8c546]', label: 'Shonin Beautiful People' },
  ],
};
// sort by priority
HARDCODED_MODELS.models.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));