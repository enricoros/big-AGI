import { z } from 'zod';

import { createTRPCRouter, publicProcedure } from '~/modules/trpc/trpc.server';
import { historySchema, modelSchema, openAIChatCompletionPayload } from '~/modules/llms/openai/openai.router';
import { OpenAI } from '~/modules/llms/openai/openai.types';
import { TRPCError } from '@trpc/server';
import { listModelsOutputSchema, LLM_IF_OAI_Chat, ModelDescriptionSchema } from '~/modules/llms/llm.router';
import { fetchJsonOrTRPCError } from '~/modules/trpc/trpc.serverutils';


// input schemas

const azureAccessSchema = z.object({
  azureKey: z.string().trim(),
  azureHost: z.string().trim(),
});

const chatGenerateSchema = z.object({ access: azureAccessSchema, model: modelSchema, history: historySchema });

const listModelsSchema = z.object({ access: azureAccessSchema });


// Output Schemas

const chatGenerateOutputSchema = z.object({
  role: z.enum(['assistant', 'system', 'user']),
  content: z.string(),
  finish_reason: z.union([z.enum(['stop', 'length']), z.null()]),
});


// Wire schemas

const wireAzureListDeploymentsSchema = z.object({
  data: z.array(z.object({
    // scale_settings: z.object({ scale_type: z.string() }),
    model: z.string(),
    owner: z.enum(['organization-owner']),
    id: z.string(),
    status: z.enum(['succeeded']),
    created_at: z.number(),
    updated_at: z.number(),
    object: z.literal('deployment'),
  })),
  object: z.literal('list'),
});


export const llmAzureRouter = createTRPCRouter({

  /* List the Azure models
   * Small complexity arises here as the models are called 'deployments' within allocated Azure 'endpoints'.
   * We use an unofficial API to list the deployments, and map them to models descriptions.
   */
  listModels: publicProcedure
    .input(listModelsSchema)
    .output(listModelsOutputSchema)
    .query(async ({ input }) => {

      // fetch the Azure OpenAI models
      // HACK: this method may stop working soon - see: https://github.com/openai/openai-python/issues/447#issuecomment-1730976835,
      const azureModels = await azureOpenaiGET(
        input.access.azureKey, input.access.azureHost,
        `/openai/deployments?api-version=2023-03-15-preview`,
      );

      // parse and validate output, and take the GPT models only (e.g. no 'whisper')
      const models = wireAzureListDeploymentsSchema.parse(azureModels).data;
      return {
        models: models.filter(m => m.model.includes('gpt')).map(azureModelToModelDescription),
      };
    }),


  /* Chat-based message generation */
  chatGenerate: publicProcedure
    .input(chatGenerateSchema)
    .output(chatGenerateOutputSchema)
    .mutation(async ({ input }) => {

      const { access, model, history } = input;

      const wireCompletions = await azureOpenAIPOST<OpenAI.Wire.ChatCompletion.Response, OpenAI.Wire.ChatCompletion.Request>(
        access.azureKey, access.azureHost,
        openAIChatCompletionPayload(model, history, null, null, 1, false),
        '/v1/chat/completions',
      );

      // expect a single output
      if (wireCompletions?.choices?.length !== 1)
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `[Azure OpenAI Issue] Expected 1 completion, got ${wireCompletions?.choices?.length}` });
      let { message, finish_reason } = wireCompletions.choices[0];

      // LocalAI hack/workaround, until https://github.com/go-skynet/LocalAI/issues/788 is fixed
      if (finish_reason === undefined)
        finish_reason = 'stop';

      // check for a function output
      // return parseChatGenerateOutput(message as OpenAI.Wire.ChatCompletion.ResponseMessage, finish_reason);
      return {
        role: 'assistant',
        content: 'TESTXXX',
        finish_reason: finish_reason as 'stop' | 'length',
      };
    }),

});


function azureModelToModelDescription(model: { id: string, model: string, created_at: number, updated_at: number }): ModelDescriptionSchema {
  const knownModel = knownAzureModels.find(m => m.id === model.model);
  return {
    id: model.id,
    label: knownModel?.label || model.id,
    created: model.created_at,
    updated: model.updated_at || model.created_at,
    description: knownModel?.description || 'Unknown model type, please let us know',
    contextWindow: knownModel?.contextWindow || 2048,
    interfaces: [LLM_IF_OAI_Chat],
    hidden: !knownModel,
  };
}

const knownAzureModels: Partial<ModelDescriptionSchema>[] = [
  {
    id: 'gpt-35-turbo',
    label: '3.5-Turbo',
    contextWindow: 4097,
    description: 'Fair speed and smarts',
  },
  {
    id: 'gpt-35-turbo-16k',
    label: '3.5-Turbo-16k',
    contextWindow: 16384,
    description: 'Fair speed and smarts, large context',
  },
  {
    id: 'gpt-4',
    label: 'GPT-4',
    contextWindow: 8192,
    description: 'Insightful, big thinker, slower, pricey',
  },
  {
    id: 'gpt-4-32k',
    label: 'GPT-4-32k',
    contextWindow: 32768,
    description: 'Largest context window for big problems',
  },
];


async function azureOpenaiGET<TOut>(key: string, endpoint: string, apiPath: string /*, signal?: AbortSignal*/): Promise<TOut> {
  const { headers, url } = azureOpenAIAccess(key, endpoint, apiPath);
  return await fetchJsonOrTRPCError<TOut>(url, 'GET', headers, undefined, 'Azure OpenAI');
}

async function azureOpenAIPOST<TOut, TPostBody>(key: string, endpoint: string, body: TPostBody, apiPath: string /*, signal?: AbortSignal*/): Promise<TOut> {
  const { headers, url } = azureOpenAIAccess(key, endpoint, apiPath);
  return await fetchJsonOrTRPCError<TOut, TPostBody>(url, 'POST', headers, body, 'Azure OpenAI');
}

function azureOpenAIAccess(key: string, endpoint: string, apiPath: string): { headers: HeadersInit, url: string } {
  // API key
  const azureKey = key || process.env.AZURE_OPENAI_API_KEY || '';

  // API endpoint
  let azureHost = endpoint || process.env.AZURE_OPENAI_API_ENDPOINT || '';
  if (!azureHost.startsWith('http'))
    azureHost = `https://${azureHost}`;
  if (azureHost.endsWith('/') && apiPath.startsWith('/'))
    azureHost = azureHost.slice(0, -1);

  // warn if no key - only for default (non-overridden) hosts
  if (!azureKey || !azureHost)
    throw new Error('Missing Azure API Key or Host. Add it on the UI (Models Setup) or server side (your deployment).');

  return {
    headers: {
      ...(azureKey && { 'api-key': azureKey }),
      'Content-Type': 'application/json',
    },
    url: azureHost + apiPath,
  };
}
