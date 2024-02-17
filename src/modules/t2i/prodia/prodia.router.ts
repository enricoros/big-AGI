import { z } from 'zod';

import { createTRPCRouter, publicProcedure } from '~/server/api/trpc.server';
import { env } from '~/server/env.mjs';
import { fetchJsonOrTRPCError } from '~/server/api/trpc.router.fetchers';

import { t2iCreateImagesOutputSchema } from '../t2i.server.types';

import { HARDCODED_MODELS } from './prodia.models';


const createImageInputSchema = z.object({
  prodiaKey: z.string().optional(),
  prodiaModel: z.string(),
  prodiaGen: z.enum(['sd', 'sdxl']).optional(),
  prompt: z.string(),
  negativePrompt: z.string().optional(),
  steps: z.number().optional(),
  cfgScale: z.number().optional(),
  aspectRatio: z.enum(['square', 'portrait', 'landscape']).optional(),
  upscale: z.boolean().optional(),
  resolution: z.string().optional(),
  seed: z.number().optional(),
});

const modelsInputSchema = z.object({
  prodiaKey: z.string().optional(),
});


export const prodiaRouter = createTRPCRouter({

  /** [Prodia] Generate an image, returning the cloud URL */
  createImage: publicProcedure
    .input(createImageInputSchema)
    .output(t2iCreateImagesOutputSchema)
    .query(async ({ input }) => {

      // timeout, in seconds
      const timeout = 20;
      const tStart = Date.now();

      // crate the job, getting back a job ID
      let jobRequest: JobRequestSD | JobRequestSDXL;
      const jobRequestCommon = {
        model: input.prodiaModel,
        prompt: input.prompt,
        ...(!!input.negativePrompt && { negative_prompt: input.negativePrompt }),
        ...(!!input.steps && { steps: input.steps }),
        ...(!!input.cfgScale && { cfg_scale: input.cfgScale }),
        ...(!!input.seed && { seed: input.seed }),
      };
      // SDXL takes the resolution
      if (input.prodiaGen === 'sdxl') {
        const resTokens = input.resolution?.split('x');
        const width = resTokens?.length === 2 ? parseInt(resTokens[0], 10) : undefined;
        const height = resTokens?.length === 2 ? parseInt(resTokens[1], 10) : undefined;
        jobRequest = {
          ...jobRequestCommon,
          ...(!!width && { width }),
          ...(!!height && { height }),
        };
      }
      // SD takes the aspect ratio and upscale
      else {
        jobRequest = {
          ...jobRequestCommon,
          ...(!!input.aspectRatio && input.aspectRatio !== 'square' && { aspect_ratio: input.aspectRatio }),
          ...(!!input.upscale && { upscale: input.upscale }),
        };
      }
      let j: JobResponse = await createGenerationJob(input.prodiaKey, input.prodiaGen === 'sdxl', jobRequest);

      // poll the job status until it's done
      let sleepDelay = 3000;
      while (j.status !== 'succeeded' && j.status !== 'failed' && (Date.now() - tStart) < (timeout * 1000)) {
        await new Promise(resolve => setTimeout(resolve, sleepDelay));
        j = await getJobStatus(input.prodiaKey, j.job);
        if (sleepDelay >= 300)
          sleepDelay /= 2;
      }

      // check for success
      const elapsed = Math.round((Date.now() - tStart) / 100) / 10;
      if (j.status !== 'succeeded' || !j.imageUrl)
        throw new Error(`Prodia image generation failed within ${elapsed}s`);

      // respond with 1 result
      return [
        {
          imageUrl: j.imageUrl,
          altText: jobRequest.prompt,
          elapsed,
        },
      ];
    }),

  /** List models - for now just hardcode the list, as there's no endpoint */
  listModels: publicProcedure
    .input(modelsInputSchema)
    .query(async ({ input }) => {

      // fetch in parallel both the SD and SDXL models
      const { headers, url } = prodiaAccess(input.prodiaKey, `/v1/sd/models`);
      const [sdModelIds, sdXlModelIds] = await Promise.all([
        fetchJsonOrTRPCError<string[]>(url, 'GET', headers, undefined, 'Prodia'),
        fetchJsonOrTRPCError<string[]>(url.replace('/sd/', '/sdxl/'), 'GET', headers, undefined, 'Prodia'),
      ]);
      const apiModelIDs = [...sdModelIds, ...sdXlModelIds];

      // filter and print the hardcoded models that are not in the API list
      const hardcodedRemoved = HARDCODED_MODELS.models.filter(m => !apiModelIDs.includes(m.id));
      if (hardcodedRemoved.length)
        console.warn(`Prodia models now removed from the API: ${hardcodedRemoved.map(m => m.id).join(', ')}`);

      // add and print the models that are not in the hardcoded list
      const hardcodedExisting = HARDCODED_MODELS.models.filter(m => apiModelIDs.includes(m.id));
      const missingHardcodedIDs = apiModelIDs.filter(id => !hardcodedExisting.find(m => m.id === id));
      if (missingHardcodedIDs.length) {
        console.log(`Prodia API models that are new to the hardcoded list: ${missingHardcodedIDs.join(', ')}`);
        hardcodedExisting.push(...missingHardcodedIDs.map(id => {
          const missingLabel = '[New] ' + id.split('[')[0].replaceAll('_', ' ').replaceAll('.safetensors', '').trim();
          return { id, label: missingLabel, gen: (sdXlModelIds.includes(id) ? 'sdxl' : 'sd') as 'sd' | 'sdxl' };
        }));
      }

      // sort the models by priority, then isSDXL, then label
      hardcodedExisting.sort((a, b) => {
        const pa = a.priority || 0;
        const pb = b.priority || 0;
        if (pa !== pb) return pb - pa;
        if (a.gen !== b.gen) return a.gen === 'sdxl' ? -1 : 1;
        return a.label.localeCompare(b.label);
      });

      // return the hardcoded models
      return { models: hardcodedExisting };
    }),

});


