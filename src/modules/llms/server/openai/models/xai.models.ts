import { z } from 'zod';

import { fetchJsonOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';
import { fromManualMapping, ManualMappings } from './models.data';
import { openAIAccess, OpenAIAccessSchema } from '../openai.router';


// Known xAI Models - Manual Mappings
// List on: https://console.x.ai/team/_TEAM_ID_/models
const _knownXAIChatModels: ManualMappings = [
  {
    idPrefix: 'grok-beta',
    label: `Grok Beta`,
    description: 'xAI\'s flagship model with real-time knowledge from the X platform. Supports text generation with a 131K token context window.',
    contextWindow: 131072,  // 131,072 tokens as shown in the Context column
    maxCompletionTokens: 16384,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 5, output: 15 },
  },
];


//
export async function xaiModelDescriptions(access: OpenAIAccessSchema): Promise<ModelDescriptionSchema[]> {

  // List models
  const { headers, url } = openAIAccess(access, null, '/v1/language-models');
  const modelsResponse = await fetchJsonOrTRPCThrow({ url, headers, name: 'xAI' });

  const xaiModels = wireXAIModelsListSchema.parse(modelsResponse);

  return xaiModels.models.map(model => fromManualMapping(_knownXAIChatModels, model.id, model.created, undefined, {
    idPrefix: model.id,
    label: `${model.id} ${model.version || ''}`, // {{Created}}`,
    description: `xAI model ${model.id}`,
    contextWindow: 16384,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, ...(model.input_modalities?.includes('image') ? [LLM_IF_OAI_Vision] : [])],
    ...(model.prompt_text_token_price && model.completion_text_token_price && {
      chatPrice: {
        input: model.prompt_text_token_price / 10000, // FIXME: SCALE UNKNOWN for now
        output: model.completion_text_token_price / 10000,
      },
    }),
  }));
}

export function xaiModelSort(a: ModelDescriptionSchema, b: ModelDescriptionSchema): number {
  return b.label.localeCompare(a.label);
}


// not much for wiretypes, so we embed them locally
export const wireTogetherAIListOutputSchema = z.array(z.object({
  id: z.string(),
  object: z.literal('model'),
  created: z.number(),
}));

export const wireXAIModelSchema = z.object({
  id: z.string(),
  object: z.literal('model'),
  owned_by: z.literal('xai').or(z.string()),

  // timestamps
  created: z.number().optional(),
  updated: z.number().optional(),
  version: z.string().optional(),

  // modalities
  input_modalities: z.array(z.string()),    // relaxing it
  output_modalities: z.array(z.string()),   // relaxing it
  // input_modalities: z.array(z.enum(['text'])),
  // output_modalities: z.array(z.enum(['text'])),

  // pricing - FIXME: SCALE UNKNOWN for now
  prompt_text_token_price: z.number().optional(),
  prompt_image_token_price: z.number().optional(),
  completion_text_token_price: z.number().optional(),
});

export const wireXAIModelsListSchema = z.object({
  models: z.array(wireXAIModelSchema),
});