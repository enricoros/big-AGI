import { z } from 'zod';
import { TRPCError } from '@trpc/server';

import packageJson from '../../../../../package.json';

import { createTRPCRouter, publicProcedure } from '~/server/api/trpc.server';
import { fetchJsonOrTRPCError } from '~/server/api/trpc.serverutils';

import { LLM_IF_OAI_Chat, LLM_IF_OAI_Vision } from '../../store-llms';
import { listModelsOutputSchema, ModelDescriptionSchema } from '../llm.server.types';

import { fixupHost, openAIChatGenerateOutputSchema, OpenAIHistorySchema, openAIHistorySchema, OpenAIModelSchema, openAIModelSchema } from '../openai/openai.router';

import { GeminiGenerateContentRequest, geminiGeneratedContentResponseSchema, geminiModelsGenerateContentPath, geminiModelsListOutputSchema, geminiModelsListPath } from './gemini.wiretypes';


// Default hosts
const DEFAULT_GEMINI_HOST = 'https://generativelanguage.googleapis.com';


// Mappers

export function geminiAccess(access: GeminiAccessSchema, modelRefId: string | null, apiPath: string): { headers: HeadersInit, url: string } {

  // handle paths that require a model name
  if (apiPath.includes('{model=models/*}')) {
    if (!modelRefId)
      throw new Error(`geminiAccess: modelRefId is required for ${apiPath}`);
    apiPath = apiPath.replace('{model=models/*}', modelRefId);
  }

  const geminiHost = fixupHost(DEFAULT_GEMINI_HOST, apiPath);

  return {
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-client': `big-agi/${packageJson['version'] || '1.0.0'}`,
      'x-goog-api-key': access.geminiKey,
    },
    url: geminiHost + apiPath,
  };
}

export const geminiGenerateContentPayload = (model: OpenAIModelSchema, history: OpenAIHistorySchema, n: number): GeminiGenerateContentRequest => {
  const contents: GeminiGenerateContentRequest['contents'] = [];
  history.forEach((message) => {
    // hack for now - the model seems to want prompts to alternate
    if (message.role === 'system') {
      contents.push({ role: 'user', parts: [{ text: message.content }] });
      contents.push({ role: 'model', parts: [{ text: 'Ok.' }] });
    } else
      contents.push({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] });
  });
  return {
    contents,
    generationConfig: {
      ...(n >= 2 && { candidateCount: n }),
      ...(model.maxTokens && { maxOutputTokens: model.maxTokens }),
      temperature: model.temperature,
    },
    // safetySettings: [
    //   { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    //   { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    //   { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    //   { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    // ],
  };
};


async function geminiGET<TOut extends object>(access: GeminiAccessSchema, modelRefId: string | null, apiPath: string /*, signal?: AbortSignal*/): Promise<TOut> {
  const { headers, url } = geminiAccess(access, modelRefId, apiPath);
  return await fetchJsonOrTRPCError<TOut>(url, 'GET', headers, undefined, 'Gemini');
}

async function geminiPOST<TOut extends object, TPostBody extends object>(access: GeminiAccessSchema, modelRefId: string | null, body: TPostBody, apiPath: string /*, signal?: AbortSignal*/): Promise<TOut> {
  const { headers, url } = geminiAccess(access, modelRefId, apiPath);
  return await fetchJsonOrTRPCError<TOut, TPostBody>(url, 'POST', headers, body, 'Gemini');
}


// Input/Output Schemas

export const geminiAccessSchema = z.object({
  dialect: z.enum(['gemini']),
  geminiKey: z.string(),
});
export type GeminiAccessSchema = z.infer<typeof geminiAccessSchema>;


const accessOnlySchema = z.object({
  access: geminiAccessSchema,
});

const chatGenerateInputSchema = z.object({
  access: geminiAccessSchema,
  model: openAIModelSchema, history: openAIHistorySchema,
  // functions: openAIFunctionsSchema.optional(), forceFunctionName: z.string().optional(),
});


export const llmGeminiRouter = createTRPCRouter({

  /* [Gemini] models.list = /v1beta/models */
  listModels: publicProcedure
    .input(accessOnlySchema)
    .output(listModelsOutputSchema)
    .query(async ({ input }) => {

      // get the models
      const wireModels = await geminiGET(input.access, null, geminiModelsListPath);
      const detailedModels = geminiModelsListOutputSchema.parse(wireModels).models;

      // NOTE: no need to retrieve info for each of the models (e.g. /v1beta/model/gemini-pro).,
      //       as the List API already all the info on all the models

      // map to our output schema
      return {
        models: detailedModels.map((geminiModel) => {
          const { description, displayName, inputTokenLimit, name, outputTokenLimit, supportedGenerationMethods } = geminiModel;

          const contextWindow = inputTokenLimit + outputTokenLimit;
          const hidden = !supportedGenerationMethods.includes('generateContent');

          const { version, topK, topP, temperature } = geminiModel;
          const descriptionLong = description + ` (Version: ${version}, Defaults: temperature=${temperature}, topP=${topP}, topK=${topK}, interfaces=[${supportedGenerationMethods.join(',')}])`;

          // const isGeminiPro = name.includes('gemini-pro');
          const isGeminiProVision = name.includes('gemini-pro-vision');

          const interfaces: ModelDescriptionSchema['interfaces'] = [];
          if (supportedGenerationMethods.includes('generateContent')) {
            interfaces.push(LLM_IF_OAI_Chat);
            if (isGeminiProVision)
              interfaces.push(LLM_IF_OAI_Vision);
          }

          return {
            id: name,
            label: displayName,
            // created: ...
            // updated: ...
            description: descriptionLong,
            contextWindow: contextWindow,
            maxCompletionTokens: outputTokenLimit,
            // pricing: isGeminiPro ? { needs per-character and per-image pricing } : undefined,
            // rateLimits: isGeminiPro ? { reqPerMinute: 60 } : undefined,
            interfaces: supportedGenerationMethods.includes('generateContent') ? [LLM_IF_OAI_Chat] : [],
            hidden,
          } satisfies ModelDescriptionSchema;
        }),
      };
    }),


  /* [Gemini] models.generateContent = /v1/{model=models/*}:generateContent */
  chatGenerate: publicProcedure
    .input(chatGenerateInputSchema)
    .output(openAIChatGenerateOutputSchema)
    .mutation(async ({ input: { access, history, model } }) => {

      // generate the content
      const wireGeneration = await geminiPOST(access, model.id, geminiGenerateContentPayload(model, history, 1), geminiModelsGenerateContentPath);
      const generation = geminiGeneratedContentResponseSchema.parse(wireGeneration);

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
