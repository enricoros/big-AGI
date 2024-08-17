import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { env } from '~/server/env.mjs';

import packageJson from '../../../../../package.json';

import { createTRPCRouter, publicProcedure } from '~/server/api/trpc.server';
import { fetchJsonOrTRPCThrow } from '~/server/api/trpc.router.fetchers';

import { GeminiWire_API_Generate_Content, GeminiWire_API_Models_List, GeminiWire_Safety } from '~/modules/aix/server/dispatch/wiretypes/gemini.wiretypes';

import { fixupHost } from '~/common/util/urlUtils';

import { ListModelsResponse_schema, llmsChatGenerateOutputSchema, llmsGenerateContextSchema } from '../llm.server.types';
import { OpenAIHistorySchema, openAIHistorySchema, OpenAIModelSchema, openAIModelSchema } from '../openai/openai.router';
import { geminiFilterModels, geminiModelToModelDescription, geminiSortModels } from './gemini.models';


// Default hosts
const DEFAULT_GEMINI_HOST = 'https://generativelanguage.googleapis.com';


// Mappers

export function geminiAccess(access: GeminiAccessSchema, modelRefId: string | null, apiPath: string): { headers: HeadersInit, url: string } {

  const geminiKey = access.geminiKey || env.GEMINI_API_KEY || '';
  const geminiHost = fixupHost(DEFAULT_GEMINI_HOST, apiPath);

  // update model-dependent paths
  if (apiPath.includes('{model=models/*}')) {
    if (!modelRefId)
      throw new Error(`geminiAccess: modelRefId is required for ${apiPath}`);
    apiPath = apiPath.replace('{model=models/*}', modelRefId);
  }

  return {
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-client': `big-agi/${packageJson['version'] || '1.0.0'}`,
      'x-goog-api-key': geminiKey,
    },
    url: geminiHost + apiPath,
  };
}

type TRequest = GeminiWire_API_Generate_Content.Request;

/**
 * We specially encode the history to match the Gemini API requirements.
 * Gemini does not want 2 consecutive messages from the same role, so we alternate.
 *  - System messages = [User, Model'Ok']
 *  - User and Assistant messages are coalesced into a single message (e.g. [User, User, Assistant, Assistant, User] -> [User[2], Assistant[2], User[1]])
 */
export const geminiGenerateContentTextPayload = (model: OpenAIModelSchema, history: OpenAIHistorySchema, safety: GeminiWire_Safety.HarmBlockThreshold, n: number): TRequest => {

  // convert the history to a Gemini format
  const contents: TRequest['contents'] = [];
  for (const _historyElement of history) {

    const { role: msgRole, content: msgContent } = _historyElement;

    // System message - we treat it as per the example in https://ai.google.dev/tutorials/ai-studio_quickstart#chat_example
    // TODO: sypport the system instruction
    if (msgRole === 'system') {
      contents.push({ role: 'user', parts: [{ text: msgContent }] });
      contents.push({ role: 'model', parts: [{ text: 'Ok' }] });
      continue;
    }

    // User or Assistant message
    const nextRole: TRequest['contents'][number]['role'] = msgRole === 'assistant' ? 'model' : 'user';
    if (contents.length && contents[contents.length - 1].role === nextRole) {
      // coalesce with the previous message
      contents[contents.length - 1].parts.push({ text: msgContent });
    } else {
      // create a new message
      contents.push({ role: nextRole, parts: [{ text: msgContent }] });
    }
  }

  return {
    contents,
    generationConfig: {
      ...(n >= 2 && { candidateCount: n }),
      ...(model.maxTokens && { maxOutputTokens: model.maxTokens }),
      temperature: model.temperature,
    },
    safetySettings: safety !== 'HARM_BLOCK_THRESHOLD_UNSPECIFIED' ? [
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: safety },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: safety },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: safety },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: safety },
    ] : undefined,
  };
};


async function geminiGET<TOut extends object>(access: GeminiAccessSchema, modelRefId: string | null, apiPath: string /*, signal?: AbortSignal*/): Promise<TOut> {
  const { headers, url } = geminiAccess(access, modelRefId, apiPath);
  return await fetchJsonOrTRPCThrow<TOut>({ url, headers, name: 'Gemini' });
}

async function geminiPOST<TOut extends object, TPostBody extends object>(access: GeminiAccessSchema, modelRefId: string | null, body: TPostBody, apiPath: string /*, signal?: AbortSignal*/): Promise<TOut> {
  const { headers, url } = geminiAccess(access, modelRefId, apiPath);
  return await fetchJsonOrTRPCThrow<TOut, TPostBody>({ url, method: 'POST', headers, body, name: 'Gemini' });
}


// Input/Output Schemas

export const geminiAccessSchema = z.object({
  dialect: z.enum(['gemini']),
  geminiKey: z.string(),
  minSafetyLevel: GeminiWire_Safety.HarmBlockThreshold_enum,
});
export type GeminiAccessSchema = z.infer<typeof geminiAccessSchema>;


const accessOnlySchema = z.object({
  access: geminiAccessSchema,
});

const chatGenerateInputSchema = z.object({
  access: geminiAccessSchema,
  model: openAIModelSchema,
  history: openAIHistorySchema,
  // functions: openAIFunctionsSchema.optional(),
  // forceFunctionName: z.string().optional(),
  context: llmsGenerateContextSchema.optional(),
});


/**
 * See https://github.com/google/generative-ai-js/tree/main/packages/main/src for
 * the official Google implementation.
 */
export const llmGeminiRouter = createTRPCRouter({

  /* [Gemini] models.list = /v1beta/models */
  listModels: publicProcedure
    .input(accessOnlySchema)
    .output(ListModelsResponse_schema)
    .query(async ({ input }) => {

      // get the models
      const wireModels = await geminiGET(input.access, null, GeminiWire_API_Models_List.getPath);
      const detailedModels = GeminiWire_API_Models_List.Response_schema.parse(wireModels).models;

      // NOTE: no need to retrieve info for each of the models (e.g. /v1beta/model/gemini-pro).,
      //       as the List API already all the info on all the models

      // map to our output schema
      const models = detailedModels
        .filter(geminiFilterModels)
        .map(geminiModel => geminiModelToModelDescription(geminiModel))
        .sort(geminiSortModels);

      return {
        models: models,
      };
    }),


  /* [Gemini] models.generateContent = /v1/{model=models/*}:generateContent */
  chatGenerate: publicProcedure
    .input(chatGenerateInputSchema)
    .output(llmsChatGenerateOutputSchema)
    .mutation(async ({ input: { access, history, model } }) => {

      // generate the content
      const wireGeneration = await geminiPOST(access, model.id, geminiGenerateContentTextPayload(model, history, access.minSafetyLevel, 1), GeminiWire_API_Generate_Content.postPath);
      const generation = GeminiWire_API_Generate_Content.Response_schema.parse(wireGeneration);
      0;
      // only use the first result (and there should be only one)
      const singleCandidate = generation.candidates?.[0] ?? null;
      if (!singleCandidate || !singleCandidate.content?.parts.length)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Gemini chat-generation API issue: ${JSON.stringify(wireGeneration)}`,
        });

      if (!('text' in singleCandidate.content.parts[0]))
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Gemini non-text chat-generation API issue: ${JSON.stringify(wireGeneration)}`,
        });

      return {
        role: 'assistant',
        content: singleCandidate.content.parts[0].text || '',
        finish_reason: singleCandidate.finishReason === 'STOP' ? 'stop' : null,
      };
    }),

});