interface JobRequestBase {
  model: string,
  prompt: string,
  negative_prompt?: string;
  steps?: number;
  cfg_scale?: number;
  seed?: number;
  // sampler..
}

export interface JobRequestSD extends JobRequestBase {
  upscale?: boolean;
  aspect_ratio?: 'square' | 'portrait' | 'landscape';
}

export interface JobRequestSDXL extends JobRequestBase {
  width?: number;
  height?: number;
}

export interface JobResponse {
  job: string;
  // params: {
  //   prompt: string;
  //   cfg_scale: number;
  //   steps: number;
  //   negative_prompt: string;
  //   seed: number;
  //   upscale: boolean;
  //   sampler_name: 'Euler' | string;
  //   width: 512 | number;
  //   height: 512 | number;
  //   options: { sd_model_checkpoint: 'sdv1_4.ckpt [7460a6fa]' | string; };
  // };
  status: 'queued' | 'generating' | 'succeeded' | 'failed';
  imageUrl?: string;
}


async function createGenerationJob<TJobRequest extends JobRequestBase>(apiKey: string | undefined, isGenSDXL: boolean, jobRequest: TJobRequest): Promise<JobResponse> {
  const { headers, url } = prodiaAccess(apiKey, isGenSDXL ? '/v1/sdxl/generate' : '/v1/sd/generate');
  return await fetchJsonOrTRPCError<JobResponse, TJobRequest>(url, 'POST', headers, jobRequest, 'Prodia Job Create');
}

async function getJobStatus(apiKey: string | undefined, jobId: string): Promise<JobResponse> {
  const { headers, url } = prodiaAccess(apiKey, `/v1/job/${jobId}`);
  return await fetchJsonOrTRPCError<JobResponse>(url, 'GET', headers, undefined, 'Prodia Job Status');
}


function prodiaAccess(_prodiaKey: string | undefined, apiPath: string): { headers: HeadersInit, url: string } {
  // API key
  const prodiaKey = (_prodiaKey || env.PRODIA_API_KEY || '').trim();
  if (!prodiaKey)
    throw new Error('Missing Prodia API Key. Add it on the UI (Setup) or server side (your deployment).');

  // API host
  const prodiaHost = 'https://api.prodia.com';

  return {
    headers: {
      'X-Prodia-Key': prodiaKey,
      'Content-Type': 'application/json',
    },
    url: prodiaHost + apiPath,
  };
}