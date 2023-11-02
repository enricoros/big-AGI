import { z } from 'zod';
import { TRPCError } from '@trpc/server';

import { createTRPCRouter, publicProcedure } from '~/server/api/trpc.server';
import { fetchJsonOrTRPCError } from '~/server/api/trpc.serverutils';

import { Brand } from '~/common/brand';

import { OpenAI } from './openai.wiretypes';
import { listModelsOutputSchema, ModelDescriptionSchema } from '~/modules/llms/transports/server/server.common';
import { openAIModelToModelDescription } from '~/modules/llms/vendors/openai/openai.data';


// Input Schemas

export const openAIAccessSchema = z.object({
  dialect: z.enum(['azure', 'openai', 'openrouter']),
  oaiKey: z.string().trim(),
  oaiOrg: z.string().trim(),
  oaiHost: z.string().trim(),
  heliKey: z.string().trim(),
  moderationCheck: z.boolean(),
});
export type OpenAIAccessSchema = z.infer<typeof openAIAccessSchema>;

export const openAIModelSchema = z.object({
  id: z.string(),
  temperature: z.number().min(0).max(1).optional(),
  maxTokens: z.number().min(1).max(1000000),
});

export const openAIHistorySchema = z.array(z.object({
  role: z.enum(['assistant', 'system', 'user'/*, 'function'*/]),
  content: z.string(),
}));

export const openAIFunctionsSchema = z.array(z.object({
  name: z.string(),
  description: z.string().optional(),
  parameters: z.object({
    type: z.literal('object'),
    properties: z.record(z.object({
      type: z.enum(['string', 'number', 'integer', 'boolean']),
      description: z.string().optional(),
      enum: z.array(z.string()).optional(),
    })),
    required: z.array(z.string()).optional(),
  }).optional(),
}));


const listModelsInputSchema = z.object({
  access: openAIAccessSchema,
  onlyChatModels: z.boolean().optional(),
});

const chatGenerateWithFunctionsInputSchema = z.object({
  access: openAIAccessSchema,
  model: openAIModelSchema, history: openAIHistorySchema,
  functions: openAIFunctionsSchema.optional(), forceFunctionName: z.string().optional(),
});

const moderationInputSchema = z.object({
  access: openAIAccessSchema,
  text: z.string(),
});


// Output Schemas

export const openAIChatGenerateOutputSchema = z.object({
  role: z.enum(['assistant', 'system', 'user']),
  content: z.string(),
  finish_reason: z.union([z.enum(['stop', 'length']), z.null()]),
});

const openAIChatGenerateWithFunctionsOutputSchema = z.union([
  openAIChatGenerateOutputSchema,
  z.object({
    function_name: z.string(),
    function_arguments: z.record(z.any()),
  }),
]);


