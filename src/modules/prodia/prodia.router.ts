import { z } from 'zod';

import { HARDCODED_MODELS } from '~/modules/prodia/prodia.models';
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
