import * as z from 'zod/v4';
import { TRPCError } from '@trpc/server';

import { createTRPCRouter, publicProcedure } from '~/server/trpc/trpc.server';
import { env } from '~/server/env';
import { fetchJsonOrTRPCThrow, TRPCFetcherError } from '~/server/trpc/trpc.router.fetchers';
import { serverCapitalizeFirstLetter } from '~/server/wire';

import type { T2ICreateImageAsyncStreamOp } from '~/modules/t2i/t2i.server';
import { OpenAIWire_API_Images_Generations, OpenAIWire_API_Moderations_Create } from '~/modules/aix/server/dispatch/wiretypes/openai.wiretypes';
import { heartbeatsWhileAwaiting } from '~/modules/aix/server/dispatch/heartbeatsWhileAwaiting';

import { Brand } from '~/common/app.config';

import { ListModelsResponse_schema, ModelDescriptionSchema, RequestAccessValues } from '../llm.server.types';
import { azureOpenAIAccess } from './models/azure.models';
import { listModelsRunDispatch } from '../listModels.dispatch';
import { wireLocalAIModelsApplyOutputSchema, wireLocalAIModelsAvailableOutputSchema, wireLocalAIModelsListOutputSchema } from './wiretypes/localai.wiretypes';


const openAIDialects = z.enum([
  'alibaba', 'azure', 'deepseek', 'groq', 'lmstudio', 'localai', 'mistral', 'moonshot', 'openai', 'openpipe', 'openrouter', 'perplexity', 'togetherai', 'xai',
]);
export type OpenAIDialects = z.infer<typeof openAIDialects>;

export const openAIAccessSchema = z.object({
  dialect: openAIDialects,
  oaiKey: z.string().trim(),
  oaiOrg: z.string().trim(), // [OpenPipe] we have a hack here, where we put the tags stringified JSON in here - cleanup in the future
  oaiHost: z.string().trim(),
  heliKey: z.string().trim(),
  moderationCheck: z.boolean(),
});
export type OpenAIAccessSchema = z.infer<typeof openAIAccessSchema>;

// export const openAIModelSchema = z.object({
//   id: z.string(),
//   temperature: z.number().min(0).max(2).optional(),
//   maxTokens: z.number().min(1).optional(),
// });
// export type OpenAIModelSchema = z.infer<typeof openAIModelSchema>;

// export const openAIHistorySchema = z.array(z.object({
//   role: z.enum(['assistant', 'system', 'user'/*, 'function'*/]),
//   content: z.string(),
// }));
// export type OpenAIHistorySchema = z.infer<typeof openAIHistorySchema>;


// Fixup host function

/** Add https if missing, and remove trailing slash if present and the path starts with a slash. */
export function fixupHost(host: string, apiPath: string): string {
  if (!host)
    return '';
  if (!host.startsWith('http'))
    host = `https://${host}`;
  if (host.endsWith('/') && apiPath.startsWith('/'))
    host = host.slice(0, -1);
  return host;
}


// Router Input Schemas

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
  listModels: publicProcedure
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
  createImages: publicProcedure
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
  moderation: publicProcedure
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
  dialectLocalAI_galleryModelsAvailable: publicProcedure
    .input(listModelsInputSchema)
    .query(async ({ input: { access } }) => {
      const wireLocalAIModelsAvailable = await openaiGETOrThrow(access, '/models/available');
      return wireLocalAIModelsAvailableOutputSchema.parse(wireLocalAIModelsAvailable);
    }),

  /* [LocalAI] Download a model from a Model Gallery */
  dialectLocalAI_galleryModelsApply: publicProcedure
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
  dialectLocalAI_galleryModelsJob: publicProcedure
    .input(z.object({
      access: openAIAccessSchema,
      jobId: z.string(),
    }))
    .query(async ({ input: { access, jobId } }) => {
      const wireLocalAIModelsJobs = await openaiGETOrThrow(access, `/models/jobs/${jobId}`);
      return wireLocalAIModelsListOutputSchema.parse(wireLocalAIModelsJobs);
    }),

});


const DEFAULT_ALIBABA_HOST = 'https://dashscope-intl.aliyuncs.com/compatible-mode';
const DEFAULT_HELICONE_OPENAI_HOST = 'oai.hconeai.com';
const DEFAULT_DEEPSEEK_HOST = 'https://api.deepseek.com';
const DEFAULT_GROQ_HOST = 'https://api.groq.com/openai';
const DEFAULT_LOCALAI_HOST = 'http://127.0.0.1:8080';
const DEFAULT_MISTRAL_HOST = 'https://api.mistral.ai';
const DEFAULT_MOONSHOT_HOST = 'https://api.moonshot.ai';
const DEFAULT_OPENAI_HOST = 'api.openai.com';
const DEFAULT_OPENPIPE_HOST = 'https://app.openpipe.ai/api';
const DEFAULT_OPENROUTER_HOST = 'https://openrouter.ai/api';
const DEFAULT_PERPLEXITY_HOST = 'https://api.perplexity.ai';
const DEFAULT_TOGETHERAI_HOST = 'https://api.together.xyz';
const DEFAULT_XAI_HOST = 'https://api.x.ai';