export const llmOpenAIRouter = createTRPCRouter({

  /* OpenAI: List the Models available */
  listModels: publicProcedure
    .input(listModelsInputSchema)
    .query(async ({ input }): Promise<OpenAI.Wire.Models.ModelDescription[]> => {

      const wireModels: OpenAI.Wire.Models.Response = await openaiGET<OpenAI.Wire.Models.Response>(input.access, '/v1/models');

      let llms = wireModels.data || [];

      // filter out the non-gpt models, if requested (only by OpenAI right now)
      if (llms.length && input.onlyChatModels) {
        llms = llms.filter(model => {
          if (model.id.includes('-instruct'))
            return false;
          return model.id.includes('gpt');
        });
      }

      // remove models with duplicate ids (can happen for local servers)
      const preFilterCount = llms.length;
      llms = llms.filter((model, index) => llms.findIndex(m => m.id === model.id) === index);
      if (preFilterCount !== llms.length)
        console.warn(`openai.router.listModels: Duplicate model ids found, removed ${preFilterCount - llms.length} models`);

      // sort by which model has the least number of '-' in the name, and then by id, decreasing
      llms.sort((a, b) => {
        // model that have '-0' in their name go at the end
        // if (a.id.includes('-0') && !b.id.includes('-0')) return 1;
        // if (!a.id.includes('-0') && b.id.includes('-0')) return -1;

        // sort by the first 5 chars of id, decreasing, then by the number of '-' in the name
        const aId = a.id.slice(0, 5);
        const bId = b.id.slice(0, 5);
        if (aId === bId) {
          const aCount = a.id.split('-').length;
          const bCount = b.id.split('-').length;
          if (aCount === bCount)
            return a.id.localeCompare(b.id);
          return aCount - bCount;
        }
        return bId.localeCompare(aId);
      });

      return llms;
    }),

  /* Azure: List the Models available from the 'deployments' */
  listModelsAzure: publicProcedure
    .input(listModelsInputSchema)
    .output(listModelsOutputSchema)
    .query(async ({ input }) => {

      // fetch the Azure OpenAI 'deployments'
      const azureModels = await openaiGET(input.access, `/openai/deployments?api-version=2023-03-15-preview`);

      // parse and validate output, and take the GPT models only (e.g. no 'whisper')
      const wireAzureListDeploymentsSchema = z.object({
        data: z.array(z.object({
          // scale_settings: z.object({ scale_type: z.string() }),
          model: z.string(),
          owner: z.enum(['organization-owner']),
          id: z.string(),
          status: z.enum(['succeeded']),
          created_at: z.number(),
          updated_at: z.number(),
          object: z.literal('deployment'),
        })),
        object: z.literal('list'),
      });
      const wireModels = wireAzureListDeploymentsSchema.parse(azureModels).data;

      // map to ModelDescriptions
      const models: ModelDescriptionSchema[] = wireModels
        .filter(m => m.model.includes('gpt'))
        .map((model): ModelDescriptionSchema => {
          const { id, label, ...rest } = openAIModelToModelDescription(model.model, model.created_at, model.updated_at);
          return {
            id: model.id,
            label: `${label} (${model.id})`,
            ...rest,
          };
        });
      return { models };
    }),

  /* OpenAI: chat generation */
  chatGenerateWithFunctions: publicProcedure
    .input(chatGenerateWithFunctionsInputSchema)
    .output(openAIChatGenerateWithFunctionsOutputSchema)
    .mutation(async ({ input }) => {

      const { access, model, history, functions, forceFunctionName } = input;
      const isFunctionsCall = !!functions && functions.length > 0;

      const wireCompletions = await openaiPOST<OpenAI.Wire.ChatCompletion.Response, OpenAI.Wire.ChatCompletion.Request>(
        access, model.id,
        openAIChatCompletionPayload(model, history, isFunctionsCall ? functions : null, forceFunctionName ?? null, 1, false),
        '/v1/chat/completions',
      );

      // expect a single output
      if (wireCompletions?.choices?.length !== 1)
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `[OpenAI Issue] Expected 1 completion, got ${wireCompletions?.choices?.length}` });
      let { message, finish_reason } = wireCompletions.choices[0];

      // LocalAI hack/workaround, until https://github.com/go-skynet/LocalAI/issues/788 is fixed
      if (finish_reason === undefined)
        finish_reason = 'stop';

      // check for a function output
      // NOTE: this includes a workaround for when we requested a function but the model could not deliver
      return (finish_reason === 'function_call' || 'function_call' in message)
        ? parseChatGenerateFCOutput(isFunctionsCall, message as OpenAI.Wire.ChatCompletion.ResponseFunctionCall)
        : parseChatGenerateOutput(message as OpenAI.Wire.ChatCompletion.ResponseMessage, finish_reason);
    }),

  /* OpenAI: check for content policy violations */
  moderation: publicProcedure
    .input(moderationInputSchema)
    .mutation(async ({ input }): Promise<OpenAI.Wire.Moderation.Response> => {
      const { access, text } = input;
      try {

        return await openaiPOST<OpenAI.Wire.Moderation.Response, OpenAI.Wire.Moderation.Request>(access, null, {
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

});


type ModelSchema = z.infer<typeof openAIModelSchema>;
type HistorySchema = z.infer<typeof openAIHistorySchema>;
type FunctionsSchema = z.infer<typeof openAIFunctionsSchema>;

async function openaiGET<TOut extends object>(access: OpenAIAccessSchema, apiPath: string /*, signal?: AbortSignal*/): Promise<TOut> {
  const { headers, url } = openAIAccess(access, null, apiPath);
  return await fetchJsonOrTRPCError<TOut>(url, 'GET', headers, undefined, 'OpenAI');
}

async function openaiPOST<TOut extends object, TPostBody extends object>(access: OpenAIAccessSchema, modelRefId: string | null, body: TPostBody, apiPath: string /*, signal?: AbortSignal*/): Promise<TOut> {
  const { headers, url } = openAIAccess(access, modelRefId, apiPath);
  return await fetchJsonOrTRPCError<TOut, TPostBody>(url, 'POST', headers, body, 'OpenAI');
}


const DEFAULT_OPENAI_HOST = 'api.openai.com';
const DEFAULT_OPENROUTER_HOST = 'https://openrouter.ai/api';
const DEFAULT_HELICONE_OPENAI_HOST = 'oai.hconeai.com';

export function fixupHost(host: string, apiPath: string): string {
  if (!host.startsWith('http'))
    host = `https://${host}`;
  if (host.endsWith('/') && apiPath.startsWith('/'))
    host = host.slice(0, -1);
  return host;
}

export function openAIAccess(access: OpenAIAccessSchema, modelRefId: string | null, apiPath: string): { headers: HeadersInit, url: string } {
  switch (access.dialect) {

    case 'azure':
      const azureKey = access.oaiKey || process.env.AZURE_OPENAI_API_KEY || '';
      const azureHost = fixupHost(access.oaiHost || process.env.AZURE_OPENAI_API_ENDPOINT || '', apiPath);
      if (!azureKey || !azureHost)
        throw new Error('Missing Azure API Key or Host. Add it on the UI (Models Setup) or server side (your deployment).');

      let url = azureHost;
      if (apiPath.startsWith('/v1/')) {
        if (!modelRefId)
          throw new Error('Azure OpenAI API needs a deployment id');
        url += `/openai/deployments/${modelRefId}/${apiPath.replace('/v1/', '')}?api-version=2023-07-01-preview`;
      } else if (apiPath.startsWith('/openai/deployments'))
        url += apiPath;
      else
        throw new Error('Azure OpenAI API path not supported: ' + apiPath);

      return {
        headers: {
          'Content-Type': 'application/json',
          'api-key': azureKey,
        },
        url,
      };


    case 'openai':
      const oaiKey = access.oaiKey || process.env.OPENAI_API_KEY || '';
      const oaiOrg = access.oaiOrg || process.env.OPENAI_API_ORG_ID || '';
      let oaiHost = fixupHost(access.oaiHost || process.env.OPENAI_API_HOST || DEFAULT_OPENAI_HOST, apiPath);
      // warn if no key - only for default (non-overridden) hosts
      if (!oaiKey && oaiHost.indexOf(DEFAULT_OPENAI_HOST) !== -1)
        throw new Error('Missing OpenAI API Key. Add it on the UI (Models Setup) or server side (your deployment).');

      // [Helicone]
      // We don't change the host (as we do on Anthropic's), as we expect the user to have a custom host.
      let heliKey = access.heliKey || process.env.HELICONE_API_KEY || false;
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
          throw new Error('Cloudflare AI Gateway API Host is not valid. Please check the API Host field in the Models Setup page.');

        const [_v1, accountTag, gatewayName, provider] = pathSegments;
        if (provider && provider !== 'openai')
          throw new Error('Cloudflare AI Gateway only supports OpenAI as a provider.');

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


    case 'openrouter':
      const orKey = access.oaiKey || process.env.OPENROUTER_API_KEY || '';
      const orHost = fixupHost(access.oaiHost || DEFAULT_OPENROUTER_HOST, apiPath);
      if (!orKey || !orHost)
        throw new Error('Missing OpenRouter API Key or Host. Add it on the UI (Models Setup) or server side (your deployment).');

      return {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${orKey}`,
          'HTTP-Referer': Brand.URIs.Home,
          'X-Title': Brand.Title.Base,
        },
        url: orHost + apiPath,
      };
  }
}

export function openAIChatCompletionPayload(model: ModelSchema, history: HistorySchema, functions: FunctionsSchema | null, forceFunctionName: string | null, n: number, stream: boolean): OpenAI.Wire.ChatCompletion.Request {
  return {
    model: model.id,
    messages: history,
    ...(functions && { functions: functions, function_call: forceFunctionName ? { name: forceFunctionName } : 'auto' }),
    ...(model.temperature && { temperature: model.temperature }),
    ...(model.maxTokens && { max_tokens: model.maxTokens }),
    n,
    stream,
  };
}

function parseChatGenerateFCOutput(isFunctionsCall: boolean, message: OpenAI.Wire.ChatCompletion.ResponseFunctionCall) {
  // NOTE: Defensive: we run extensive validation because the API is not well tested and documented at the moment
  if (!isFunctionsCall)
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `[OpenAI Issue] Received a function call without a function call request`,
    });

  // parse the function call
  const fcMessage = message as any as OpenAI.Wire.ChatCompletion.ResponseFunctionCall;
  if (fcMessage.content !== null)
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `[OpenAI Issue] Expected a function call, got a message`,
    });

  // got a function call, so parse it
  const fc = fcMessage.function_call;
  if (!fc || !fc.name || !fc.arguments)
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `[OpenAI Issue] Issue with the function call, missing name or arguments`,
    });

  // decode the function call
  const fcName = fc.name;
  let fcArgs: object;
  try {
    fcArgs = JSON.parse(fc.arguments);
  } catch (error: any) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `[OpenAI Issue] Issue with the function call, arguments are not valid JSON`,
    });
  }

  return {
    function_name: fcName,
    function_arguments: fcArgs,
  };
}

function parseChatGenerateOutput(message: OpenAI.Wire.ChatCompletion.ResponseMessage, finish_reason: 'stop' | 'length' | null) {
  // validate the message
  if (message.content === null)
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `[OpenAI Issue] Expected a message, got a null message`,
    });

  return {
    role: message.role,
    content: message.content,
    finish_reason: finish_reason,
  };
}