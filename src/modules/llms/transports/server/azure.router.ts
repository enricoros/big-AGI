import { z } from 'zod';
import { TRPCError } from '@trpc/server';

import { createTRPCRouter, publicProcedure } from '~/modules/trpc/trpc.server';
import { fetchJsonOrTRPCError } from '~/modules/trpc/trpc.serverutils';

import { OpenAI } from './openai.wiretypes';
import { chatGenerateOutputSchema, historySchema, modelSchema, openAIChatCompletionPayload } from './openai.router';
import { listModelsOutputSchema, ModelDescriptionSchema } from './server.common';
import { openAIModelToModelDescription } from '../../openai/openai.data';


// input schemas

const azureAccessSchema = z.object({
  azureEndpoint: z.string().trim(),
  azureKey: z.string().trim(),
});

const azureChatGenerateSchema = z.object({ access: azureAccessSchema, model: modelSchema, history: historySchema });

const azureListModelsSchema = z.object({ access: azureAccessSchema });


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

  /* Azure: list models
   *
   * Some complexity arises here as the models are called 'deployments' within allocated Azure 'endpoints'.
   * We use an unofficial API to list the deployments, and map them to models descriptions.
   *
   * See: https://github.com/openai/openai-python/issues/447#issuecomment-1730976835 for our input on the issue.
   */
  listModels: publicProcedure
    .input(azureListModelsSchema)
    .output(listModelsOutputSchema)
    .query(async ({ input }) => {

      // fetch the Azure OpenAI 'deployments'
      const azureModels = await azureOpenaiGET(
        input.access.azureEndpoint, input.access.azureKey,
        `/openai/deployments?api-version=2023-03-15-preview`,
      );

      // parse and validate output, and take the GPT models only (e.g. no 'whisper')
      const wireModels = wireAzureListDeploymentsSchema.parse(azureModels).data;

      // map to ModelDescriptions
      const models: ModelDescriptionSchema[] = wireModels
        .filter(m => m.model.includes('gpt'))
        .map((model): ModelDescriptionSchema => {
          const { id, label, ...rest } = openAIModelToModelDescription(model.model, model.created_at, model.updated_at);
          return {
            id: model.id,
            label: `${model.id} (${label})`,
            ...rest,
          };
        });

      return { models };
    }),

  /* Azure: Chat generation */
  chatGenerate: publicProcedure
    .input(azureChatGenerateSchema)
    .output(chatGenerateOutputSchema)
    .mutation(async ({ input }) => {

      const { access, model, history } = input;

      // https://eoai1uc1.openai.azure.com/openai/deployments/my-gpt-35-turbo-1/chat/completions?api-version=2023-07-01-preview
      // https://eoai1uc1.openai.azure.com/openai/deployments?api-version=2023-03-15-preview

      const wireCompletions = await azureOpenAIPOST<OpenAI.Wire.ChatCompletion.Response, OpenAI.Wire.ChatCompletion.Request>(
        access.azureEndpoint, access.azureKey,
        openAIChatCompletionPayload(model, history, null, null, 1, false),
        //  '/v1/chat/completions',
        `/openai/deployments/${input.model.id}/chat/completions?api-version=2023-09-01-preview`,
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
        content: message.content || '',
        finish_reason: finish_reason as 'stop' | 'length',
      };
    }),

});


async function azureOpenaiGET<TOut>(endpoint: string, key: string, apiPath: string /*, signal?: AbortSignal*/): Promise<TOut> {
  const { headers, url } = azureOpenAIAccess(endpoint, key, apiPath);
  return await fetchJsonOrTRPCError<TOut>(url, 'GET', headers, undefined, 'Azure OpenAI');
}

async function azureOpenAIPOST<TOut, TPostBody>(endpoint: string, key: string, body: TPostBody, apiPath: string /*, signal?: AbortSignal*/): Promise<TOut> {
  const { headers, url } = azureOpenAIAccess(endpoint, key, apiPath);
  return await fetchJsonOrTRPCError<TOut, TPostBody>(url, 'POST', headers, body, 'Azure OpenAI');
}

function azureOpenAIAccess(endpoint: string, key: string, apiPath: string): { headers: HeadersInit, url: string } {
  // API endpoint
  let azureEndpoint = endpoint || process.env.AZURE_OPENAI_API_ENDPOINT || '';
  if (!azureEndpoint.startsWith('http'))
    azureEndpoint = `https://${azureEndpoint}`;
  if (azureEndpoint.endsWith('/') && apiPath.startsWith('/'))
    azureEndpoint = azureEndpoint.slice(0, -1);

  // API key
  const azureKey = key || process.env.AZURE_OPENAI_API_KEY || '';

  // warn if no key - only for default (non-overridden) hosts
  if (!azureKey || !azureEndpoint)
    throw new Error('Missing Azure API Key or Host. Add it on the UI (Models Setup) or server side (your deployment).');

  return {
    headers: {
      ...(azureKey && { 'api-key': azureKey }),
      'Content-Type': 'application/json',
    },
    url: azureEndpoint + apiPath,
  };
}