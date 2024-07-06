import { z } from 'zod';
import { TRPCError } from '@trpc/server';

import { createTRPCRouter, publicProcedure } from '~/server/api/trpc.server';
import { env } from '~/server/env.mjs';
import { fetchJsonOrTRPCError, fetchTextOrTRPCError } from '~/server/api/trpc.router.fetchers';

import { LLM_IF_OAI_Chat } from '../../store-llms';

import { capitalizeFirstLetter } from '~/common/util/textUtils';
import { fixupHost } from '~/common/util/urlUtils';

import { OpenAIHistorySchema, openAIHistorySchema, OpenAIModelSchema, openAIModelSchema } from '../openai/openai.router';
import { llmsChatGenerateOutputSchema, llmsGenerateContextSchema, llmsListModelsOutputSchema, ModelDescriptionSchema } from '../llm.server.types';

import { OLLAMA_BASE_MODELS, OLLAMA_PREV_UPDATE } from './ollama.models';
import { WireOllamaChatCompletionInput, wireOllamaChunkedOutputSchema, wireOllamaListModelsSchema, wireOllamaModelInfoSchema } from './ollama.wiretypes';


// Default hosts
const DEFAULT_OLLAMA_HOST = 'http://127.0.0.1:11434';
export const OLLAMA_PATH_CHAT = '/api/chat';
const OLLAMA_PATH_TAGS = '/api/tags';
const OLLAMA_PATH_SHOW = '/api/show';


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


export const ollamaChatCompletionPayload = (model: OpenAIModelSchema, history: OpenAIHistorySchema, jsonOutput: boolean, stream: boolean): WireOllamaChatCompletionInput => ({
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
});


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

async function ollamaGET<TOut extends object>(access: OllamaAccessSchema, apiPath: string /*, signal?: AbortSignal*/): Promise<TOut> {
  const { headers, url } = ollamaAccess(access, apiPath);
  return await fetchJsonOrTRPCError<TOut>(url, 'GET', headers, undefined, 'Ollama');
}

async function ollamaPOST<TOut extends object, TPostBody extends object>(access: OllamaAccessSchema, body: TPostBody, apiPath: string /*, signal?: AbortSignal*/): Promise<TOut> {
  const { headers, url } = ollamaAccess(access, apiPath);
  return await fetchJsonOrTRPCError<TOut, TPostBody>(url, 'POST', headers, body, 'Ollama');
}


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

const chatGenerateInputSchema = z.object({
  access: ollamaAccessSchema,
  model: openAIModelSchema,
  history: openAIHistorySchema,
  // functions: openAIFunctionsSchema.optional(),
  // forceFunctionName: z.string().optional(),
  context: llmsGenerateContextSchema.optional(),
});

const listPullableOutputSchema = z.object({
  pullable: z.array(z.object({
    id: z.string(),
    label: z.string(),
    tag: z.string(),
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
        pullable: Object.entries(OLLAMA_BASE_MODELS).map(([model_id, model]) => ({
          id: model_id,
          label: capitalizeFirstLetter(model_id),
          tag: 'latest',
          description: model.description,
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
      const pullRequest = await fetchTextOrTRPCError(url, 'POST', headers, { 'name': input.name }, 'Ollama::pull');

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
      const deleteOutput = await fetchTextOrTRPCError(url, 'DELETE', headers, { 'name': input.name }, 'Ollama::delete');
      if (deleteOutput?.length && deleteOutput !== 'null')
        throw new Error('Ollama delete issue: ' + deleteOutput);
    }),


  /* Ollama: List the Models available */
  listModels: publicProcedure
    .input(accessOnlySchema)
    .output(llmsListModelsOutputSchema)
    .query(async ({ input }) => {

      // get the models
      const wireModels = await ollamaGET(input.access, OLLAMA_PATH_TAGS);
      let models = wireOllamaListModelsSchema.parse(wireModels).models;

      // retrieve info for each of the models (/api/show, post call, in parallel)
      const detailedModels = await Promise.all(models.map(async model => {
        const wireModelInfo = await ollamaPOST(input.access, { 'name': model.name }, OLLAMA_PATH_SHOW);
        const modelInfo = wireOllamaModelInfoSchema.parse(wireModelInfo);
        return { ...model, ...modelInfo };
      }));

      return {
        models: detailedModels.map(model => {
          // the model name is in the format "name:tag" (default tag = 'latest')
          const [modelName, modelTag] = model.name.split(':');

          // pretty label and description
          const label = capitalizeFirstLetter(modelName) + ((modelTag && modelTag !== 'latest') ? ` · ${modelTag}` : '');
          const description = OLLAMA_BASE_MODELS[modelName]?.description ?? 'Model unknown';

          /* Find the context window from the 'num_ctx' line in the parameters string, if present
           *  - https://github.com/enricoros/big-AGI/issues/309
           *  - Note: as of 2024-01-26 the num_ctx line is present in 50% of the models, and in most cases set to 4096
           *  - We are tracking the Upstream issue https://github.com/ollama/ollama/issues/1473 for better ways to do this in the future
           */
          let contextWindow = OLLAMA_BASE_MODELS[modelName]?.contextWindow || 8192;
          if (model.parameters) {
            // split the parameters into lines, and find one called "num_ctx ...spaces... number"
            const paramsNumCtx = model.parameters.split('\n').find(line => line.startsWith('num_ctx '));
            if (paramsNumCtx) {
              const numCtxValue: string = paramsNumCtx.split(/\s+/)[1];
              if (numCtxValue) {
                const numCtxNumber: number = parseInt(numCtxValue);
                if (!isNaN(numCtxNumber))
                  contextWindow = numCtxNumber;
              }
            }
          }

          // console.log('>>> ollama model', model.name, model.template, model.modelfile, '\n');

          return {
            id: model.name,
            label,
            created: Date.parse(model.modified_at) ?? undefined,
            updated: Date.parse(model.modified_at) ?? undefined,
            description: description, // description: (model.license ? `License: ${model.license}. Info: ` : '') + model.modelfile || 'Model unknown',
            contextWindow,
            interfaces: [LLM_IF_OAI_Chat],
          } satisfies ModelDescriptionSchema;
        }),
      };
    }),

  /* Ollama: Chat generation */
  chatGenerate: publicProcedure
    .input(chatGenerateInputSchema)
    .output(llmsChatGenerateOutputSchema)
    .mutation(async ({ input: { access, history, model } }) => {

      const wireGeneration = await ollamaPOST(access, ollamaChatCompletionPayload(model, history, access.ollamaJson, false), OLLAMA_PATH_CHAT);
      const generation = wireOllamaChunkedOutputSchema.parse(wireGeneration);

      if ('error' in generation)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Ollama chat-generation issue: ${generation.error}`,
        });

      if (!generation.message?.content)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Ollama chat-generation API issue: ${JSON.stringify(wireGeneration)}`,
        });

      return {
        role: 'assistant',
        content: generation.message.content,
        finish_reason: generation.done ? 'stop' : null,
      };
    }),

});
