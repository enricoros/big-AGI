import * as z from 'zod/v4';
import { TRPCError } from '@trpc/server';

import { createTRPCRouter, edgeProcedure } from '~/server/trpc/trpc.server';
import { fetchTextOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';
import { serverCapitalizeFirstLetter } from '~/server/wire';

import { ListModelsResponse_schema } from '../llm.server.types';
import { listModelsRunDispatch } from '../listModels.dispatch';

import { OLLAMA_BASE_MODELS, OLLAMA_PREV_UPDATE } from './ollama.models';
import { ollamaAccess, ollamaAccessSchema } from './ollama.access';


// async function ollamaGET<TOut extends object>(access: OllamaAccessSchema, apiPath: string /*, signal?: AbortSignal*/): Promise<TOut> {
//   const { headers, url } = ollamaAccess(access, apiPath);
//   return await fetchJsonOrTRPCThrow<TOut>({ url, headers, name: 'Ollama' });
// }

// async function ollamaPOST<TOut extends object, TPostBody extends object>(access: OllamaAccessSchema, body: TPostBody, apiPath: string /*, signal?: AbortSignal*/): Promise<TOut> {
//   const { headers, url } = ollamaAccess(access, apiPath);
//   return await fetchJsonOrTRPCThrow<TOut, TPostBody>({ url, method: 'POST', headers, body, name: 'Ollama' });
// }


// Router Input/Output Schemas

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

  /* Ollama: List the Models available */
  listModels: edgeProcedure
    .input(accessOnlySchema)
    .output(ListModelsResponse_schema)
    .query(async ({ ctx, input, signal }) => {

      const models = await listModelsRunDispatch(input.access, signal);

      return { models };
    }),


  /* Ollama: models that can be pulled */
  adminListPullable: edgeProcedure
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
  adminPull: edgeProcedure
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
  adminDelete: edgeProcedure
    .input(adminPullModelSchema)
    .mutation(async ({ input }) => {
      const { headers, url } = ollamaAccess(input.access, '/api/delete');
      const deleteOutput = await fetchTextOrTRPCThrow({ url, method: 'DELETE', headers, body: { 'name': input.name }, name: 'Ollama::delete' });
      if (deleteOutput?.length && deleteOutput !== 'null')
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ollama delete issue: ' + deleteOutput });
    }),

});
