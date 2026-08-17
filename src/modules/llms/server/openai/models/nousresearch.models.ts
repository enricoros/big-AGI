import { LLM_IF_ANT_PromptCaching, LLM_IF_OAI_PromptCaching, LLM_IF_OAI_Reasoning } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { openRouterModelFamilySortFn, openRouterModelToModelDescription } from './openrouter.models';


// [Nous Research, 2026-08-10] Nous Portal - subscription inference gateway at inference-api.nousresearch.com.
// Its /v1/models is OpenRouter's wire schema (most of the catalog is the OpenRouter catalog resold at a
// subscriber discount, response ids are OpenRouter 'gen-...'), plus Nous' own Hermes models and a set of
// models routed to partner backends. The Nous namespace is hermes-4-70b/405b only - the other open weights
// (Hermes 4 14B, Hermes 4.3 36B, NousCoder-14B, nomos-1) are not served here. We reuse the OpenRouter mapper
// for names/pricing/context/interfaces, with three Nous-specific corrections (probe-verified 2026-08-10,
// re-verified 2026-08-17):
// - ~31 embedding models are listed inline (OpenRouter's own list has none) - filtered out
// - direct-routed entries (claude-*, gpt-5.6-sol, muse-spark-1.1, ...) omit fields the OpenRouter
//   zod schema requires (empty architecture/top_provider, no per_request_limits) - normalized, or the
//   flagship chat models would be silently dropped
// - requests go out on the plain 'openai' dialect, so OpenRouter-tunneled parameterSpecs are dead controls
//   here - stripped. Plain `reasoning_effort` works ('high' produces reasoning, 'none' suppresses it), and
//   reasoning comes back as OpenRouter-style `reasoning_details`, which the shared parser renders.


export function nousResearchHeuristic(hostname: string): boolean {
  return hostname.includes('.nousresearch.com');
}


/** Drop non-chat endpoints: embeddings (voyage/bge/e5/...) declare output_modalities ['embeddings'].
 * Entries with EMPTY output_modalities are the direct-routed chat models - kept. */
function _nousIsChatModel(wireModel: any): boolean {
  const outputs = wireModel?.architecture?.output_modalities;
  return !Array.isArray(outputs) || !outputs.length || outputs.includes('text');
}

/** Fill the OpenRouter-schema-required fields that Nous omits on direct-routed entries. */
function _nousNormalizeWireModel(wireModel: any): any {
  return {
    per_request_limits: null,
    ...wireModel,
    description: wireModel?.description ?? '',
    context_length: wireModel?.context_length ?? 4096,
    architecture: {
      modality: 'text->text',
      input_modalities: ['text'],
      output_modalities: ['text'],
      tokenizer: 'Other',
      instruct_type: null,
      ...wireModel?.architecture,
    },
    top_provider: {
      context_length: wireModel?.context_length ?? null,
      max_completion_tokens: null,
      ...wireModel?.top_provider,
    },
  };
}

// parameterSpecs that only the 'openrouter' dialect can emit (plugins, tunneled Anthropic thinking /
// Gemini efforts, Responses-only reasoning mode) - dead or throwing under the 'openai' dialect
const _nousDroppedParamIds: string[] = [
  'llmVndOrtWebSearch',
  'llmVndAntThinkingBudget',
  'llmVndAntEffort',
  'llmVndGemEffort',
  'llmVndGeminiThinkingBudget',
  'llmVndGeminiAspectRatio',
  'llmVndGeminiImageSize',
  'llmVndOaiReasoningMode',
];

/** Adapt an OpenRouter-mapped description to the plain 'openai' request dialect. */
function _nousAdaptToOpenAIDialect(model: ModelDescriptionSchema): ModelDescriptionSchema {

  let parameterSpecs = model.parameterSpecs?.filter(p => !_nousDroppedParamIds.includes(p.paramId));

  // Hermes runs on Nous' own vLLM backend, which ignores `reasoning_effort` (probe-verified: 'high'
  // and 'none' both no-op) - drop the effort control there; hybrid reasoning stays prompt-triggered.
  // Everywhere else the control works: OpenRouter translates `reasoning_effort` upstream even for
  // models whose supported_parameters don't list it (probe-verified on qwen3.6-plus).
  if (model.id.startsWith('nousresearch/'))
    parameterSpecs = parameterSpecs?.filter(p => p.paramId !== 'llmVndMiscEffort' && p.paramId !== 'llmVndOaiEffort');
  const droppedAntThinking = !!model.parameterSpecs?.some(p => p.paramId === 'llmVndAntThinkingBudget');

  let interfaces = model.interfaces;
  // Anthropic budget-thinking models degrade to their non-thinking base form (no way to enable thinking
  // through this dialect - probe-verified: reasoning_effort is silently ignored); adaptive-thinking models
  // (no budget param) keep the reasoning tag
  if (droppedAntThinking)
    interfaces = interfaces.filter(i => i !== LLM_IF_OAI_Reasoning);
  // cache breakpoints can't be stamped through the 'openai' dialect - downgrade to the informational tag
  // (upstream auto-caching still reads back via prompt_tokens_details)
  if (interfaces.includes(LLM_IF_ANT_PromptCaching))
    interfaces = interfaces.map(i => i === LLM_IF_ANT_PromptCaching ? LLM_IF_OAI_PromptCaching : i)
      .filter((i, idx, arr) => arr.indexOf(i) === idx);

  return { ...model, interfaces, parameterSpecs };
}

export function nousResearchModelsToModelDescriptions(wireModels: unknown): ModelDescriptionSchema[] {
  const wireList = (wireModels as any)?.data;
  if (!Array.isArray(wireList)) return [];
  return wireList
    .filter(_nousIsChatModel)
    .map(_nousNormalizeWireModel)
    .sort(openRouterModelFamilySortFn)
    .map(openRouterModelToModelDescription) // also drops the ':batch' twins and resolves the '~...-latest' aliases
    .filter((desc): desc is ModelDescriptionSchema => !!desc)
    .map(_nousAdaptToOpenAIDialect);
}
