import * as z from 'zod/v4';

import { DModelInterfaceV1, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import { serverCapitalizeFirstLetter } from '~/server/wire';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { fromManualMapping, ManualMappings } from './models.data';


export function chutesAIHeuristic(hostname: string) {
  return hostname.includes('.chutes.ai');
}


const _wireChutesAIListOutputSchema = z.array(z.object({

  id: z.string(),
  object: z.literal('model'),
  created: z.number(),
  owned_by: z.string().optional().nullable(),
  root: z.string().optional().nullable(),

  // ChutesAI specific field for context length
  max_model_len: z.number().optional().nullable(),

  // Optional fields that may be present
  parent: z.string().nullable().optional(),
  // permission: z.array(z.object({
  //   id: z.string(),
  //   object: z.literal('model_permission'),
  //   created: z.number(),
  //   allow_create_engine: z.boolean(),
  //   allow_sampling: z.boolean(),
  //   allow_logprobs: z.boolean(),
  //   allow_search_indices: z.boolean(),
  //   allow_view: z.boolean(),
  //   allow_fine_tuning: z.boolean(),
  //   organization: z.string(),
  //   group: z.string().nullable(),
  //   is_blocking: z.boolean(),
  // })).optional(),
}));

const _chutesKnownModels: ManualMappings = [
  // NOTE: we don't need manual patching as we have enough info for now
] as const;

const _chutesDenyListContains: string[] = [
  // nothing to deny for now
] as const;


function _prettyModelId(id: string): string {
  // example: "chutesai/Llama-4-Scout-17B-16E-Instruct" => "ChutesAI · Llama 4 Scout 17B 16E Instruct"
  // example: "deepseek-ai/DeepSeek-R1" => "Deepseek AI · DeepSeek R1"
  // example: "unsloth/Llama-3.2-1B-Instruct" => "Unsloth · Llama 3.2 1B Instruct"

  return id
    .replaceAll(/[_-]/g, ' ') // replace underscores or dashes with spaces
    .replace('/', ' · ') // turn the first "/" into " · "
    .split(' ')
    .map(piece => {
      // Handle special cases like version numbers
      if (piece.match(/^\d+(\.\d+)*$/)) return piece; // keep version numbers as-is
      if (piece.toLowerCase() === 'ai') return 'AI';
      if (piece.toLowerCase() === 'v1' || piece.toLowerCase() === 'v2' || piece.toLowerCase() === 'v3') return piece.toUpperCase();
      return serverCapitalizeFirstLetter(piece);
    })
    .join(' ')
    .replace('Deepseek AI · DeepSeek', 'Deepseek AI · ') // special case for Deepseek
    .trim();
}


export function chutesAIModelsToModelDescriptions(wireModels: unknown): ModelDescriptionSchema[] {
  return _wireChutesAIListOutputSchema.parse(wireModels)

    .filter((model) => {
      return !_chutesDenyListContains.some(contains => model.id.includes(contains));
    })

    .map((model): ModelDescriptionSchema => {

      // heuristics
      const label = _prettyModelId(model.id);
      const description = model.owned_by ? `${serverCapitalizeFirstLetter(model.owned_by)} model via ChutesAI.` : 'Model via ChutesAI.';

      // Use max_model_len if available, otherwise fallback to 8192
      const contextWindow = model.max_model_len || 8192;

      const interfaces: DModelInterfaceV1[] = [
        LLM_IF_OAI_Chat, // Assume all are chat models
        LLM_IF_OAI_Vision, // Assume we can send them
        LLM_IF_OAI_Fn, // Most models support function calling
      ];

      // Check for vision capabilities based on model name patterns
      // if (model.id.toLowerCase().includes('vision') || model.id.toLowerCase().includes('vl')) {
      //   interfaces.push(LLM_IF_OAI_Vision);
      // }

      // Most modern models support function calling
      // interfaces.push(LLM_IF_OAI_Fn);

      return fromManualMapping(_chutesKnownModels, model.id, model.created, undefined, {
        idPrefix: model.id,
        label,
        description,
        contextWindow,
        interfaces,
        hidden: false,
      });
    })

    .sort((a: ModelDescriptionSchema, b: ModelDescriptionSchema): number => {
      // Sort by creation date (newer first), then by id
      if (a.created !== b.created)
        return (b.created || 0) - (a.created || 0);
      return a.id.localeCompare(b.id);
    });
}
