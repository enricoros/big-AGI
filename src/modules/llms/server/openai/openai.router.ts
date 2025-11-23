import * as z from 'zod/v4';
import { TRPCError } from '@trpc/server';

import { createTRPCRouter, edgeProcedure } from '~/server/trpc/trpc.server';
import { fetchJsonOrTRPCThrow, TRPCFetcherError } from '~/server/trpc/trpc.router.fetchers';
import { serverCapitalizeFirstLetter } from '~/server/wire';

import type { T2ICreateImageAsyncStreamOp } from '~/modules/t2i/t2i.server';
import { OpenAIWire_API_Images_Generations, OpenAIWire_API_Moderations_Create } from '~/modules/aix/server/dispatch/wiretypes/openai.wiretypes';
import { heartbeatsWhileAwaiting } from '~/modules/aix/server/dispatch/heartbeatsWhileAwaiting';

import { wireLocalAIModelsApplyOutputSchema, wireLocalAIModelsAvailableOutputSchema, wireLocalAIModelsListOutputSchema } from './wiretypes/localai.wiretypes';

import { ListModelsResponse_schema, ModelDescriptionSchema } from '../llm.server.types';
import { listModelsRunDispatch } from '../listModels.dispatch';

import { openAIAccess, OpenAIAccessSchema, openAIAccessSchema } from './openai.access';


// Router Input/Output Schemas

const listModelsInputSchema = z.object({
  access: openAIAccessSchema,
});


const _createImageConfigBase = z.object({
  // prompt: z.string().max(32000),
  count: z.number().min(1).max(10),
  user: z.string().optional(),
});

// GPT Image family (gpt-image-1, gpt-image-1-mini share all parameters)
const createImageConfigGI = _createImageConfigBase.extend({
  model: z.enum(['gpt-image-1', 'gpt-image-1-mini']),
  prompt: z.string().max(32000),
  size: z.enum([/*'auto',*/ '1024x1024', '1536x1024', '1024x1536']),
  quality: z.enum(['high', 'medium', 'low']).optional(),
  background: z.enum(['auto', 'transparent', 'opaque']).optional(),
  output_format: z.enum(['png', 'jpeg', 'webp']).optional(),
  output_compression: z.number().min(0).max(100).int().optional(),
  moderation: z.enum(['low', 'auto']).optional(),
});

// DALL-E 3
const createImageConfigD3 = _createImageConfigBase.extend({
  model: z.literal('dall-e-3'),
  count: z.number().min(1).max(1), // DALL-E 3 only supports n=1
  prompt: z.string().max(4000),
  quality: z.enum(['standard', 'hd']),
  size: z.enum(['1024x1024', '1792x1024', '1024x1792']),
  style: z.enum(['vivid', 'natural']).optional(),
  response_format: z.enum([/*'url',*/ 'b64_json']).optional(),
});

// DALL-E 2
const createImageConfigD2 = _createImageConfigBase.extend({
  model: z.literal('dall-e-2'),
  prompt: z.string().max(1000),
  quality: z.literal('standard').optional(),
  size: z.enum(['256x256', '512x512', '1024x1024']),
  response_format: z.enum([/*'url',*/ 'b64_json']).optional(),
});

// [LocalAI] simple default configuration
const createImageConfigLocalAI = _createImageConfigBase.extend({
  model: z.enum([
    'stablediffusion', // default, mapped to 'gpt-image-1'
    'dreamshaper', // mapped to 'high', mapped to 'gpt-image-1-mini'
    'sd-3.5-large-ggml', // mapped to 'medium', mapped to 'dall-e-3'
    'sd-3.5-medium-ggml', // mapped to 'medium', mapped to 'dall-e-2'
  ]),
  prompt: z.string(),
  size: z.enum([
    // 'auto',
    '256x256', '512x512',
    '1024x1024', '1536x1024', '1024x1536',
  ]),
  // stepCount: z.number().min(1).max(150).int().optional(), // unused for now, works when assigned to .step
  response_format: z.enum(['url', 'b64_json']).optional(), // defaults to URL
});


