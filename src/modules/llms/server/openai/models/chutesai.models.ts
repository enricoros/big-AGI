import * as z from 'zod/v4';

import { DModelInterfaceV1, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_PromptCaching, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import { serverCapitalizeFirstLetter } from '~/server/wire';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { fromManualMapping, ManualMappings } from '../../models.mappings';


export function chutesAIHeuristic(hostname: string) {
  return hostname.includes('.chutes.ai');
}


// [ChutesAI] Models List API schema - as observed at https://llm.chutes.ai/v1/models (2026-04-16)
// Only `id` is required; all other fields are optional so per-item safeParse tolerates partial payloads.
const _wireChutesAIModelItemSchema = z.object({

  id: z.string(), // only strictly required field
  object: z.string().nullish(),
  created: z.number().nullish(),
  owned_by: z.string().nullish(),
  root: z.string().nullish(),
  parent: z.string().nullish(),

  // ChutesAI specific fields
  max_model_len: z.number().nullish(),   // legacy - prefer context_length
  context_length: z.number().nullish(),  // current field name
  max_output_length: z.number().nullish(),
  quantization: z.string().nullish(),
  premium: z.boolean().nullish(),
  confidential_compute: z.boolean().nullish(),

  // modalities and capabilities
  input_modalities: z.array(z.string()).nullish(),   // ['text', 'image', 'video']
  output_modalities: z.array(z.string()).nullish(),  // ['text']
  supported_features: z.array(z.string()).nullish(), // ['json_mode', 'tools', 'structured_outputs', 'reasoning']

  // pricing: USD per million tokens (flat); legacy nested `price` is ignored
  pricing: z.object({
    prompt: z.number().nullish(),
    completion: z.number().nullish(),
    input_cache_read: z.number().nullish(),
  }).nullish(),
});

const _wireChutesAIListOutputSchema = z.object({
  object: z.string().nullish(),
  data: z.array(z.unknown()),
});

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

  // tolerant top-level unwrap: accept `{ data: [...] }`, a plain array, or anything at all (fall back to [])
  let rawItems: unknown[] = [];
  try {
    if (Array.isArray(wireModels)) {
      rawItems = wireModels;
    } else if (wireModels && typeof wireModels === 'object') {
      const { data } = _wireChutesAIListOutputSchema.parse(wireModels);
      rawItems = Array.isArray(data) ? data : [];
    }
  } catch (err) {
    console.warn('[DEV] chutesAIModelsToModelDescriptions: top-level unwrap failed, returning empty list', err);
    return [];
  }

  const descriptions: ModelDescriptionSchema[] = [];

  for (const rawItem of rawItems) {
    // per-item safeParse: one bad entry never crashes the rest
    const { data: model, error } = _wireChutesAIModelItemSchema.safeParse(rawItem);
    if (error || !model?.id) {
      if (error) console.warn('[DEV] chutesAI: skipping invalid model entry', z.prettifyError(error));
      continue;
    }

    // deny-list filter
    if (_chutesDenyListContains.some(contains => model.id.includes(contains)))
      continue;

    try {
      // label / description
      const label = _prettyModelId(model.id);
      const ownerStr = model.owned_by ? serverCapitalizeFirstLetter(model.owned_by) : '';
      const quantStr = model.quantization ? ` (${model.quantization})` : '';
      const description = `${ownerStr || 'Model'}${quantStr} via ChutesAI.`;

      // context window: prefer explicit `context_length`, fall back to legacy `max_model_len`, then 8K
      const contextWindow = model.context_length || model.max_model_len || 8192;
      const maxCompletionTokens = model.max_output_length || undefined;

      // interfaces: derive from actual fields rather than assume
      const inputMods = model.input_modalities || [];
      const features = model.supported_features || [];

      const interfaces: DModelInterfaceV1[] = [LLM_IF_OAI_Chat];
      if (inputMods.includes('image'))
        interfaces.push(LLM_IF_OAI_Vision);
      if (features.includes('tools'))
        interfaces.push(LLM_IF_OAI_Fn);
      if (features.includes('structured_outputs') || features.includes('structured_output') || features.includes('json_mode'))
        interfaces.push(LLM_IF_OAI_Json);
      if (features.includes('reasoning'))
        interfaces.push(LLM_IF_OAI_Reasoning);
      // pricing: USD per million tokens (already in the units we want).
      // Only emit chatPrice when BOTH prompt and completion are finite numbers - do not invent 'free' for unreported values.
      const promptP = model.pricing?.prompt;
      const completionP = model.pricing?.completion;
      const cacheReadP = model.pricing?.input_cache_read;
      const hasValidPricing = typeof promptP === 'number' && Number.isFinite(promptP) && typeof completionP === 'number' && Number.isFinite(completionP);
      const hasValidCacheRead = typeof cacheReadP === 'number' && Number.isFinite(cacheReadP);

      if (hasValidCacheRead)
        interfaces.push(LLM_IF_OAI_PromptCaching);

      const chatPrice: ModelDescriptionSchema['chatPrice'] | undefined = hasValidPricing
        ? {
          input: promptP,
          output: completionP,
          ...(hasValidCacheRead && {
            cache: {
              cType: 'oai-ac' as const,
              read: cacheReadP,
            },
          }),
        }
        : undefined;

      descriptions.push(fromManualMapping(_chutesKnownModels, model.id, model.created ?? undefined, undefined, {
        idPrefix: model.id,
        label,
        description,
        contextWindow,
        maxCompletionTokens,
        interfaces,
        chatPrice,
        hidden: false,
      }));
    } catch (err) {
      // defensive: never let a single model's processing crash the whole list
      console.warn('[DEV] chutesAI: skipping model due to mapping error', model.id, err);
    }
  }

  // Sort by creation date (newer first), then by id
  return descriptions.sort((a, b) => {
    if (a.created !== b.created)
      return (b.created || 0) - (a.created || 0);
    return a.id.localeCompare(b.id);
  });
}