/**
 * Get a random key from a comma-separated list of API keys
 * @param multiKeyString Comma-separated string of API keys
 * @returns A randomly selected single API key
 */
function getRandomKeyFromMultiKey(multiKeyString: string): string {
  if (!multiKeyString.includes(','))
    return multiKeyString;

  const multiKeys = multiKeyString
    .split(',')
    .map(key => key.trim())
    .filter(Boolean);

  if (!multiKeys.length)
    return '';

  return multiKeys[Math.floor(Math.random() * multiKeys.length)];
}

export function openAIAccess(access: OpenAIAccessSchema, modelRefId: string | null, apiPath: string): RequestAccessValues {
  switch (access.dialect) {

    case 'alibaba':
      let alibabaOaiKey = access.oaiKey || env.ALIBABA_API_KEY || '';
      const alibabaOaiHost = fixupHost(access.oaiHost || env.ALIBABA_API_HOST || DEFAULT_ALIBABA_HOST, apiPath);

      // Use function to select a random key if multiple keys are provided
      alibabaOaiKey = getRandomKeyFromMultiKey(alibabaOaiKey);

      if (!alibabaOaiKey || !alibabaOaiHost)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing Alibaba API Key. Add it on the UI or server side (your deployment).' });

      return {
        headers: {
          'Authorization': `Bearer ${alibabaOaiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        url: alibabaOaiHost + apiPath,
      };


    case 'azure':
      return azureOpenAIAccess(access, modelRefId, apiPath);


    case 'deepseek':
      // https://platform.deepseek.com/api-docs/
      let deepseekKey = access.oaiKey || env.DEEPSEEK_API_KEY || '';
      const deepseekHost = fixupHost(access.oaiHost || DEFAULT_DEEPSEEK_HOST, apiPath);

      // Use function to select a random key if multiple keys are provided
      deepseekKey = getRandomKeyFromMultiKey(deepseekKey);

      if (!deepseekKey || !deepseekHost)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing Deepseek API Key or Host. Add it on the UI (Models Setup) or server side (your deployment).' });

      return {
        headers: {
          'Authorization': `Bearer ${deepseekKey}`,
          'Content-Type': 'application/json',
        },
        url: deepseekHost + apiPath,
      };


    case 'lmstudio':
    case 'openai':
      const oaiKey = access.oaiKey || env.OPENAI_API_KEY || '';
      const oaiOrg = access.oaiOrg || env.OPENAI_API_ORG_ID || '';
      let oaiHost = fixupHost(access.oaiHost || env.OPENAI_API_HOST || DEFAULT_OPENAI_HOST, apiPath);
      // warn if no key - only for default (non-overridden) hosts
      if (!oaiKey && oaiHost.indexOf(DEFAULT_OPENAI_HOST) !== -1)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing OpenAI API Key. Add it on the UI or server side (your deployment).' });

      // [Helicone]
      // We don't change the host (as we do on Anthropic's), as we expect the user to have a custom host.
      let heliKey = access.heliKey || env.HELICONE_API_KEY || false;
      if (heliKey) {
        if (oaiHost.includes(DEFAULT_OPENAI_HOST)) {
          oaiHost = `https://${DEFAULT_HELICONE_OPENAI_HOST}`;
        } else if (!oaiHost.includes(DEFAULT_HELICONE_OPENAI_HOST)) {
          // throw new Error(`The Helicone OpenAI Key has been provided, but the host is not set to https://${DEFAULT_HELICONE_OPENAI_HOST}. Please fix it in the Models Setup page.`);
          heliKey = false;
        }
      }

      // [Cloudflare OpenAI AI Gateway support]
      // Adapts the API path when using a 'universal' or 'openai' Cloudflare AI Gateway endpoint in the "API Host" field
      if (oaiHost.includes('https://gateway.ai.cloudflare.com')) {
        const parsedUrl = new URL(oaiHost);
        const pathSegments = parsedUrl.pathname.split('/').filter(segment => segment.length > 0);

        // The expected path should be: /v1/<ACCOUNT_TAG>/<GATEWAY_URL_SLUG>/<PROVIDER_ENDPOINT>
        if (pathSegments.length < 3 || pathSegments.length > 4 || pathSegments[0] !== 'v1')
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cloudflare AI Gateway API Host is not valid. Please check the API Host field in the Models Setup page.' });

        const [_v1, accountTag, gatewayName, provider] = pathSegments;
        if (provider && provider !== 'openai')
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cloudflare AI Gateway only supports OpenAI as a provider.' });

        if (apiPath.startsWith('/v1'))
          apiPath = apiPath.replace('/v1', '');

        oaiHost = 'https://gateway.ai.cloudflare.com';
        apiPath = `/v1/${accountTag}/${gatewayName}/${provider || 'openai'}${apiPath}`;
      }

      return {
        headers: {
          'Content-Type': 'application/json',
          ...(oaiKey && { Authorization: `Bearer ${oaiKey}` }),
          ...(oaiOrg && { 'OpenAI-Organization': oaiOrg }),
          ...(heliKey && { 'Helicone-Auth': `Bearer ${heliKey}` }),
        },
        url: oaiHost + apiPath,
      };

    case 'groq':
      let groqKey = access.oaiKey || env.GROQ_API_KEY || '';
      const groqHost = fixupHost(access.oaiHost || DEFAULT_GROQ_HOST, apiPath);

      // Use function to select a random key if multiple keys are provided
      groqKey = getRandomKeyFromMultiKey(groqKey);

      if (!groqKey)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing Groq API Key. Add it on the UI (Models Setup) or server side (your deployment).' });

      return {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${groqKey}`,
        },
        url: groqHost + apiPath,
      };


    case 'localai':
      const localAIKey = access.oaiKey || env.LOCALAI_API_KEY || '';
      let localAIHost = fixupHost(access.oaiHost || env.LOCALAI_API_HOST || DEFAULT_LOCALAI_HOST, apiPath);
      return {
        headers: {
          'Content-Type': 'application/json',
          ...(localAIKey && { Authorization: `Bearer ${localAIKey}` }),
        },
        url: localAIHost + apiPath,
      };


    case 'mistral':
      // https://docs.mistral.ai/platform/client
      let mistralKey = access.oaiKey || env.MISTRAL_API_KEY || '';
      const mistralHost = fixupHost(access.oaiHost || DEFAULT_MISTRAL_HOST, apiPath);

      // Use function to select a random key if multiple keys are provided
      mistralKey = getRandomKeyFromMultiKey(mistralKey);

      return {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${mistralKey}`,
        },
        url: mistralHost + apiPath,
      };

    case 'moonshot':
      // https://platform.moonshot.ai/docs/api/chat
      let moonshotKey = access.oaiKey || env.MOONSHOT_API_KEY || '';
      const moonshotHost = fixupHost(access.oaiHost || DEFAULT_MOONSHOT_HOST, apiPath);

      // Use function to select a random key if multiple keys are provided
      moonshotKey = getRandomKeyFromMultiKey(moonshotKey);

      if (!moonshotKey || !moonshotHost)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing Moonshot API Key or Host. Add it on the UI or server side.' });

      return {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${moonshotKey}`,
        },
        url: moonshotHost + apiPath,
      };


    case 'openpipe':
      const openPipeKey = access.oaiKey || env.OPENPIPE_API_KEY || '';
      if (!openPipeKey)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing OpenPipe API Key or Host. Add it on the UI or server side (your deployment).' });

      return {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openPipeKey}`,
          'op-log-request': 'true',
          ...(access.oaiOrg && { 'op-tags': access.oaiOrg }),
        },
        url: fixupHost(DEFAULT_OPENPIPE_HOST, apiPath) + apiPath,
      };

    case 'openrouter':
      let orKey = access.oaiKey || env.OPENROUTER_API_KEY || '';
      const orHost = fixupHost(access.oaiHost || DEFAULT_OPENROUTER_HOST, apiPath);

      // Use function to select a random key if multiple keys are provided
      orKey = getRandomKeyFromMultiKey(orKey);

      if (!orKey || !orHost)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing OpenRouter API Key or Host. Add it on the UI or server side (your deployment).' });

      return {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${orKey}`,
          'HTTP-Referer': Brand.URIs.Home,
          'X-Title': Brand.Title.Base,
        },
        url: orHost + apiPath,
      };

    case 'perplexity':
      let perplexityKey = access.oaiKey || env.PERPLEXITY_API_KEY || '';
      const perplexityHost = fixupHost(access.oaiHost || DEFAULT_PERPLEXITY_HOST, apiPath);

      // Use function to select a random key if multiple keys are provided
      perplexityKey = getRandomKeyFromMultiKey(perplexityKey);

      if (!perplexityKey || !perplexityHost)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing Perplexity API Key or Host. Add it on the UI (Models Setup) or server side (your deployment).' });

      if (apiPath.startsWith('/v1'))
        apiPath = apiPath.replace('/v1', '');

      return {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${perplexityKey}`,
        },
        url: perplexityHost + apiPath,
      };


    case 'togetherai':
      let togetherKey = access.oaiKey || env.TOGETHERAI_API_KEY || '';
      const togetherHost = fixupHost(access.oaiHost || DEFAULT_TOGETHERAI_HOST, apiPath);

      // Use function to select a random key if multiple keys are provided
      togetherKey = getRandomKeyFromMultiKey(togetherKey);

      if (!togetherKey || !togetherHost)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing TogetherAI API Key or Host. Add it on the UI (Models Setup) or server side (your deployment).' });

      return {
        headers: {
          'Authorization': `Bearer ${togetherKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        url: togetherHost + apiPath,
      };


    case 'xai':
      let xaiKey = access.oaiKey || env.XAI_API_KEY || '';

      // Use function to select a random key if multiple keys are provided
      xaiKey = getRandomKeyFromMultiKey(xaiKey);

      if (!xaiKey)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing xAI API Key. Add it on the UI (Models Setup) or server side (your deployment).' });

      return {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${xaiKey}`,
        },
        url: DEFAULT_XAI_HOST + apiPath,
      };

  }
}


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
