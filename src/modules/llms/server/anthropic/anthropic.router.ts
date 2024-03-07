import { z } from 'zod';
import { TRPCError } from '@trpc/server';

import { createTRPCRouter, publicProcedure } from '~/server/api/trpc.server';
import { env } from '~/server/env.mjs';
import { fetchJsonOrTRPCError } from '~/server/api/trpc.router.fetchers';

import { fixupHost } from '~/common/util/urlUtils';

import { OpenAIHistorySchema, openAIHistorySchema, OpenAIModelSchema, openAIModelSchema } from '../openai/openai.router';
import { llmsListModelsOutputSchema, llmsChatGenerateOutputSchema } from '../llm.server.types';

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
  const anthropicKey = access.anthropicKey || env.ANTHROPIC_API_KEY || '';

  // break for the missing key only on the default host
  if (!anthropicKey && (!access.anthropicHost && !env.ANTHROPIC_API_HOST)) {
    throw new Error('Missing Anthropic API Key. Add it on the UI (Models Setup) or server side (your deployment).');
  }

  // API host
  let anthropicHost = fixupHost(access.anthropicHost || env.ANTHROPIC_API_HOST || DEFAULT_ANTHROPIC_HOST, apiPath);

  // Helicone for Anthropic
  // https://docs.helicone.ai/getting-started/integration-method/anthropic
  const heliKey = access.heliconeKey || env.HELICONE_API_KEY || false;
  if (heliKey) {
    if (!anthropicHost.includes(DEFAULT_ANTHROPIC_HOST) && !anthropicHost.includes(DEFAULT_HELICONE_ANTHROPIC_HOST)) {
      throw new Error(`The Helicone Anthropic Key has been provided, but the host is set to custom. Please fix it in the Models Setup page.`);
    }
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

/**
 * Generates the payload for the Anthropic chat completion API.
 *
 * @param model - The OpenAI model configuration.
 * @param history - The conversation history.
 * @param stream - Whether to stream the response. Defaults to false.
 * @returns The payload for the Anthropic chat completion API.
 */
export function anthropicChatCompletionPayload(
  model: OpenAIModelSchema,
  history: OpenAIHistorySchema,
  stream = false,
): AnthropicWire.Messages.CreateRequest {
  // Ensure roles alternate between "user" and "assistant"
  const messages = history.reduce<AnthropicWire.Messages.CreateRequest['messages']>(
    (acc, { role, content }, index) => {
      const anthropicRole = role === 'assistant' ? 'assistant' : 'user';

      if (index === 0 || anthropicRole !== acc[acc.length - 1]?.role) {
        // Add a new message object if the role is different from the previous message
        acc.push({ role: anthropicRole, content });
      } else {
        // Merge consecutive messages with the same role
        acc[acc.length - 1].content += '\n' + content;
      }

      return acc;
    },
    [],
  );

  // If the messages array is empty, add a default user message
  if (messages.length === 0) {
    messages.push({ role: 'user', content: '' });
  }

  return {
    messages,
    model: model.id,
    max_tokens: model.maxTokens,
    stream,
    temperature: model.temperature,
  };
}

/**
 * Sends a POST request to the Anthropic API.
 *
 * @template TOut - The type of the response data.
 * @template TPostBody - The type of the request body.
 * @param access - The Anthropic access configuration.
 * @param body - The request body.
 * @param apiPath - The API path.
 * @returns A promise that resolves to the response data.
 */
async function anthropicPOST<TOut extends object, TPostBody extends object>(
  access: AnthropicAccessSchema,
  body: TPostBody,
  apiPath: string,
): Promise<TOut> {
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
  model: openAIModelSchema,
  history: openAIHistorySchema,
});

// Router

export const llmAnthropicRouter = createTRPCRouter({
  /* Anthropic: list models */
  listModels: publicProcedure
    .input(listModelsInputSchema)
    .output(llmsListModelsOutputSchema)
    .query(() => ({ models: hardcodedAnthropicModels })),

  /* Anthropic: Chat generation */
 /* Anthropic: Chat generation */
chatGenerate: publicProcedure
  .input(chatGenerateInputSchema)
  .output(llmsChatGenerateOutputSchema)
  .mutation(async ({ input }) => {
    const { access, model, history } = input;

    const wireCompletions = await anthropicPOST<
      AnthropicWire.Messages.CreateResponse,
      AnthropicWire.Messages.CreateRequest
    >(access, anthropicChatCompletionPayload(model, history), '/v1/messages');

    // Check if the wireCompletions object is undefined
    if (wireCompletions === undefined) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '[Anthropic Issue] No completions received',
      });
    }

    // Check if messages array is undefined or empty
    if (!wireCompletions.messages || wireCompletions.messages.length === 0) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '[Anthropic Issue] No messages received in the completions',
      });
    }

    const lastMessage = wireCompletions.messages[wireCompletions.messages.length - 1];
    if (!lastMessage || !lastMessage.content) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '[Anthropic Issue] Last message or its content is missing',
      });
    }

    return {
      role: lastMessage.role,
      finish_reason: 'stop',
      content: lastMessage.content,
    };
  }),
});