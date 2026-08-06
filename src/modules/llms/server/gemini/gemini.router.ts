import * as z from 'zod/v4';

import { createTRPCRouter, edgeProcedure } from '~/server/trpc/trpc.server';
import { fetchJsonOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import { ListModelsResponse_schema } from '../llm.server.types';
import { listModelsRunDispatch } from '../listModels.dispatch';

import { geminiAccess, geminiAccessSchema, GeminiAccessSchema } from './gemini.access';


// Mappers

async function geminiGET<TOut extends object>(access: GeminiAccessSchema, modelRefId: string | null, apiPath: string /*, signal?: AbortSignal*/, useV1Alpha: boolean): Promise<TOut> {
  const { headers, url } = geminiAccess(access, modelRefId, apiPath, useV1Alpha);
  return await fetchJsonOrTRPCThrow<TOut>({ url, headers, name: 'Gemini' });
}

async function geminiPOST<TOut extends object, TPostBody extends object>(access: GeminiAccessSchema, modelRefId: string | null, body: TPostBody, apiPath: string /*, signal?: AbortSignal*/, useV1Alpha: boolean): Promise<TOut> {
  const { headers, url } = geminiAccess(access, modelRefId, apiPath, useV1Alpha);
  return await fetchJsonOrTRPCThrow<TOut, TPostBody>({ url, method: 'POST', headers, body, name: 'Gemini' });
}


// Router Input/Output Schemas

const accessOnlySchema = z.object({
  access: geminiAccessSchema,
});


/**
 * See https://github.com/google/generative-ai-js/tree/main/packages/main/src for
 * the official Google implementation.
 */
export const llmGeminiRouter = createTRPCRouter({

  /* [Gemini] models.list = /v1beta/models */
  listModels: edgeProcedure
    .input(accessOnlySchema)
    .output(ListModelsResponse_schema)
    .query(async ({ input, signal }) => {

      const models = await listModelsRunDispatch(input.access, signal);

      return { models };
    }),

});
