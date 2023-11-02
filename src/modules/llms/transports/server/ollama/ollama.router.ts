import { z } from 'zod';

import { createTRPCRouter, publicProcedure } from '~/server/api/trpc.server';
import { fetchJsonOrTRPCError, fetchTextOrTRPCError } from '~/server/api/trpc.serverutils';

import { LLM_IF_OAI_Chat } from '../../../store-llms';

import { capitalizeFirstLetter } from '~/common/util/textUtils';

import { fixupHost, openAIChatGenerateOutputSchema, openAIHistorySchema, openAIModelSchema } from '../openai/openai.router';
import { listModelsOutputSchema, ModelDescriptionSchema } from '../server.schemas';

import { wireOllamaGenerationSchema } from './ollama.wiretypes';


/**
 * This is here because the API does not provide a list of available upstream models, and does not provide
 * descriptions for the models.
 * (nor does it reliably provide context window sizes) - TODO: open a bug upstream
 *
 * from: https://ollama.ai/library?sort=popular
 */
const OLLAMA_BASE_MODELS: { [key: string]: string } = {
  'mistral': 'The Mistral 7B model released by Mistral AI',
  'llama2': 'The most popular model for general use.',
  'codellama': 'A large language model that can use text prompts to generate and discuss code.',
  'vicuna': 'General use chat model based on Llama and Llama 2 with 2K to 16K context sizes.',
  'llama2-uncensored': 'Uncensored Llama 2 model by George Sung and Jarrad Hope.',
  'orca-mini': 'A general-purpose model ranging from 3 billion parameters to 70 billion, suitable for entry-level hardware.',
  'wizard-vicuna-uncensored': 'Wizard Vicuna Uncensored is a 7B, 13B, and 30B parameter model based on Llama 2 uncensored by Eric Hartford.',
  'nous-hermes': 'General use models based on Llama and Llama 2 from Nous Research.',
  'phind-codellama': 'Code generation model based on CodeLlama.',
  'mistral-openorca': 'Mistral OpenOrca is a 7 billion parameter model, fine-tuned on top of the Mistral 7B model using the OpenOrca dataset.',
  'wizardcoder': 'Llama based code generation model focused on Python.',
  'wizard-math': 'Model focused on math and logic problems',
  'llama2-chinese': 'Llama 2 based model fine tuned to improve Chinese dialogue ability.',
  'stable-beluga': 'Llama 2 based model fine tuned on an Orca-style dataset. Originally called Free Willy.',
  'zephyr': 'Zephyr beta is a fine-tuned 7B version of mistral that was trained on on a mix of publicly available, synthetic datasets.',
  'codeup': 'Great code generation model based on Llama2.',
  'falcon': 'A large language model built by the Technology Innovation Institute (TII) for use in summarization, text generation, and chat bots.',
  'everythinglm': 'Uncensored Llama2 based model with 16k context size.',
  'wizardlm-uncensored': 'Uncensored version of Wizard LM model',
  'medllama2': 'Fine-tuned Llama 2 model to answer medical questions based on an open source medical dataset.',
  'wizard-vicuna': 'Wizard Vicuna is a 13B parameter model based on Llama 2 trained by MelodysDreamj.',
  'open-orca-platypus2': 'Merge of the Open Orca OpenChat model and the Garage-bAInd Platypus 2 model. Designed for chat and code generation.',
  'starcoder': 'StarCoder is a code generation model trained on 80+ programming languages.',
  'samantha-mistral': 'A companion assistant trained in philosophy, psychology, and personal relationships. Based on Mistral.',
  'openhermes2-mistral': 'OpenHermes 2 Mistral is a 7B model fine-tuned on Mistral with 900,000 entries of primarily GPT-4 generated data from open datasets.',
  'wizardlm': 'General use 70 billion parameter model based on Llama 2.',
  'sqlcoder': 'SQLCoder is a code completion model fined-tuned on StarCoder for SQL generation tasks',
  'dolphin2.2-mistral': 'An instruct-tuned model based on Mistral. Version 2.2 is fine-tuned for improved conversation and empathy.',
  'dolphin2.1-mistral': 'An instruct-tuned model based on Mistral and trained on a dataset filtered to remove alignment and bias.',
  'yarn-mistral': 'An extension of Mistral to support a context of up to 128k tokens.',
  'codebooga': 'A high-performing code instruct model created by merging two existing code models.',
  'openhermes2.5-mistral': 'OpenHermes 2.5 Mistral 7B is a Mistral 7B fine-tune, a continuation of OpenHermes 2 model, which trained on additional code datasets.',
  'mistrallite': 'MistralLite is a fine-tuned model based on Mistral with enhanced capabilities of processing long contexts.',
  'nexusraven': 'Nexus Raven is a 13B instruction tuned model for function calling tasks.',
  'yarn-llama2': 'An extension of Llama 2 that supports a context of up to 128k tokens.',
  'xwinlm': 'Conversational model based on Llama 2 that performs competitively on various benchmarks.',
};

// Input Schemas

