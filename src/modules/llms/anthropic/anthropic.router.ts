import { z } from 'zod';

import { createTRPCRouter, publicProcedure } from '~/modules/trpc/trpc.server';
import { fetchJsonOrTRPCError } from '~/modules/trpc/trpc.serverutils';

import { historySchema, modelSchema } from '~/modules/llms/openai/openai.router';

import { AnthropicWire } from './anthropic.types';
import { TRPCError } from '@trpc/server';


// Input Schemas

const anthropicAccessSchema = z.object({
  anthropicKey: z.string().trim(),
  anthropicHost: z.string().trim(),
});

export const chatGenerateSchema = z.object({ access: anthropicAccessSchema, model: modelSchema, history: historySchema });

const listModelsSchema = z.object({ access: anthropicAccessSchema });


// Output Schemas

const chatGenerateOutputSchema = z.object({
  role: z.enum(['assistant', 'system', 'user']),
  content: z.string(),
  finish_reason: z.union([z.enum(['stop', 'length']), z.null()]),
});

const listModelsOutputSchema = z.object({
  models: z.array(z.object({
    id: z.string(),
    name: z.string(),
    created: z.number(),
    description: z.string(),
    contextWindow: z.number(),
    hidden: z.boolean().optional(),
  })),
});


export const llmAnthropicRouter = createTRPCRouter({

  /**
   *
   */
  chatGenerate: publicProcedure
    .input(chatGenerateSchema)
    .output(chatGenerateOutputSchema)
    .mutation(async ({ input }) => {

      const { access, model, history } = input;

      // ensure history has at least one message, and not from the assistant
      if (history.length === 0 || history[0].role === 'assistant')
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `[Anthropic Issue] Need one human character at least` });

      const wireCompletions = await anthropicPOST<AnthropicWire.Complete.Response, AnthropicWire.Complete.Request>(
        access,
        anthropicCompletionRequest(model, history, false),
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


  /**
   * List the Models available
   *
   * See https://github.com/anthropics/anthropic-sdk-typescript/commit/7c53ded6b7f5f3efec0df295181f18469c37e09d?diff=unified for
   * some details on the models, as the API docs are scarce: https://docs.anthropic.com/claude/reference/selecting-a-model
   */
  listModels: publicProcedure
    .input(listModelsSchema)
    .output(listModelsOutputSchema)
    .query(async () => {
      const roundTime = (date: string) => Math.round(new Date(date).getTime() / 1000);
      return {
        models: [
          {
            id: 'claude-2.0',
            name: 'Claude 2',
            created: roundTime('2023-07-11'),
            description: 'Claude-2 is the latest version of Claude',
            contextWindow: 100000,
          },
          {
            id: 'claude-instant-1.2',
            name: 'Claude Instant 1.2',
            created: roundTime('2023-08-09'),
            description: 'Precise and faster',
            contextWindow: 100000,
          },
          {
            id: 'claude-instant-1.1',
            name: 'Claude Instant 1.1',
            created: roundTime('2023-03-14'),
            description: 'Precise and fast',
            contextWindow: 100000,
            hidden: true,
          },
          {
            id: 'claude-1.3',
            name: 'Claude 1.3',
            created: roundTime('2023-03-14'),
            description: 'Claude 1.3 is the latest version of Claude v1',
            contextWindow: 100000,
            hidden: true,
          },
          {
            id: 'claude-1.0',
            name: 'Claude 1',
            created: roundTime('2023-03-14'),
            description: 'Claude 1.0 is the first version of Claude',
            contextWindow: 9000,
            hidden: true,
          },
        ],
      };
    }),

});

type AccessSchema = z.infer<typeof anthropicAccessSchema>;
type ModelSchema = z.infer<typeof modelSchema>;
type HistorySchema = z.infer<typeof historySchema>;

async function anthropicPOST<TOut, TPostBody>(access: AccessSchema, body: TPostBody, apiPath: string /*, signal?: AbortSignal*/): Promise<TOut> {
  const { headers, url } = anthropicAccess(access, apiPath);
  return await fetchJsonOrTRPCError<TOut, TPostBody>(url, 'POST', headers, body, 'Anthropic');
}


const DEFAULT_ANTHROPIC_HOST = 'api.anthropic.com';

export function anthropicAccess(access: AccessSchema, apiPath: string): {
  headers: HeadersInit,
  url: string
} {
  // API version
  const apiVersion = '2023-06-01';

  // API key
  const anthropicKey = access.anthropicKey || process.env.ANTHROPIC_API_KEY || '';

  // API host
  let anthropicHost = access.anthropicHost || process.env.ANTHROPIC_API_HOST || DEFAULT_ANTHROPIC_HOST;
  if (!anthropicHost.startsWith('http'))
    anthropicHost = `https://${anthropicHost}`;
  if (anthropicHost.endsWith('/') && apiPath.startsWith('/'))
    anthropicHost = anthropicHost.slice(0, -1);

  // warn if no key - only for default host
  if (!anthropicKey && anthropicHost.indexOf(DEFAULT_ANTHROPIC_HOST) !== -1)
    throw new Error('Missing Anthropic API Key. Add it on the UI (Models Setup) or server side (your deployment).');

  return {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'anthropic-version': apiVersion,
      'X-API-Key': anthropicKey,
    },
    url: anthropicHost + apiPath,
  };
}

export function anthropicCompletionRequest(model: ModelSchema, history: HistorySchema, stream: boolean): AnthropicWire.Complete.Request {
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