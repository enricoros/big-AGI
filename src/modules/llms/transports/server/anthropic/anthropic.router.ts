import { z } from 'zod';
import { TRPCError } from '@trpc/server';

import { createTRPCRouter, publicProcedure } from '~/server/api/trpc.server';
import { fetchJsonOrTRPCError } from '~/server/api/trpc.serverutils';

import { fixupHost, openAIChatGenerateOutputSchema, OpenAIHistorySchema, openAIHistorySchema, OpenAIModelSchema, openAIModelSchema } from '../openai/openai.router';
import { listModelsOutputSchema } from '../server.schemas';

import { AnthropicWire } from './anthropic.wiretypes';
import { hardcodedAnthropicModels } from './anthropic.models';


// Default hosts
const DEFAULT_ANTHROPIC_HOST = 'api.anthropic.com';
const DEFAULT_HELICONE_ANTHROPIC_HOST = 'anthropic.hconeai.com';


// Mappers

export function anthropicAccess(access: AnthropicAccessSchema, apiPath: string): { headers: HeadersInit, url: string } {
  // API version
  const apiVersion = '2023-06-01';

  // API key
  const anthropicKey = access.anthropicKey || process.env.ANTHROPIC_API_KEY || '';

  // break for the missing key only on the default host
  if (!anthropicKey)
    if (!access.anthropicHost && !process.env.ANTHROPIC_API_HOST)
      throw new Error('Missing Anthropic API Key. Add it on the UI (Models Setup) or server side (your deployment).');

  // API host
  let anthropicHost = fixupHost(access.anthropicHost || process.env.ANTHROPIC_API_HOST || DEFAULT_ANTHROPIC_HOST, apiPath);

  // Helicone for Anthropic
  // https://docs.helicone.ai/getting-started/integration-method/anthropic
  const heliKey = access.heliconeKey || process.env.HELICONE_API_KEY || false;
  if (heliKey) {
    if (!anthropicHost.includes(DEFAULT_ANTHROPIC_HOST) && !anthropicHost.includes(DEFAULT_HELICONE_ANTHROPIC_HOST))
      throw new Error(`The Helicone Anthropic Key has been provided, but the host is set to custom. Please fix it in the Models Setup page.`);
    anthropicHost = `https://${DEFAULT_HELICONE_ANTHROPIC_HOST}`;
  }

  return {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'anthropic-version': apiVersion,
      'X-API-Key': anthropicKey,
      ...(heliKey && { 'Helicone-Auth': `Bearer ${heliKey}` }),
    },
    url: anthropicHost + apiPath,
  };
}

export function anthropicChatCompletionPayload(model: OpenAIModelSchema, history: OpenAIHistorySchema, stream: boolean): AnthropicWire.Complete.Request {
  // encode the prompt for Claude models
  const prompt = history.map(({ role, content }) => {
    return role === 'assistant' ? `\n\nAssistant: ${content}` : `\n\nHuman: ${content}`;
  }).join('') + '\n\nAssistant:';
  return {
    prompt,
    model: model.id,
    max_tokens_to_sample: model.maxTokens,
    stream,
    ...(model.temperature && { temperature: model.temperature }),
  };
}

async function anthropicPOST<TOut extends object, TPostBody extends object>(access: AnthropicAccessSchema, body: TPostBody, apiPath: string /*, signal?: AbortSignal*/): Promise<TOut> {
  const { headers, url } = anthropicAccess(access, apiPath);
  return await fetchJsonOrTRPCError<TOut, TPostBody>(url, 'POST', headers, body, 'Anthropic');
}


// Input Schemas

export const anthropicAccessSchema = z.object({
  dialect: z.literal('anthropic'),
  anthropicKey: z.string().trim(),
  anthropicHost: z.string().trim().nullable(),
  heliconeKey: z.string().trim().nullable(),
});
export type AnthropicAccessSchema = z.infer<typeof anthropicAccessSchema>;

const listModelsInputSchema = z.object({
  access: anthropicAccessSchema,
});

const chatGenerateInputSchema = z.object({
  access: anthropicAccessSchema,
  model: openAIModelSchema, history: openAIHistorySchema,
});


// Router

export const llmAnthropicRouter = createTRPCRouter({

  /* Anthropic: list models
   *
   * See https://github.com/anthropics/anthropic-sdk-typescript/commit/7c53ded6b7f5f3efec0df295181f18469c37e09d?diff=unified for
   * some details on the models, as the API docs are scarce: https://docs.anthropic.com/claude/reference/selecting-a-model
   */
  listModels: publicProcedure
    .input(listModelsInputSchema)
    .output(listModelsOutputSchema)
    .query(() => ({ models: hardcodedAnthropicModels })),

  /* Anthropic: Chat generation */
  chatGenerate: publicProcedure
    .input(chatGenerateInputSchema)
    .output(openAIChatGenerateOutputSchema)
    .mutation(async ({ input }) => {

      const { access, model, history } = input;

      // ensure history has at least one message, and not from the assistant
      if (history.length === 0 || history[0].role === 'assistant')
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `[Anthropic Issue] Need one human character at least` });

      const wireCompletions = await anthropicPOST<AnthropicWire.Complete.Response, AnthropicWire.Complete.Request>(
        access,
        anthropicChatCompletionPayload(model, history, false),
        '/v1/complete',
      );

      // expect a single output
      if (wireCompletions.completion === undefined)
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `[Anthropic Issue] No completions` });
      if (wireCompletions.stop_reason === undefined)
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `[Anthropic Issue] No stop_reason` });

      // check for a function output
      return {
        role: 'assistant',
        finish_reason: wireCompletions.stop_reason === 'stop_sequence' ? 'stop' : 'length',
        content: wireCompletions.completion || '',
      };
    }),

});
