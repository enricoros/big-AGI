import * as z from 'zod/v4';
import { TRPCError } from '@trpc/server';

import { createTRPCRouter, edgeProcedure } from '~/server/trpc/trpc.server';
import { env } from '~/server/env.server';
import { fetchTextOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';
import { serverCapitalizeFirstLetter } from '~/server/wire';

import { llmsHostTargetsServer } from '../../shared/llm.isomorphic';
import { ListModelsResponse_schema } from '../llm.server.types';
import { listModelsRunDispatch } from '../listModels.dispatch';

import { OLLAMA_BASE_MODELS, OLLAMA_PREV_UPDATE } from './ollama.models';
import { DEFAULT_OLLAMA_HOST, ollamaAccess, ollamaAccessSchema, type OllamaAccessSchema } from './ollama.access';


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
  // [namespace/]model[:tag] - no registry-qualified names
  name: z.string().max(200).regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*(\/[a-zA-Z0-9][a-zA-Z0-9._-]*)?(:[a-zA-Z0-9][a-zA-Z0-9._-]*)?$/, 'Invalid Ollama model name'),
});

function ollamaAdminAccessOrThrow(access: OllamaAccessSchema, apiPath: string) {
  if (env.OLLAMA_ADMIN_ENABLED !== 'true' && llmsHostTargetsServer(access.ollamaHost, env.OLLAMA_API_HOST, DEFAULT_OLLAMA_HOST))
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Ollama admin operations on the server-side Ollama host are disabled. Set OLLAMA_ADMIN_ENABLED=true on the server to allow them.' });
  return ollamaAccess(access, apiPath);
}

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
    .query(async (/*{ ctx, input } unused */) => {
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
      const { headers, url } = ollamaAdminAccessOrThrow(input.access, '/api/pull');
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
      const { headers, url } = ollamaAdminAccessOrThrow(input.access, '/api/delete');
      const deleteOutput = await fetchTextOrTRPCThrow({ url, method: 'DELETE', headers, body: { 'name': input.name }, name: 'Ollama::delete' });
      if (deleteOutput?.length && deleteOutput !== 'null')
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ollama delete issue: ' + deleteOutput });
    }),

});
