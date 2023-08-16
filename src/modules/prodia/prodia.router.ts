import { z } from 'zod';

import { HARDCODED_MODELS } from '~/modules/prodia/prodia.models';
import { createTRPCRouter, publicProcedure } from '~/modules/trpc/trpc.server';
import { fetchJsonOrTRPCError } from '~/modules/trpc/trpc.serverutils';


const imagineInputSchema = z.object({
  prodiaKey: z.string().optional(),
  prodiaModel: z.string(),
  prompt: z.string(),
  negativePrompt: z.string().optional(),
  steps: z.number().optional(),
  cfgScale: z.number().optional(),
  aspectRatio: z.enum(['square', 'portrait', 'landscape']).optional(),
  upscale: z.boolean().optional(),
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

      // timeout, in seconds
      const timeout = 20;
      const tStart = Date.now();

      // crate the job, getting back a job ID
      const jobRequest: JobRequest = {
        model: input.prodiaModel,
        prompt: input.prompt,
        ...(!!input.negativePrompt && { negative_prompt: input.negativePrompt }),
        ...(!!input.steps && { steps: input.steps }),
        ...(!!input.cfgScale && { cfg_scale: input.cfgScale }),
        ...(!!input.aspectRatio && input.aspectRatio !== 'square' && { aspect_ratio: input.aspectRatio }),
        ...(!!input.upscale && { upscale: input.upscale }),
        ...(!!input.seed && { seed: input.seed }),
      };
      let j: JobResponse = await createGenerationJob(input.prodiaKey, jobRequest);

      // poll the job status until it's done
      let sleepDelay = 2000;
      while (j.status !== 'succeeded' && j.status !== 'failed' && (Date.now() - tStart) < (timeout * 1000)) {
        await new Promise(resolve => setTimeout(resolve, sleepDelay));
        j = await getJobStatus(input.prodiaKey, j.job);
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
  listModels: publicProcedure
    .input(modelsInputSchema)
    .query(async ({ input }) => {

      const { headers, url } = prodiaAccess(input.prodiaKey, `/v1/models/list`);
      const modelIds = await fetchJsonOrTRPCError<string[]>(url, 'GET', headers, undefined, 'Prodia');

      // filter and print the hardcoded models that are not in the API list
      const hardcodedModels = HARDCODED_MODELS.models.filter(m => modelIds.includes(m.id));
      const missingHardcoded = HARDCODED_MODELS.models.filter(m => !modelIds.includes(m.id));
      if (missingHardcoded.length)
        console.warn(`Prodia models missing from the API list: ${missingHardcoded.map(m => m.id).join(', ')}`);

      // add and print the models that are not in the hardcoded list
      const missingHardcodedIds = modelIds.filter(id => !HARDCODED_MODELS.models.find(m => m.id === id));
      if (missingHardcodedIds.length) {
        hardcodedModels.push(...missingHardcodedIds.map(id => ({
          id, label: id.split('[')[0]
            .replaceAll('_', ' ')
            .replaceAll('.safetensors', '')
            .trim(),
        })));
        console.log(`Prodia models missing from the hardcoded list: ${missingHardcodedIds.join(', ')}`);
      }

      // return the hardcoded models
      return { models: hardcodedModels };
    }),

});


export interface JobRequest {
  model: 'sdv1_4.ckpt [7460a6fa]' | string;
  prompt: string;
  // optional, and not even documented, but inferred from the response data
  cfg_scale?: number;
  steps?: number;
  negative_prompt?: string;
  aspect_ratio?: 'square' | 'portrait' | 'landscape';
  upscale?: boolean;
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


async function createGenerationJob(apiKey: string | undefined, jobRequest: JobRequest): Promise<JobResponse> {
  const { headers, url } = prodiaAccess(apiKey, '/v1/job');
  return await fetchJsonOrTRPCError<JobResponse, JobRequest>(url, 'POST', headers, jobRequest, 'Prodia Job Create');
}

async function getJobStatus(apiKey: string | undefined, jobId: string): Promise<JobResponse> {
  const { headers, url } = prodiaAccess(apiKey, `/v1/job/${jobId}`);
  return await fetchJsonOrTRPCError<JobResponse>(url, 'GET', headers, undefined, 'Prodia Job Status');
}


function prodiaAccess(_prodiaKey: string | undefined, apiPath: string): { headers: HeadersInit, url: string } {
  // API key
  const prodiaKey = (_prodiaKey || process.env.PRODIA_API_KEY || '').trim();
  if (!prodiaKey)
    throw new Error('Missing Prodia API Key. Add it on the UI (Setup) or server side (your deployment).');

  // API host
  let prodiaHost = 'https://api.prodia.com';

  return {
    headers: {
      'X-Prodia-Key': prodiaKey,
      'Content-Type': 'application/json',
    },
    url: prodiaHost + apiPath,
  };
}