import { z } from 'zod';

import { createTRPCRouter, publicProcedure } from '~/modules/trpc/trpc.server';

import { OpenAI } from './openai.types';


// if (!process.env.OPENAI_API_KEY)
//   console.warn('OPENAI_API_KEY has not been provided in this deployment environment. Will need client-supplied keys, which is not recommended.');


const accessSchema = z.object({
  oaiKey: z.string().trim(),
  oaiOrg: z.string().trim(),
  oaiHost: z.string().trim(),
  heliKey: z.string().trim(),
});

const modelSchema = z.object({
  id: z.string(),
  temperature: z.number().min(0).max(1).optional(),
  maxTokens: z.number().min(1).max(100000).optional(),
});

const historySchema = z.array(z.object({
  role: z.enum(['assistant', 'system', 'user']),
  content: z.string(),
}));

export const chatGenerateSchema = z.object({ access: accessSchema, model: modelSchema, history: historySchema });
export type ChatGenerateSchema = z.infer<typeof chatGenerateSchema>;


export const openAIRouter = createTRPCRouter({

  /**
   * Chat-based message generation
   */
  chatGenerate: publicProcedure
    .input(chatGenerateSchema)
    .mutation(async ({ input }): Promise<OpenAI.API.Chat.Response> => {

      const { access, model, history } = input;
      const requestBody: OpenAI.Wire.Chat.CompletionRequest = openAICompletionRequest(model, history, false);
      let wireCompletions: OpenAI.Wire.Chat.CompletionResponse;

      try {
        wireCompletions = await openaiPOST<OpenAI.Wire.Chat.CompletionRequest, OpenAI.Wire.Chat.CompletionResponse>(access, requestBody, '/v1/chat/completions');
      } catch (error: any) {
        // don't log 429 errors, they are expected
        if (!error || !(typeof error.startsWith === 'function') || !error.startsWith('Error: 429 · Too Many Requests'))
          console.error('api/openai/chat error:', error);
        throw error;
      }

      if (wireCompletions?.choices?.length !== 1)
        throw new Error(`Expected 1 choice, got ${wireCompletions?.choices?.length}`);

      const singleChoice = wireCompletions.choices[0];
      return {
        role: singleChoice.message.role,
        content: singleChoice.message.content,
        finish_reason: singleChoice.finish_reason,
      };
    }),

  /**
   * List the Models available
   */
  listModels: publicProcedure
    .input(accessSchema)
    .query(async ({ input }): Promise<OpenAI.Wire.Models.ModelDescription[]> => {

      let wireModels: OpenAI.Wire.Models.Response;
      wireModels = await openaiGET<OpenAI.Wire.Models.Response>(input, '/v1/models');

      // filter out the non-gpt models
      const llms = wireModels.data?.filter(model => model.id.includes('gpt')) ?? [];

      // sort by which model has the least number of '-' in the name, and then by id, decreasing
      llms.sort((a, b) => {
        // model that have '-0' in their name go at the end
        // if (a.id.includes('-0') && !b.id.includes('-0')) return 1;
        // if (!a.id.includes('-0') && b.id.includes('-0')) return -1;

        // sort by the first 5 chars of id, decreasing, then by the number of '-' in the name
        const aId = a.id.slice(0, 5);
        const bId = b.id.slice(0, 5);
        if (aId === bId) {
          const aCount = a.id.split('-').length;
          const bCount = b.id.split('-').length;
          if (aCount === bCount)
            return a.id.localeCompare(b.id);
          return aCount - bCount;
        }
        return bId.localeCompare(aId);
      });

      return llms;
    }),

});


type AccessSchema = z.infer<typeof accessSchema>;
type ModelSchema = z.infer<typeof modelSchema>;
type HistorySchema = z.infer<typeof historySchema>;

async function openaiGET<TOut>(access: AccessSchema, apiPath: string /*, signal?: AbortSignal*/): Promise<TOut> {
  const { headers, url } = openAIAccess(access, apiPath);
  const response = await fetch(url, { headers });
  return await response.json() as TOut;
}

async function openaiPOST<TBody, TOut>(access: AccessSchema, body: TBody, apiPath: string /*, signal?: AbortSignal*/): Promise<TOut> {
  const { headers, url } = openAIAccess(access, apiPath);
  const response = await fetch(url, { headers, method: 'POST', body: JSON.stringify(body) });
  return await response.json() as TOut;
}

export function openAIAccess(access: AccessSchema, apiPath: string): { headers: HeadersInit, url: string } {
  // API key
  const oaiKey = access.oaiKey || process.env.OPENAI_API_KEY || '';
  if (!oaiKey) throw new Error('Missing OpenAI API Key. Add it on the UI (Models Setup) or server side (your deployment).');

  // Organization ID
  const oaiOrg = access.oaiOrg || process.env.OPENAI_API_ORG_ID || '';

  // API host
  let oaiHost = access.oaiHost || process.env.OPENAI_API_HOST || 'https://api.openai.com';
  if (!oaiHost.startsWith('http'))
    oaiHost = `https://${oaiHost}`;
  if (oaiHost.endsWith('/') && apiPath.startsWith('/'))
    oaiHost = oaiHost.slice(0, -1);

  // Helicone key
  const heliKey = access.heliKey || process.env.HELICONE_API_KEY || '';

  return {
    headers: {
      Authorization: `Bearer ${oaiKey}`,
      'Content-Type': 'application/json',
      ...(oaiOrg && { 'OpenAI-Organization': oaiOrg }),
      ...(heliKey && { 'Helicone-Auth': `Bearer ${heliKey}` }),
    },
    url: oaiHost + apiPath,
  };
}

export function openAICompletionRequest(model: ModelSchema, history: HistorySchema, stream: boolean): OpenAI.Wire.Chat.CompletionRequest {
  return {
    model: model.id,
    messages: history,
    ...(model.temperature && { temperature: model.temperature }),
    ...(model.maxTokens && { max_tokens: model.maxTokens }),
    stream,
    n: 1,
  };
}