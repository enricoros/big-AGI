import { z } from 'zod';
import { TRPCError } from '@trpc/server';

import { createTRPCRouter, publicProcedure } from '~/server/api/trpc.server';
import { env } from '~/server/env.mjs';
import { fetchJsonOrTRPCThrow } from '~/server/api/trpc.router.fetchers';

import { fixupHost } from '~/common/util/urlUtils';

import { AnthropicWire_API_Message_Create } from '~/modules/aix/server/dispatch/wiretypes/anthropic.wiretypes';

import { ListModelsResponse_schema, llmsChatGenerateOutputSchema, llmsGenerateContextSchema } from '../llm.server.types';
import { OpenAIHistorySchema, openAIHistorySchema, OpenAIModelSchema, openAIModelSchema } from '../openai/openai.router';

import { hardcodedAnthropicModels } from './anthropic.models';


// Default hosts
const DEFAULT_API_VERSION_HEADERS = {
  'anthropic-version': '2023-06-01',
  // Betas:
  // - messages-2023-12-15: to use the Messages API [now default]
  // - max-tokens-3-5-sonnet-2024-07-15
  //
  // - prompt-caching-2024-07-31: to use the prompt caching feature; adds to any API invocation:
  //   - message_start.message.usage.cache_creation_input_tokens: number
  //   - message_start.message.usage.cache_read_input_tokens: number
  'anthropic-beta': 'prompt-caching-2024-07-31,max-tokens-3-5-sonnet-2024-07-15',
};
const DEFAULT_MAX_TOKENS = 2048;
const DEFAULT_ANTHROPIC_HOST = 'api.anthropic.com';
const DEFAULT_HELICONE_ANTHROPIC_HOST = 'anthropic.hconeai.com';


// Mappers

async function anthropicPOST<TOut extends object, TPostBody extends object>(access: AnthropicAccessSchema, body: TPostBody, apiPath: string /*, signal?: AbortSignal*/): Promise<TOut> {
  const { headers, url } = anthropicAccess(access, apiPath);
  return await fetchJsonOrTRPCThrow<TOut, TPostBody>({ url, method: 'POST', headers, body, name: 'Anthropic' });
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

export function anthropicMessagesPayloadOrThrow(model: OpenAIModelSchema, history: OpenAIHistorySchema, stream: boolean): AnthropicWire_API_Message_Create.Request {

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

      const lastMessage: AnthropicWire_API_Message_Create.Request['messages'][number] | undefined = acc[acc.length - 1];
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
        (lastMessage.content as AnthropicWire_API_Message_Create.Request['messages'][number]['content']).push(
          { type: 'text', text: historyItem.content },
        );
      }
      return acc;
    },
    [] as AnthropicWire_API_Message_Create.Request['messages'],
  );

  // NOTE: if the last message is 'assistant', then the API will perform a continuation - shall we add a user message? TBD

  // NOTE: the following code has been disabled because Anthropic will reject empty text blocks
  // If the messages array is empty, add a default user message
  // if (messages.length === 0)
  //   messages.push({ role: 'user', content: [{ type: 'text', text: '' }] });

  // Construct the request payload
  const payload: AnthropicWire_API_Message_Create.Request = {
    model: model.id,
    ...(systemPrompt !== undefined && { system: [{ type: 'text', text: systemPrompt }] }),
    messages: messages,
    max_tokens: model.maxTokens || DEFAULT_MAX_TOKENS,
    stream: stream,
    ...(model.temperature !== undefined && { temperature: model.temperature }),
    // ...(tools && { tools: tools }),
    // ...(forceToolChoice && { tool_choice: forceToolChoice }),
    // metadata: not useful to us
    // stop_sequences: not useful to us
    // top_p: not useful to us
    // top_k: not useful to us
  };

  // Validate the payload against the schema to ensure correctness
  const validated = AnthropicWire_API_Message_Create.Request_schema.safeParse(payload);
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
  // tools: llmsToolsSchema.optional(),
  context: llmsGenerateContextSchema.optional(),
});


// Router

export const llmAnthropicRouter = createTRPCRouter({

  /* [Anthropic] list models - https://docs.anthropic.com/claude/docs/models-overview */
  listModels: publicProcedure
    .input(listModelsInputSchema)
    .output(ListModelsResponse_schema)
    .query(() => ({ models: hardcodedAnthropicModels })),

  /* [Anthropic] Message generation (non-streaming) */
  chatGenerateMessage: publicProcedure
    .input(chatGenerateInputSchema)
    .output(llmsChatGenerateOutputSchema)
    .mutation(async ({ input: { access, model, history } }) => {

      // NOTES: doesn't support functions yet, supports multi-modal inputs (but they're not in our history, yet)

      // throw if the message sequence is not okay
      const payload = anthropicMessagesPayloadOrThrow(model, history, false);
      const response = await anthropicPOST<AnthropicWire_API_Message_Create.Response, AnthropicWire_API_Message_Create.Request>(access, payload, '/v1/messages');
      const completion = AnthropicWire_API_Message_Create.Response_schema.parse(response);

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
