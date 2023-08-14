import { z } from 'zod';
import { TRPCError } from '@trpc/server';

import { createTRPCRouter, publicProcedure } from '~/modules/trpc/trpc.server';
import { fetchJsonOrTRPCError } from '~/modules/trpc/trpc.serverutils';

import { OpenAI } from './openai.types';


// if (!process.env.OPENAI_API_KEY)
//   console.warn('OPENAI_API_KEY has not been provided in this deployment environment. Will need client-supplied keys, which is not recommended.');


// Input Schemas

const accessSchema = z.object({
  oaiKey: z.string().trim(),
  oaiOrg: z.string().trim(),
  oaiHost: z.string().trim(),
  heliKey: z.string().trim(),
  moderationCheck: z.boolean(),
});

export const modelSchema = z.object({
  id: z.string(),
  temperature: z.number().min(0).max(1).optional(),
  maxTokens: z.number().min(1).max(1000000),
});

export const historySchema = z.array(z.object({
  role: z.enum(['assistant', 'system', 'user'/*, 'function'*/]),
  content: z.string(),
}));

export const functionsSchema = z.array(z.object({
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

export const chatStreamSchema = z.object({
  vendorId: z.enum(['anthropic', 'openai']),
  // shall clean this up a bit
  access: z.union([accessSchema, z.object({ anthropicKey: z.string().trim(), anthropicHost: z.string().trim() })]),
  model: modelSchema, history: historySchema, functions: functionsSchema.optional(),
});
export type ChatStreamSchema = z.infer<typeof chatStreamSchema>;

const chatGenerateSchema = z.object({ access: accessSchema, model: modelSchema, history: historySchema, functions: functionsSchema.optional() });

const chatModerationSchema = z.object({ access: accessSchema, text: z.string() });

const listModelsSchema = z.object({ access: accessSchema, filterGpt: z.boolean().optional() });


// Output Schemas

const chatGenerateWithFunctionsOutputSchema = z.union([
  z.object({
    role: z.enum(['assistant', 'system', 'user']),
    content: z.string(),
    finish_reason: z.union([z.enum(['stop', 'length']), z.null()]),
  }),
  z.object({
    function_name: z.string(),
    function_arguments: z.record(z.any()),
  }),
]);


export const llmOpenAIRouter = createTRPCRouter({

  /**
   * Chat-based message generation
   */
  chatGenerateWithFunctions: publicProcedure
    .input(chatGenerateSchema)
    .output(chatGenerateWithFunctionsOutputSchema)
    .mutation(async ({ input }) => {

      const { access, model, history, functions } = input;
      const isFunctionsCall = !!functions && functions.length > 0;

      const wireCompletions = await openaiPOST<OpenAI.Wire.ChatCompletion.Response, OpenAI.Wire.ChatCompletion.Request>(
        access,
        openAIChatCompletionPayload(model, history, isFunctionsCall ? functions : null, 1, false),
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
      return finish_reason === 'function_call'
        ? parseChatGenerateFCOutput(isFunctionsCall, message as OpenAI.Wire.ChatCompletion.ResponseFunctionCall)
        : parseChatGenerateOutput(message as OpenAI.Wire.ChatCompletion.ResponseMessage, finish_reason);
    }),

  /**
   * Check for content policy violations
   */
  moderation: publicProcedure
    .input(chatModerationSchema)
    .mutation(async ({ input }): Promise<OpenAI.Wire.Moderation.Response> => {
      const { access, text } = input;
      try {

        return await openaiPOST<OpenAI.Wire.Moderation.Response, OpenAI.Wire.Moderation.Request>(access, {
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

  /**
   * List the Models available
   */
  listModels: publicProcedure
    .input(listModelsSchema)
    .query(async ({ input }): Promise<OpenAI.Wire.Models.ModelDescription[]> => {

      const wireModels: OpenAI.Wire.Models.Response = await openaiGET<OpenAI.Wire.Models.Response>(input.access, '/v1/models');

      // filter out the non-gpt models, if requested
      let llms = (wireModels.data || [])
        .filter(model => !input.filterGpt || model.id.includes('gpt'));

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

});


type AccessSchema = z.infer<typeof accessSchema>;
type ModelSchema = z.infer<typeof modelSchema>;
type HistorySchema = z.infer<typeof historySchema>;
type FunctionsSchema = z.infer<typeof functionsSchema>;

async function openaiGET<TOut>(access: AccessSchema, apiPath: string /*, signal?: AbortSignal*/): Promise<TOut> {
  const { headers, url } = openAIAccess(access, apiPath);
  return await fetchJsonOrTRPCError<TOut>(url, 'GET', headers, undefined, 'OpenAI');
}

async function openaiPOST<TOut, TPostBody>(access: AccessSchema, body: TPostBody, apiPath: string /*, signal?: AbortSignal*/): Promise<TOut> {
  const { headers, url } = openAIAccess(access, apiPath);
  return await fetchJsonOrTRPCError<TOut, TPostBody>(url, 'POST', headers, body, 'OpenAI');
}


const DEFAULT_OPENAI_HOST = 'api.openai.com';

export function openAIAccess(access: AccessSchema, apiPath: string): { headers: HeadersInit, url: string } {
  // API key
  const oaiKey = access.oaiKey || process.env.OPENAI_API_KEY || '';

  // Organization ID
  const oaiOrg = access.oaiOrg || process.env.OPENAI_API_ORG_ID || '';

  // API host
  let oaiHost = access.oaiHost || process.env.OPENAI_API_HOST || DEFAULT_OPENAI_HOST;
  if (!oaiHost.startsWith('http'))
    oaiHost = `https://${oaiHost}`;
  if (oaiHost.endsWith('/') && apiPath.startsWith('/'))
    oaiHost = oaiHost.slice(0, -1);

  // Helicone key
  const heliKey = access.heliKey || process.env.HELICONE_API_KEY || '';

  // warn if no key - only for default (unoverridden) hosts
  if (!oaiKey && oaiHost.indexOf(DEFAULT_OPENAI_HOST) !== -1)
    throw new Error('Missing OpenAI API Key. Add it on the UI (Models Setup) or server side (your deployment).');

  return {
    headers: {
      ...(oaiKey && { Authorization: `Bearer ${oaiKey}` }),
      'Content-Type': 'application/json',
      ...(oaiOrg && { 'OpenAI-Organization': oaiOrg }),
      ...(heliKey && { 'Helicone-Auth': `Bearer ${heliKey}` }),
    },
    url: oaiHost + apiPath,
  };
}

export function openAIChatCompletionPayload(model: ModelSchema, history: HistorySchema, functions: FunctionsSchema | null, n: number, stream: boolean): OpenAI.Wire.ChatCompletion.Request {
  return {
    model: model.id,
    messages: history,
    ...(functions && { functions: functions, function_call: 'auto' }),
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