const createImagesInputSchema = z.object({
  access: openAIAccessSchema,
  // for this object sync with <> OpenAIWire_API_Images_Generations.Request_schema
  generationConfig: z.discriminatedUnion('model', [
    createImageConfigGI, // handles both gpt-image-1 and gpt-image-1-mini
    createImageConfigD3,
    createImageConfigD2,
    createImageConfigLocalAI,
  ]),
  editConfig: z.object({
    /**
     * This is the exact copy of AixWire_Parts.InlineImagePart_schema, but somehow we must keep
     * this module separate for now, or we'll get circular dependencies during the build.
     */
    inputImages: z.array(z.object({
      pt: z.literal('inline_image'),
      mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
      base64: z.string(),
    })),
    maskImage: z.object({
      pt: z.literal('inline_image'),
      mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
      base64: z.string(),
    }).optional(),
  }).optional(),
});


const moderationInputSchema = z.object({
  access: openAIAccessSchema,
  text: z.string(),
});


export const llmOpenAIRouter = createTRPCRouter({

  /* [OpenAI] List the Models available */
  listModels: edgeProcedure
    .input(listModelsInputSchema)
    .output(ListModelsResponse_schema)

    // tRPC middleware: log errors for this procedure - as we don't have proper try/catch blocks yet
    .use(async ({ next, path, signal, type, input }) => {
      const result = await next();

      // [PROD] log/warn listModel errors
      if (!result.ok && result.error) {
        // '401 unauthorized' is expected with wrong/missing API keys - log instead of warn
        const is401 = result.error instanceof TRPCFetcherError && result.error.httpStatus === 401;
        const isLocalAI = input.access?.dialect === 'localai';
        console[(is401 || isLocalAI) ? 'log' : 'warn'](`${path} (${input.access?.dialect || '?'}):${signal?.aborted ? ' [ABORTED]' : ''}`, result.error);
      }

      // [DEV] NOTE: the trpc onError will also log next when in development mode, @see handlerEdgeRoutes

      return result;
    })

    .query(async ({ input: { access }, signal }): Promise<{ models: ModelDescriptionSchema[] }> => {

      const models = await listModelsRunDispatch(access, signal);

      return { models };
    }),


  /* [OpenAI/LocalAI] images/generations */
  createImages: edgeProcedure
    .input(createImagesInputSchema)
    .mutation(async function* ({ input, signal }): AsyncGenerator<T2ICreateImageAsyncStreamOp> {

      const { access, generationConfig: config, editConfig } = input;

      // Determine if this is an edit request
      const isGptImageFamily = config.model === 'gpt-image-1' || config.model === 'gpt-image-1-mini';
      const isEdit = !!editConfig?.inputImages?.length && isGptImageFamily;

      // validate input
      if (isEdit && !isGptImageFamily)
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Image editing is only supported for GPT Image models` });
      if (config.model === 'dall-e-3' && config.count > 1)
        throw new TRPCError({ code: 'BAD_REQUEST', message: `[OpenAI Issue] dall-e-3 model does not support more than 1 image` });
      // if (config.model !== 'gpt-image-1' && (config.background || config.moderation || config.output_compression || config.output_format))
      //   throw new TRPCError({ code: 'BAD_REQUEST', message: `[OpenAI Issue] background, moderation, output_compression, output_format are only supported for gpt-image-1` });
      // if (config.model !== 'dall-e-3' && config.style)
      //   throw new TRPCError({ code: 'BAD_REQUEST', message: `[OpenAI Issue] style is only supported for dall-e-3` });


      // Prepare request body (JSON for generation, FormData for edit)
      let requestBody: OpenAIWire_API_Images_Generations.Request | FormData;
      let genImageMimeType = 'image/png'; // assume as default

      if (!isEdit) {

        const { model, count, ...restConfig } = config;
        requestBody = {
          ...restConfig, // includes response_format for dall-e-3 and dall-e-2 models
          model: model as any, // [LocalAI] Fix: LocalAI wants 'stablediffusion' as model name
          n: count,
          user: config.user || 'Big-AGI',
        };

        // auto-selects the output image mime type - or defaults to the first one
        if (requestBody.output_format === 'jpeg')
          genImageMimeType = 'image/jpeg';
        else if (requestBody.output_format === 'webp')
          genImageMimeType = 'image/webp';

      } else {
        requestBody = new FormData();

        // append required & optional fields
        const { prompt, model, count, quality, size, user } = config;
        requestBody.append('prompt', prompt);
        requestBody.append('model', model);
        if (count > 1) requestBody.append('n', '' + count);
        if (quality && (quality as string) !== 'auto') requestBody.append('quality', quality);
        if (size && (size as string) !== 'auto') requestBody.append('size', size);
        // if (model === 'dall-e-2') requestBody.append('response_format', 'b64_json');
        requestBody.append('user', user || 'Big-AGI');

        // append input images
        const imagesCount = editConfig.inputImages.length;
        for (let i = 0; i < imagesCount; i++) {
          const { base64, mimeType } = editConfig.inputImages[i];
          requestBody.append(
            imagesCount === 1 ? 'image' : 'image[]',
            server_base64ToBlob(base64, mimeType),
            `image_${i}.${mimeType.split('/')[1] || 'png'}`, // important to be a unique filename
          );
        }

        // append mask image if provided
        if (editConfig.maskImage)
          requestBody.append(
            'mask',
            server_base64ToBlob(editConfig.maskImage.base64, editConfig.maskImage.mimeType),
            `mask.${editConfig.maskImage.mimeType.split('/')[1] || 'png'}`,
          );
      }

      // -> state.started
      yield { p: 'state', state: 'started' };

      // -> heartbeats, while waiting for the generation response
      const wireOpenAICreateImageOutput = yield* heartbeatsWhileAwaiting(
        openaiPOSTOrThrow<OpenAIWire_API_Images_Generations.Response, OpenAIWire_API_Images_Generations.Request | FormData>(
          access,
          config.model,  // modelRefId not really needed for these endpoints
          requestBody,
          isEdit ? '/v1/images/edits' : '/v1/images/generations',
          signal, // wire the signal from the input
        )
          .catch((error: any) => {
            // if aborted, ignore the error, or else we'll throw an error
            if (signal?.aborted)
              return null; // de-facto ignores the error, and the connection is already gone

            // otherwise, re-throw the error
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Error: ${error?.message || error?.toString() || 'Unknown error'}`,
              cause: error,
            });
          }),
      );

      // null: there was an error
      if (!wireOpenAICreateImageOutput)
        return null;

      // common image fields
      const [width, height] = (config.size as any) === 'auto'
        ? [1024, 1024] // NOTE: this is broken, bad assumption, but so that we don't throw an error
        : config.size.split('x').map(nStr => parseInt(nStr));
      if (!width || !height) {
        console.error(`openai.router.createImages: invalid size ${config.size}`);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `[OpenAI Issue] Invalid size ${config.size}` });
      }
      const { count: _ignoreCount, prompt: origPrompt, ...parameters } = config;

      // parse the response and emit all images in the response
      const { data: images, usage: tokens } = OpenAIWire_API_Images_Generations.Response_schema.parse(wireOpenAICreateImageOutput);
      for (const image of images) {
        if (!('b64_json' in image)) {
          console.error(`openai.router.createImages: expected b64_json`, { image });
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `[OpenAI Issue] Expected a b64_json, got a url` });
        }

        // -> createImage
        yield {
          p: 'createImage',
          image: {
            mimeType: genImageMimeType,
            base64Data: image.b64_json!,
            altText: image.revised_prompt || origPrompt,
            width,
            height,
            ...(tokens?.input_tokens !== undefined ? { inputTokens: tokens.input_tokens } : {}),
            ...(tokens?.output_tokens !== undefined ? { outputTokens: tokens.output_tokens } : {}),
            generatorName: config.model,
            parameters: parameters,
            generatedAt: new Date().toISOString(),
          },
        };
      }
    }),


  /* [OpenAI] check for content policy violations */
  moderation: edgeProcedure
    .input(moderationInputSchema)
    .mutation(async ({ input: { access, text } }): Promise<OpenAIWire_API_Moderations_Create.Response> => {
      try {

        return await openaiPOSTOrThrow<OpenAIWire_API_Moderations_Create.Response, OpenAIWire_API_Moderations_Create.Request>(access, null, {
          input: text,
          model: 'text-moderation-latest',
        }, '/v1/moderations');

      } catch (error: any) {
        if (error.code === 'ECONNRESET')
          throw new TRPCError({ code: 'CLIENT_CLOSED_REQUEST', message: 'Connection reset by the client.' });

        console.error('api/openai/moderation error:', error);
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Error: ${error?.message || error?.toString() || 'Unknown error'}` });
      }
    }),


  /// Dialect-specific procedures ///

  /* [LocalAI] List all Model Galleries */
  dialectLocalAI_galleryModelsAvailable: edgeProcedure
    .input(listModelsInputSchema)
    .query(async ({ input: { access } }) => {
      const wireLocalAIModelsAvailable = await openaiGETOrThrow(access, '/models/available');
      return wireLocalAIModelsAvailableOutputSchema.parse(wireLocalAIModelsAvailable).filter(model => !!model.name);
    }),

  /* [LocalAI] Download a model from a Model Gallery */
  dialectLocalAI_galleryModelsApply: edgeProcedure
    .input(z.object({
      access: openAIAccessSchema,
      galleryName: z.string(),
      modelName: z.string(),
    }))
    .mutation(async ({ input: { access, galleryName, modelName } }) => {
      const galleryModelId = `${galleryName}@${modelName}`;
      const wireLocalAIModelApply = await openaiPOSTOrThrow(access, null, { id: galleryModelId }, '/models/apply');
      return wireLocalAIModelsApplyOutputSchema.parse(wireLocalAIModelApply);
    }),

  /* [LocalAI] Poll for a Model download Job status */
  dialectLocalAI_galleryModelsJob: edgeProcedure
    .input(z.object({
      access: openAIAccessSchema,
      jobId: z.string(),
    }))
    .query(async ({ input: { access, jobId } }) => {
      const wireLocalAIModelsJobs = await openaiGETOrThrow(access, `/models/jobs/${jobId}`);
      return wireLocalAIModelsListOutputSchema.parse(wireLocalAIModelsJobs);
    }),

});


// Mappers - all access logic is now in openai.access.ts

async function openaiGETOrThrow<TOut extends object>(access: OpenAIAccessSchema, apiPath: string, signal: undefined | AbortSignal = undefined): Promise<TOut> {
  const { headers, url } = openAIAccess(access, null, apiPath);
  return await fetchJsonOrTRPCThrow<TOut>({ url, headers, name: `OpenAI/${serverCapitalizeFirstLetter(access.dialect)}`, signal });
}

async function openaiPOSTOrThrow<TOut extends object, TPostBody extends object | FormData>(access: OpenAIAccessSchema, modelRefId: string | null, body: TPostBody, apiPath: string, signal: undefined | AbortSignal = undefined): Promise<TOut> {
  const { headers, url } = openAIAccess(access, modelRefId, apiPath);
  return await fetchJsonOrTRPCThrow<TOut, TPostBody>({ url, method: 'POST', headers, body, name: `OpenAI/${serverCapitalizeFirstLetter(access.dialect)}`, signal });
}


/** @serverSide Buffer is a Node.js API, not a Browser API. */
function server_base64ToBlob(base64Data: string, mimeType: string) {
  const buffer = Buffer.from(base64Data, 'base64');
  return new Blob([buffer], { type: mimeType });
}