export const ollamaAccessSchema = z.object({
  dialect: z.enum(['ollama']),
  ollamaHost: z.string().trim(),
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
  model: openAIModelSchema, history: openAIHistorySchema,
  // functions: openAIFunctionsSchema.optional(), forceFunctionName: z.string().optional(),
});


// Output Schemas

const listPullableOutputSchema = z.object({
  pullable: z.array(z.object({
    id: z.string(),
    label: z.string(),
    tag: z.string(),
    description: z.string(),
  })),
});


export const llmOllamaRouter = createTRPCRouter({

  /* Ollama: models that can be pulled */
  adminListPullable: publicProcedure
    .input(accessOnlySchema)
    .output(listPullableOutputSchema)
    .query(async ({}) => {
      return {
        pullable: Object.entries(OLLAMA_BASE_MODELS).map(([model, description]) => ({
          id: model,
          label: capitalizeFirstLetter(model),
          tag: 'latest',
          description,
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

  /* Ollama: List the Models available */
  listModels: publicProcedure
    .input(accessOnlySchema)
    .output(listModelsOutputSchema)
    .query(async ({ input }) => {

      // get the models
      const wireModels = await ollamaGET(input.access, '/api/tags');
      const wireOllamaListModelsSchema = z.object({
        models: z.array(z.object({
          name: z.string(),
          modified_at: z.string(),
          size: z.number(),
          digest: z.string(),
        })),
      });
      let models = wireOllamaListModelsSchema.parse(wireModels).models;

      // retrieve info for each of the models (/api/show, post call, in parallel)
      const detailedModels = await Promise.all(models.map(async model => {
        const wireModelInfo = await ollamaPOST(input.access, { 'name': model.name }, '/api/show');
        const wireOllamaModelInfoSchema = z.object({
          license: z.string().optional(),
          modelfile: z.string(),
          parameters: z.string(),
          template: z.string(),
        });
        const modelInfo = wireOllamaModelInfoSchema.parse(wireModelInfo);
        return { ...model, ...modelInfo };
      }));

      return {
        models: detailedModels.map(model => {
          // the model name is in the format "name:tag" (default tag = 'latest')
          const [modelName, modelTag] = model.name.split(':');

          // pretty label and description
          const label = capitalizeFirstLetter(modelName) + ((modelTag && modelTag !== 'latest') ? ` · ${modelTag}` : '');
          const description = OLLAMA_BASE_MODELS[modelName] ?? 'Model unknown';

          // console.log('>>> ollama model', model.name, model.template, model.modelfile, '\n');

          return {
            id: model.name,
            label,
            created: Date.parse(model.modified_at) ?? undefined,
            updated: Date.parse(model.modified_at) ?? undefined,
            description: description, // description: (model.license ? `License: ${model.license}. Info: ` : '') + model.modelfile || 'Model unknown',
            contextWindow: 4096, // FIXME: request this information upstream?
            interfaces: [LLM_IF_OAI_Chat],
          } satisfies ModelDescriptionSchema;
        }),
      };
    }),

  /* Ollama: Chat generation */
  chatGenerate: publicProcedure
    .input(chatGenerateInputSchema)
    .output(openAIChatGenerateOutputSchema)
    .mutation(async ({ input: { access, history, model } }) => {

      const wireGeneration = await ollamaPOST(access, ollamaChatCompletionPayload(model, history, false), '/api/generate');
      const generation = wireOllamaGenerationSchema.parse(wireGeneration);

      return {
        role: 'assistant',
        content: generation.response,
        finish_reason: generation.done ? 'stop' : null,
      };
    }),

});


type ModelSchema = z.infer<typeof openAIModelSchema>;
type HistorySchema = z.infer<typeof openAIHistorySchema>;

async function ollamaGET<TOut extends object>(access: OllamaAccessSchema, apiPath: string /*, signal?: AbortSignal*/): Promise<TOut> {
  const { headers, url } = ollamaAccess(access, apiPath);
  return await fetchJsonOrTRPCError<TOut>(url, 'GET', headers, undefined, 'Ollama');
}

async function ollamaPOST<TOut extends object, TPostBody extends object>(access: OllamaAccessSchema, body: TPostBody, apiPath: string /*, signal?: AbortSignal*/): Promise<TOut> {
  const { headers, url } = ollamaAccess(access, apiPath);
  return await fetchJsonOrTRPCError<TOut, TPostBody>(url, 'POST', headers, body, 'Ollama');
}


const DEFAULT_OLLAMA_HOST = 'http://127.0.0.1:11434';

export function ollamaAccess(access: OllamaAccessSchema, apiPath: string): { headers: HeadersInit, url: string } {

  const ollamaHost = fixupHost(access.ollamaHost || process.env.OLLAMA_API_HOST || DEFAULT_OLLAMA_HOST, apiPath);

  return {
    headers: {
      'Content-Type': 'application/json',
    },
    url: ollamaHost + apiPath,
  };

}

export function ollamaChatCompletionPayload(model: ModelSchema, history: HistorySchema, stream: boolean) {

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
      ...(model.temperature && { temperature: model.temperature }),
    },
    ...(systemPrompt && { system: systemPrompt }),
    stream,
  };
}
