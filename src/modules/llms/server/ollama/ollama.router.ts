import * as z from 'zod/v4';
import { TRPCError } from '@trpc/server';

import { createTRPCRouter, publicProcedure } from '~/server/trpc/trpc.server';
import { env } from '~/server/env';
import { fetchTextOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';
import { serverCapitalizeFirstLetter } from '~/server/wire';

import { ListModelsResponse_schema } from '../llm.server.types';
import { fixupHost } from '../openai/openai.router';
import { listModelsRunDispatch } from '../listModels.dispatch';

import { OLLAMA_BASE_MODELS, OLLAMA_PREV_UPDATE } from './ollama.models';


// configuration
const DEFAULT_OLLAMA_HOST = 'http://127.0.0.1:11434';


// Mappers

export function ollamaAccess(access: OllamaAccessSchema, apiPath: string): { headers: HeadersInit, url: string } {

  const ollamaHost = fixupHost(access.ollamaHost || env.OLLAMA_API_HOST || DEFAULT_OLLAMA_HOST, apiPath);

  return {
    headers: {
      'Content-Type': 'application/json',
    },
    url: ollamaHost + apiPath,
  };

}


/*export const ollamaChatCompletionPayload = (model: OpenAIModelSchema, history: OpenAIHistorySchema, jsonOutput: boolean, stream: boolean): WireOllamaChatCompletionInput => ({
  model: model.id,
  messages: history,
  options: {
    ...(model.temperature !== undefined && { temperature: model.temperature }),
  },
  ...(jsonOutput && { format: 'json' }),
  // n: ...
  // functions: ...
  // function_call: ...
  stream,
});*/


/* Unused: switched to the Chat endpoint (above). The implementation is left here for reference.
https://github.com/jmorganca/ollama/blob/main/docs/api.md#generate-a-completion
export function ollamaCompletionPayload(model: OpenAIModelSchema, history: OpenAIHistorySchema, stream: boolean) {

  // if the first message is the system prompt, extract it
  let systemPrompt: string | undefined = undefined;
  if (history.length && history[0].role === 'system') {
    const [firstMessage, ...rest] = history;
    systemPrompt = firstMessage.content;
    history = rest;
  }

  // encode the prompt for ollama, assuming the same template for everyone for now
  const prompt = history.map(({ role, content }) => {
    return role === 'assistant' ? `\n\nAssistant: ${content}` : `\n\nHuman: ${content}`;
  }).join('') + '\n\nAssistant:\n';

  // const prompt = history.map(({ role, content }) => {
  //   return role === 'assistant' ? `### Response:\n${content}\n\n` : `### User:\n${content}\n\n`;
  // }).join('') + '### Response:\n';

  return {
    model: model.id,
    prompt,
    options: {
      ...(model.temperature !== undefined && { temperature: model.temperature }),
    },
    ...(systemPrompt && { system: systemPrompt }),
    stream,
  };
}*/

// async function ollamaGET<TOut extends object>(access: OllamaAccessSchema, apiPath: string /*, signal?: AbortSignal*/): Promise<TOut> {
//   const { headers, url } = ollamaAccess(access, apiPath);
//   return await fetchJsonOrTRPCThrow<TOut>({ url, headers, name: 'Ollama' });
// }

// async function ollamaPOST<TOut extends object, TPostBody extends object>(access: OllamaAccessSchema, body: TPostBody, apiPath: string /*, signal?: AbortSignal*/): Promise<TOut> {
//   const { headers, url } = ollamaAccess(access, apiPath);
//   return await fetchJsonOrTRPCThrow<TOut, TPostBody>({ url, method: 'POST', headers, body, name: 'Ollama' });
// }


// Input/Output Schemas

export const ollamaAccessSchema = z.object({
  dialect: z.enum(['ollama']),
  ollamaHost: z.string().trim(),
  ollamaJson: z.boolean(),
});
export type OllamaAccessSchema = z.infer<typeof ollamaAccessSchema>;

const accessOnlySchema = z.object({
  access: ollamaAccessSchema,
});

const adminPullModelSchema = z.object({
  access: ollamaAccessSchema,
  name: z.string(),
});

// this may not be needed
const listPullableOutputSchema = z.object({
  pullableModels: z.array(z.object({
    id: z.string(),
    label: z.string(),
    tag: z.string(),
    tags: z.array(z.string()),
    description: z.string(),
    pulls: z.number(),
    isNew: z.boolean(),
  })),
});


export const llmOllamaRouter = createTRPCRouter({

  /* Ollama: models that can be pulled */
  adminListPullable: publicProcedure
    .input(accessOnlySchema)
    .output(listPullableOutputSchema)
    .query(async ({}) => {
      return {
        pullableModels: Object.entries(OLLAMA_BASE_MODELS).map(([model_id, model]) => ({
          id: model_id,
          label: serverCapitalizeFirstLetter(model_id),
          tag: 'latest',
          tags: model.tags?.length ? model.tags : [],
          description: '', // model.description, // REMOVED description - bloated and not used by nobody
          pulls: model.pulls,
          isNew: !!model.added && model.added > OLLAMA_PREV_UPDATE,
        })),
      };
    }),

  /* Ollama: pull a model */
  adminPull: publicProcedure
    .input(adminPullModelSchema)
    .mutation(async ({ input }) => {

      // fetch as a large text buffer, made of JSONs separated by newlines
      const { headers, url } = ollamaAccess(input.access, '/api/pull');
      const pullRequest = await fetchTextOrTRPCThrow({ url, method: 'POST', headers, body: { 'name': input.name }, name: 'Ollama::pull' });

      // accumulate status and error messages
      let lastStatus: string = 'unknown';
      let lastError: string | undefined = undefined;
      for (let string of pullRequest.trim().split('\n')) {
        const message = JSON.parse(string);
        if (message.status)
          lastStatus = input.name + ': ' + message.status;
        if (message.error)
          lastError = message.error;
      }

      return { status: lastStatus, error: lastError };
    }),

  /* Ollama: delete a model */
  adminDelete: publicProcedure
    .input(adminPullModelSchema)
    .mutation(async ({ input }) => {
      const { headers, url } = ollamaAccess(input.access, '/api/delete');
      const deleteOutput = await fetchTextOrTRPCThrow({ url, method: 'DELETE', headers, body: { 'name': input.name }, name: 'Ollama::delete' });
      if (deleteOutput?.length && deleteOutput !== 'null')
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ollama delete issue: ' + deleteOutput });
    }),


  /* Ollama: List the Models available */
  listModels: publicProcedure
    .input(accessOnlySchema)
    .output(ListModelsResponse_schema)
    .query(async ({ input, signal }) => {

      const models = await listModelsRunDispatch(input.access, signal);

      return { models };
    }),

});
