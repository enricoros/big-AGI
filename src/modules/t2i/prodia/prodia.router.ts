import { z } from 'zod';

import { createTRPCRouter, publicProcedure } from '~/server/trpc/trpc.server';
import { env } from '~/server/env';
import { fetchResponseOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import { getPngDimensionsFromBytes, T2ICreateImageAsyncStreamOp } from '../t2i.server';

import { PRODIA_HARDCODED_MODELS } from './prodia.models';


export const prodiaRouter = createTRPCRouter({

  /** [Prodia] Generate an image */
  createImage: publicProcedure
    .input(z.object({
      prodiaKey: z.string().optional(),
      prodiaModel: z.string(),
      prompt: z.string(),
      // Model-specific parameters
      negativePrompt: z.string().optional(),
      fluxSteps: z.number().optional(),
      sdxlSteps: z.number().optional(),
      sdCfgScale: z.number().optional(),
      stylePreset: z.string().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      seed: z.number().optional(),
    }))
    .query(async function* ({ input }): AsyncGenerator<T2ICreateImageAsyncStreamOp> {

      const key = (input.prodiaKey || env.PRODIA_API_KEY || '').trim();
      if (!key)
        throw new Error('Missing Prodia API Key');

      // -> state.started
      yield { p: 'state', state: 'started' };

      const selectedModel = PRODIA_HARDCODED_MODELS.find(model => model.id === input.prodiaModel);
      if (!selectedModel)
        throw new Error(`Unknown Prodia model: ${input.prodiaModel}`);

      let width = input.width;
      let height = input.height;

      // build config
      const config: Record<string, any> = {
        prompt: input.prompt,
      };

      // config: add supported parameters
      const checkParameter = (param: string) => selectedModel.parameters?.includes(param);
      if (checkParameter('negative_prompt') && input.negativePrompt)
        config.negative_prompt = input.negativePrompt;
      if (checkParameter('flux-steps') && input.fluxSteps)
        config.steps = input.fluxSteps;
      if (checkParameter('sdxl-steps') && input.sdxlSteps)
        config.steps = input.sdxlSteps;
      if ((checkParameter('cfg_scale') || checkParameter('guidance_scale')) && input.sdCfgScale)
        config.cfg_scale = input.sdCfgScale;
      if (checkParameter('style_preset') && input.stylePreset)
        config.style_preset = input.stylePreset;
      if (checkParameter('width') && width)
        config.width = width;
      if (checkParameter('height') && height)
        config.height = height;
      if (checkParameter('seed') && input.seed !== undefined)
        config.seed = input.seed;

      const jobRequest = { type: input.prodiaModel, config };

      // determine output format
      const isVideoModel = input.prodiaModel.includes('txt2vid');
      const acceptMime = isVideoModel ? 'video/mp4' : 'image/png';


      // define API URL and headers
      const url = 'https://inference.prodia.com/v2/job';
      const headers = {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Accept': acceptMime,
      };

      // -> heartbeat
      yield { p: '❤' };

      const response = await fetchResponseOrTRPCThrow({
        url,
        method: 'POST',
        headers,
        body: jobRequest,
        name: `Prodia Generate [${input.prodiaModel}]`,
      });

      // throw if we got JSON back (which would indicate an error or async job)
      if (response.headers.get('Content-Type')?.includes('json')) {
        let errorDetails = 'Received JSON response';
        try {
          const jsonData = await response.json();
          if (jsonData.error) errorDetails = `API Error: ${jsonData.error}`;
        } catch { /* ignore parse error */
        }
        // noinspection ExceptionCaughtLocallyJS
        throw new Error(errorDetails);
      }

      const outputBuffer = await response.arrayBuffer();

      // image size, with fallback
      let outputWidth = width || 1024;
      let outputHeight = height || 1024;
      if (!isVideoModel) {
        try {
          const dimensions = getPngDimensionsFromBytes(outputBuffer);
          outputWidth = dimensions.width;
          outputHeight = dimensions.height;
        } catch (e) {
          console.warn('Could not parse image dimensions');
        }
      }

      // to base64
      const base64Data = Buffer.from(outputBuffer).toString('base64');

      // Return the result
      yield {
        p: 'createImage',
        image: {
          mimeType: acceptMime,
          base64Data,
          altText: input.prompt,
          width: outputWidth,
          height: outputHeight,
          generatorName: 'prodia-' + selectedModel.label,
          parameters: { ...config },
          generatedAt: new Date().toISOString(),
        },
      };

    }),

});
