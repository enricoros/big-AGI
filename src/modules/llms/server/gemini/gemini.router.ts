import { z } from 'zod';
import { env } from '~/server/env';

import packageJson from '../../../../../package.json';

import { createTRPCRouter, publicProcedure } from '~/server/trpc/trpc.server';
import { fetchJsonOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import { GeminiWire_API_Models_List, GeminiWire_Safety } from '~/modules/aix/server/dispatch/wiretypes/gemini.wiretypes';

import { fixupHost } from '~/common/util/urlUtils';

import { ListModelsResponse_schema } from '../llm.server.types';
import { geminiDevCheckForParserMisses_DEV, geminiDevCheckForSuperfluousModels_DEV, geminiFilterModels, geminiModelsAddVariants, geminiModelToModelDescription, geminiSortModels } from './gemini.models';


// Default hosts
const DEFAULT_GEMINI_HOST = 'https://generativelanguage.googleapis.com';


// Mappers

export function geminiAccess(access: GeminiAccessSchema, modelRefId: string | null, apiPath: string, useV1Alpha: boolean): { headers: HeadersInit, url: string } {

  const geminiHost = fixupHost(access.geminiHost || DEFAULT_GEMINI_HOST, apiPath);
  let geminiKey = access.geminiKey || env.GEMINI_API_KEY || '';

  // multi-key with random selection - https://github.com/enricoros/big-AGI/issues/653
  if (geminiKey.includes(',')) {
    const multiKeys = geminiKey
      .split(',')
      .map(key => key.trim())
      .filter(Boolean);
    geminiKey = multiKeys[Math.floor(Math.random() * multiKeys.length)];
  }

  // update model-dependent paths
  if (apiPath.includes('{model=models/*}')) {
    if (!modelRefId)
      throw new Error(`geminiAccess: modelRefId is required for ${apiPath}`);
    apiPath = apiPath.replace('{model=models/*}', modelRefId);
  }

  // [Gemini, 2025-01-23] CoT support - requires `v1alpha` Gemini API
  if (useV1Alpha)
    apiPath = apiPath.replaceAll('v1beta', 'v1alpha');

  return {
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-client': `big-agi/${packageJson['version'] || '1.0.0'}`,
      'x-goog-api-key': geminiKey,
    },
    url: geminiHost + apiPath,
  };
}


async function geminiGET<TOut extends object>(access: GeminiAccessSchema, modelRefId: string | null, apiPath: string /*, signal?: AbortSignal*/, useV1Alpha: boolean): Promise<TOut> {
  const { headers, url } = geminiAccess(access, modelRefId, apiPath, useV1Alpha);
  return await fetchJsonOrTRPCThrow<TOut>({ url, headers, name: 'Gemini' });
}

async function geminiPOST<TOut extends object, TPostBody extends object>(access: GeminiAccessSchema, modelRefId: string | null, body: TPostBody, apiPath: string /*, signal?: AbortSignal*/, useV1Alpha: boolean): Promise<TOut> {
  const { headers, url } = geminiAccess(access, modelRefId, apiPath, useV1Alpha);
  return await fetchJsonOrTRPCThrow<TOut, TPostBody>({ url, method: 'POST', headers, body, name: 'Gemini' });
}


// Input/Output Schemas

export const geminiAccessSchema = z.object({
  dialect: z.enum(['gemini']),
  geminiKey: z.string(),
  geminiHost: z.string(),
  minSafetyLevel: GeminiWire_Safety.HarmBlockThreshold_enum,
});
export type GeminiAccessSchema = z.infer<typeof geminiAccessSchema>;


const accessOnlySchema = z.object({
  access: geminiAccessSchema,
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
      const wireModels = await geminiGET(input.access, null, GeminiWire_API_Models_List.getPath, false);
      const detailedModels = GeminiWire_API_Models_List.Response_schema.parse(wireModels).models;
      geminiDevCheckForParserMisses_DEV(wireModels, detailedModels);
      geminiDevCheckForSuperfluousModels_DEV(detailedModels.map(model => model.name));

      // NOTE: no need to retrieve info for each of the models (e.g. /v1beta/model/gemini-pro).,
      //       as the List API already all the info on all the models

      // first filter from the original list
      const filteredModels = detailedModels.filter(geminiFilterModels);

      // map to our output schema
      const models = filteredModels
        .map(geminiModelToModelDescription)
        .filter(model => !!model)
        .sort(geminiSortModels);

      return {
        models: geminiModelsAddVariants(models),
      };
    }),

  /**
   * [Gemini] models.generateContent / models.streamGenerateContent
   */
  generateContent: publicProcedure
    .input(z.object({
      access: geminiAccessSchema,
      modelRefId: z.string(), // e.g., 'models/gemini-1.5-flash-latest'
      requestBody: z.object({ // Based on Gemini REST API for generateContent
        contents: z.array(z.object({ // User and model messages
          role: z.enum(['user', 'model']).optional(), // 'model' for assistant
          parts: z.array(z.object({
            text: z.string().optional(),
            inline_data: z.object({ // For images
              mime_type: z.string(), // e.g., 'image/png'
              data: z.string(), // base64 encoded image
            }).optional(),
          })),
        })),
        generationConfig: z.object({
          temperature: z.number().optional(),
          topP: z.number().optional(),
          topK: z.number().optional(),
          maxOutputTokens: z.number().optional(),
          candidateCount: z.number().optional(), // Not for streaming
          stopSequences: z.array(z.string()).optional(),
        }).optional(),
        safetySettings: z.array(z.object({ // Optional safety settings
          category: GeminiWire_Safety.HarmCategory_enum,
          threshold: GeminiWire_Safety.HarmBlockThreshold_enum,
        })).optional(),
        // tools: ... further development for tool use
      }),
      stream: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { access, modelRefId, requestBody, stream } = input;
      const apiPath = stream ? `/v1beta/${modelRefId}:streamGenerateContent?alt=sse` : `/v1beta/${modelRefId}:generateContent`;

      // Use the geminiPOST helper, which should handle JSON stringification and response parsing.
      // For streaming, the response is not JSON but a stream of Server-Sent Events.
      // The fetchJsonOrTRPCThrow helper used by geminiPOST might need adjustment for SSE.
      // For now, let's assume geminiPOST can handle it or we'll adjust.
      // If geminiPOST is strictly for JSON, we'll need a new helper for SSE.

      // NOTE: The existing `geminiPOST` and `fetchJsonOrTRPCThrow` are designed for JSON request/response.
      // Streaming with SSE needs a different handling for the response.
      // I will proceed by constructing the fetch call directly here for the streaming case.

      const { headers, url } = geminiAccess(access, null, apiPath, false); // modelRefId is already in apiPath

      if (stream) {
        const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(requestBody) });
        if (!response.ok) {
          const errorBody = await response.text();
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Gemini API request failed: ${response.status} ${response.statusText} - ${errorBody}`,
          });
        }
        if (!response.body) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'No response body from Gemini stream.' });
        }
        return response.body; // Return ReadableStream directly
      } else {
        // Non-streaming: use the existing helper if it fits, or direct fetch
        const responseData = await geminiPOST<object, typeof requestBody>(access, null, requestBody, apiPath, false);
        return responseData; // This will be a JSON object
      }
    }),
});
