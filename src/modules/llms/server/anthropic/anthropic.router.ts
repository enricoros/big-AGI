import { z } from 'zod';
import { TRPCError } from '@trpc/server';

import { createTRPCRouter, publicProcedure } from '~/server/api/trpc.server';
import { env } from '~/server/env.mjs';
import { fetchJsonOrTRPCError } from '~/server/api/trpc.router.fetchers';

import { fixupHost } from '~/common/util/urlUtils';

import { OpenAIHistorySchema, openAIHistorySchema, OpenAIModelSchema, openAIModelSchema } from '../openai/openai.router';
import { llmsChatGenerateOutputSchema, llmsGenerateContextSchema, llmsListModelsOutputSchema } from '../llm.server.types';

import { AnthropicWireMessagesRequest, anthropicWireMessagesRequestSchema, AnthropicWireMessagesResponse, anthropicWireMessagesResponseSchema } from './anthropic.wiretypes';
import { hardcodedAnthropicModels } from './anthropic.models';


// Default hosts
const DEFAULT_API_VERSION_HEADERS = {
  'anthropic-version': '2023-06-01',
  // Former Betas:
  // - messages-2023-12-15: to use the Messages API
  'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15',
};
const DEFAULT_MAX_TOKENS = 2048;
const DEFAULT_ANTHROPIC_HOST = 'api.anthropic.com';
const DEFAULT_HELICONE_ANTHROPIC_HOST = 'anthropic.hconeai.com';


// Mappers

async function anthropicPOST<TOut extends object, TPostBody extends object>(access: AnthropicAccessSchema, body: TPostBody, apiPath: string /*, signal?: AbortSignal*/): Promise<TOut> {
  const { headers, url } = anthropicAccess(access, apiPath);
  return await fetchJsonOrTRPCError<TOut, TPostBody>(url, 'POST', headers, body, 'Anthropic');
}

export function anthropicAccess(access: AnthropicAccessSchema, apiPath: string): { headers: HeadersInit, url: string } {
  // API key
  const anthropicKey = access.anthropicKey || env.ANTHROPIC_API_KEY || '';

  // break for the missing key only on the default host
  if (!anthropicKey && !(access.anthropicHost || env.ANTHROPIC_API_HOST))
    throw new Error('Missing Anthropic API Key. Add it on the UI (Models Setup) or server side (your deployment).');

  // API host
  let anthropicHost = fixupHost(access.anthropicHost || env.ANTHROPIC_API_HOST || DEFAULT_ANTHROPIC_HOST, apiPath);

  // Helicone for Anthropic
  // https://docs.helicone.ai/getting-started/integration-method/anthropic
  const heliKey = access.heliconeKey || env.HELICONE_API_KEY || false;
  if (heliKey) {
    if (!anthropicHost.includes(DEFAULT_ANTHROPIC_HOST) && !anthropicHost.includes(DEFAULT_HELICONE_ANTHROPIC_HOST))
      throw new Error(`The Helicone Anthropic Key has been provided, but the host is set to custom. Please fix it in the Models Setup page.`);
    anthropicHost = `https://${DEFAULT_HELICONE_ANTHROPIC_HOST}`;
  }

  return {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...DEFAULT_API_VERSION_HEADERS,
      'X-API-Key': anthropicKey,
      ...(heliKey && { 'Helicone-Auth': `Bearer ${heliKey}` }),
    },
    url: anthropicHost + apiPath,
  };
}

