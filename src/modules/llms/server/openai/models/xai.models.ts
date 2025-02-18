import { z } from 'zod';

import { fetchJsonOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';
import { fromManualMapping, ManualMapping, ManualMappings } from './models.data';
import { openAIAccess, OpenAIAccessSchema } from '../openai.router';


// Known xAI Models - Manual Mappings
// List on: https://console.x.ai/team/_TEAM_ID_/models
const _knownXAIChatModels: ManualMappings = [

  // Grok 2
  {
    idPrefix: 'grok-2-vision-1212',
    label: `Grok 2 Vision (1212)`,
    description: 'xAI model grok-2-vision-1212 with image and text input capabilities. Supports text generation with a 32,768 token context window.',
    contextWindow: 32768,
    maxCompletionTokens: undefined,
    trainingDataCutoff: 'Jul 2024', // July 17, 2024
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision],
    chatPrice: { input: 2, output: 10 },
    // Fuzzy matched with "grok-2-2024-08-13" (1288) => wrong, but still we need a fallback
    benchmark: { cbaElo: 1288 },
  },
  {
    idPrefix: 'grok-2-1212',
    label: `Grok 2 (1212)`,
    description: 'xAI model grok-2-1212 with text input capabilities. Supports text generation with a 131,072 token context window.',
    contextWindow: 131072,
    maxCompletionTokens: undefined,
    trainingDataCutoff: 'Jul 2024', // July 17, 2024
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 2, output: 10 },
    // Fuzzy matched with "grok-2-2024-08-13" (1288) => wrong, but still we need a fallback
    benchmark: { cbaElo: 1288 },
  },

  // Grok Beta (all deprecated)
  {
    isLegacy: true,
    idPrefix: 'grok-vision-beta',
    label: `Grok Vision Beta`,
    description: 'xAI model grok-vision-beta with image and text input capabilities. Supports text generation with an 8,192 token context window.',
    contextWindow: 8192,
    maxCompletionTokens: undefined,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision],
    chatPrice: { input: 5, output: 15 },
    hidden: true,
  },
  {
    isLegacy: true,
    idPrefix: 'grok-beta',
    label: 'Grok Beta',
    description: 'xAI model grok-beta (deprecated) with text input capabilities. Supports text generation with a 131,072 token context window.',
    contextWindow: 131072,
    maxCompletionTokens: 16384,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 5, output: 15 },
    hidden: true,
  },
];


// xAI Model Descriptions
export async function xaiModelDescriptions(access: OpenAIAccessSchema): Promise<ModelDescriptionSchema[]> {

  // List models
  const { headers, url } = openAIAccess(access, null, '/v1/language-models');
  const modelsResponse = await fetchJsonOrTRPCThrow({ url, headers, name: 'xAI' });

  const xaiModels = wireXAIModelsListSchema.parse(modelsResponse);

  return xaiModels.models.reduce((acc, xm) => {

    // Fallback for unknown models
    const unknownModelFallback: ManualMapping = {
      idPrefix: xm.id,
      label: `${xm.id}${xm.version ? ' ' + xm.version : ''}`,
      description: `xAI model ${xm.id}`,
      contextWindow: 16384,
      interfaces: [
        LLM_IF_OAI_Chat,
        LLM_IF_OAI_Fn,
        ...(xm.input_modalities?.includes('image') ? [LLM_IF_OAI_Vision] : []),
      ],
      ...(xm.prompt_text_token_price != null && xm.completion_text_token_price != null && {
        chatPrice: {
          input: xm.prompt_text_token_price / 10000, // Scaling factor applied as per API data
          output: xm.completion_text_token_price / 10000,
        },
      }),
    };

    // xAI model description
    const modelDescription = fromManualMapping(_knownXAIChatModels, xm.id, xm.created, undefined, unknownModelFallback);
    acc.push(modelDescription);

    // NOTE: disabled, as this is not useful
    // if there are aliases, add them as 'symlinked' models
    // if (xm.aliases?.length) {
    //   xm.aliases.forEach((alias) => {
    //     const aliasedModel = fromManualMapping([{
    //       idPrefix: alias,
    //       label: alias,
    //       symLink: xm.id,
    //       description: `xAI model ${alias}`,
    //       contextWindow: 16384,
    //       interfaces: unknownModelFallback.interfaces,
    //     }], alias, xm.created, xm.updated, unknownModelFallback);
    //     acc.push(aliasedModel);
    //   });
    // }

    return acc;
  }, [] as ModelDescriptionSchema[]);
}

// manual sort order
const _xaiLabelStartsWithOrder = ['Grok 3', 'Grok 2', 'Grok'];

export function xaiModelSort(a: ModelDescriptionSchema, b: ModelDescriptionSchema): number {
  const aStartsWith = _xaiLabelStartsWithOrder.findIndex((prefix) => a.label.startsWith(prefix));
  const bStartsWith = _xaiLabelStartsWithOrder.findIndex((prefix) => b.label.startsWith(prefix));

  if (aStartsWith !== bStartsWith)
    return aStartsWith - bStartsWith;

  return b.label.localeCompare(a.label);
}


export const wireXAIModelSchema = z.object({
  id: z.string(),
  object: z.literal('model'),
  owned_by: z.literal('xai').or(z.string()),

  // timestamps
  created: z.number().optional(),
  updated: z.number().optional(),
  version: z.string().optional(),

  // modalities
  input_modalities: z.array(z.string()),    // 'text', 'image', etc.
  output_modalities: z.array(z.string()),   // 'text', 'image', etc.

  // pricing - FIXME: SCALE UNKNOWN for now
  prompt_text_token_price: z.number().optional(),
  prompt_image_token_price: z.number().optional(),
  completion_text_token_price: z.number().optional(),

  // Aliases for models
  aliases: z.array(z.string()).optional(),
});

export const wireXAIModelsListSchema = z.object({
  models: z.array(wireXAIModelSchema),
});