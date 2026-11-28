import type { ModelDescriptionSchema } from '../../llm.server.types';

import { openRouterDescriptionToOpenAIDialect } from './nousresearch.models';
import { openRouterModelFamilySortFn, openRouterModelToModelDescription } from './openrouter.models';


// [LLMTR, 2026-11-16] OpenAI-compatible gateway at https://llmtr.com/v1. Its /v1/models uses OpenRouter's wire
// schema (USD per token pricing, architecture, top_provider, supported_parameters) and lists models hosted in
// Turkey ('llmtr/...') next to models routed to their upstream vendors. Corrections before the OpenRouter mapper:
// - keep rows whose supported_operations include CHAT_COMPLETIONS: the listing also carries Responses-only,
//   image, video, embedding and speech rows, and the 'openai' dialect sends chat completions
// - architecture.tokenizer is null on every row, and the OpenRouter schema requires a string: normalized, or
//   the parser would drop every model
// Requests go out on the 'openai' dialect, so OpenRouter-only parameterSpecs are stripped as for Nous.


export function llmtrHeuristic(hostname: string): boolean {
  return hostname.includes('llmtr.com');
}


function _llmtrIsChatModel(wireModel: any): boolean {
  const operations = wireModel?.supported_operations;
  if (Array.isArray(operations) && operations.length)
    return operations.includes('CHAT_COMPLETIONS');
  const outputs = wireModel?.architecture?.output_modalities;
  return !Array.isArray(outputs) || !outputs.length || outputs.includes('text');
}

function _llmtrNormalizeWireModel(wireModel: any): any {
  return {
    ...wireModel,
    architecture: {
      ...wireModel?.architecture,
      tokenizer: wireModel?.architecture?.tokenizer ?? 'Other',
    },
  };
}

export function llmtrModelsToModelDescriptions(wireModels: unknown): ModelDescriptionSchema[] {
  const wireList = (wireModels as any)?.data;
  if (!Array.isArray(wireList)) return [];
  return wireList
    .filter(_llmtrIsChatModel)
    .map(_llmtrNormalizeWireModel)
    .sort(openRouterModelFamilySortFn)
    .map(openRouterModelToModelDescription)
    .filter((desc): desc is ModelDescriptionSchema => !!desc)
    .map(openRouterDescriptionToOpenAIDialect);
}