export function anthropicMessagesPayloadOrThrow(model: OpenAIModelSchema, history: OpenAIHistorySchema, stream: boolean): AnthropicWireMessagesRequest {

  // Take the System prompt, if it's the first message
  // But if it's the only message, treat it as a user message
  history = [...history];
  let systemPrompt: string | undefined = undefined;
  if (history[0]?.role === 'system' && history.length > 1)
    systemPrompt = history.shift()?.content;

  // Transform the OpenAIHistorySchema into the target messages format, ensuring that roles alternate between 'user' and 'assistant'
  const messages = history.reduce(
    (acc, historyItem, index) => {

      // skip empty messages
      if (!historyItem.content.trim()) return acc;

      const lastMessage: AnthropicWireMessagesRequest['messages'][number] | undefined = acc[acc.length - 1];
      const anthropicRole = historyItem.role === 'assistant' ? 'assistant' : 'user';

      if (index === 0 || anthropicRole !== lastMessage?.role) {

        // Hack/Hotfix: if the first role is 'assistant', then prepend a user message otherwise the API call will break;
        //              but what should we really do here?
        if (index === 0 && anthropicRole === 'assistant') {
          if (systemPrompt) {
            // This stinks, as it will duplicate the system prompt; it's the best we can do for now for a better UX
            acc.push({ role: 'user', content: [{ type: 'text', text: systemPrompt }] });
          } else
            throw new Error('The first message in the chat history must be a user message and not an assistant message.');
        }

        // Add a new message object if the role is different from the previous message
        acc.push({
          role: anthropicRole,
          content: [
            { type: 'text', text: historyItem.content },
          ],
        });
      } else {
        // Merge consecutive messages with the same role
        (lastMessage.content as AnthropicWireMessagesRequest['messages'][number]['content']).push(
          { type: 'text', text: historyItem.content },
        );
      }
      return acc;
    },
    [] as AnthropicWireMessagesRequest['messages'],
  );

  // NOTE: if the last message is 'assistant', then the API will perform a continuation - shall we add a user message? TBD

  // NOTE: the following code has been disabled because Anthropic will reject empty text blocks
  // If the messages array is empty, add a default user message
  // if (messages.length === 0)
  //   messages.push({ role: 'user', content: [{ type: 'text', text: '' }] });

  // Construct the request payload
  const payload: AnthropicWireMessagesRequest = {
    model: model.id,
    ...(systemPrompt !== undefined && { system: systemPrompt }),
    messages: messages,
    max_tokens: model.maxTokens || DEFAULT_MAX_TOKENS,
    stream: stream,
    ...(model.temperature !== undefined && { temperature: model.temperature }),
    // metadata: not useful to us
    // stop_sequences: not useful to us
    // top_p: not useful to us
    // top_k: not useful to us
  };

  // Validate the payload against the schema to ensure correctness
  const validated = anthropicWireMessagesRequestSchema.safeParse(payload);
  if (!validated.success)
    throw new Error(`Invalid message sequence for Anthropic models: ${validated.error.errors?.[0]?.message || validated.error}`);

  return validated.data;
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
  // functions: openAIFunctionsSchema.optional(),
  // forceFunctionName: z.string().optional(),
  context: llmsGenerateContextSchema.optional(),
});


// Router

export const llmAnthropicRouter = createTRPCRouter({

  /* [Anthropic] list models - https://docs.anthropic.com/claude/docs/models-overview */
  listModels: publicProcedure
    .input(listModelsInputSchema)
    .output(llmsListModelsOutputSchema)
    .query(() => ({ models: hardcodedAnthropicModels })),

  /* [Anthropic] Message generation (non-streaming) */
  chatGenerateMessage: publicProcedure
    .input(chatGenerateInputSchema)
    .output(llmsChatGenerateOutputSchema)
    .mutation(async ({ input: { access, model, history } }) => {

      // NOTES: doesn't support functions yet, supports multi-modal inputs (but they're not in our history, yet)

      // throw if the message sequence is not okay
      const payload = anthropicMessagesPayloadOrThrow(model, history, false);
      const response = await anthropicPOST<AnthropicWireMessagesResponse, AnthropicWireMessagesRequest>(access, payload, '/v1/messages');
      const completion = anthropicWireMessagesResponseSchema.parse(response);

      // validate output
      if (!completion || completion.type !== 'message' || completion.role !== 'assistant' || completion.stop_reason === undefined)
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `[Anthropic Issue] Invalid Message` });
      if (completion.content.length !== 1 || completion.content[0].type !== 'text')
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `[Anthropic Issue] No Single Text Message (${completion.content.length})` });

      // got the completion (non-streaming)
      return {
        role: completion.role,
        content: completion.content[0].text,
        finish_reason: completion.stop_reason === 'max_tokens' ? 'length' : 'stop',
      };
    }),

});
