import * as z from 'zod/v4';

import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_PromptCaching, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Responses, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import { serverCapitalizeFirstLetter } from '~/server/wire';

import type { DModelParameterId } from '~/common/stores/llms/llms.parameters';

import type { ModelDescriptionSchema, OrtVendorLookupResult } from '../../llm.server.types';

import { fromManualMapping, llmsDefineManualMappings, llmsLabelUncurated } from '../../models.mappings';

// --- Meta Model ID inference (auto-derived from _knownMetaAIModels) ---
export type LlmsMetaAIModelId = typeof _knownMetaAIModels[number]['idPrefix'];


// [Meta AI] Models List API - https://api.meta.ai/v1/models (verified 2026-09-02). Every item is
// { id, object: 'model', created: 0, owned_by: 'meta' }: `created` is a constant 0 (no date and no
// ordering signal, contradicting dev.meta.ai/docs/models) and there is no type/modality field, so an
// image or transcription id is indistinguishable from a chat id. GET /v1/models/{id} returns the same
// four fields. All caps, pricing and pubDate therefore come from the manual mappings below.
const _wireMetaAIModelItemSchema = z.object({
  id: z.string(), // only strictly required field
  object: z.string().nullish(),
  created: z.number().nullish(),
  owned_by: z.string().nullish(),
});


// [Meta AI] Pricing, USD per 1M tokens - https://dev.meta.ai/docs/pricing-rate-limits (2026-09-02).
// Flat ("no long-context premium"); all Standard Spark versions share one rate. Caching is automatic
// (prefix KV, no breakpoints, no write charge): cached input bills at the reduced 'read' rate.
// Not modeled: web search grounding at $2.50 / 1K queries on top of tokens.
const _sparkStandardPrice: ModelDescriptionSchema['chatPrice'] = {
  input: 1.25,
  output: 4.25,
  cache: { cType: 'oai-ac', read: 0.15 },
};

// [Meta AI] Contributor tier: the same model at ~12x/21x lower rates, in exchange for permission to train on
// prompts and completions; also lower team rate limits (100 RPM / 3M TPM vs 3,000 RPM / 4M TPM on Standard).
const _sparkContributorPrice: ModelDescriptionSchema['chatPrice'] = {
  input: 0.10,
  output: 0.20,
  cache: { cType: 'oai-ac', read: 0.002 },
};


// Muse Spark parameters (Responses API, probed 2026-09-02 on all five Spark ids):
// - reasoning.effort: 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'. 'none' parses but 400s on every Spark model
//   ("does not support none with this model"); 'max' is not in the server enum yet (Meta announced it for 1.3 after
//   safety testing - re-probe). Omitted, the server defaults to 'high' - left as the vendor default (no initialValue).
// - web search: the OpenAI-shaped hosted 'web_search' tool, with search_context_size low|medium|high and an approximate
//   user_location (dev.meta.ai/docs/search-grounding); $2.50 / 1K queries on top of tokens. Responses API only.
const _sparkParamSpecs: ModelDescriptionSchema['parameterSpecs'] = [
  { paramId: 'llmVndOaiEffort', enumValues: ['minimal', 'low', 'medium', 'high', 'xhigh'] },
  { paramId: 'llmVndOaiWebSearchContext' },
  { paramId: 'llmVndOaiWebSearchGeolocation' },
];

// Muse Spark interfaces. LLM_IF_OAI_Responses: every Meta model is driven via the Responses API (see chatGenerate.dispatch),
// the only Meta surface that carries reasoning across turns (Chat Completions redacts reasoning_content for external keys).
// Vision: image input (jpeg/png/gif/webp, data URLs, up to 50 per request). PDF, video and audio are accepted upstream
// too, but AIX has no native parts for them yet. Json: text.format json_schema / json_object verified. Prompt caching:
// automatic, reported in usage.input_tokens_details.cached_tokens.
const _sparkInterfaces: ModelDescriptionSchema['interfaces'] = [LLM_IF_OAI_Responses, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision, LLM_IF_OAI_Json, LLM_IF_OAI_PromptCaching];

// All Spark versions share one context window (dev.meta.ai/docs/models). The output cap is not documented by Meta: 131072
// is what Meta's own agent configs advertise (quickstart, coding-agents), while the server accepted max_output_tokens up
// to 1M without a 400 (probed 2026-09-02) - an advertised figure, not an enforced ceiling. Reasoning tokens share it.
const _SPARK_CONTEXT_WINDOW = 1048576;
const _SPARK_MAX_OUTPUT_TOKENS = 131072;

// Muse Spark is "tuned to run at the defaults (temperature=1.0, top_p=1.0)" - dev.meta.ai/docs/protocols/responses
const _SPARK_INITIAL_TEMPERATURE = 1.0;

// Release dates: 1.1 2026-07-09 (ai.meta.com/blog/introducing-muse-spark-meta-model-api), 1.2 2026-08-05
// (research.meta.ai/blog/introducing-muse-code-and-muse-spark-1-2), 1.3 2026-09-02 (Meta research blog, Wikipedia
// 'Muse Spark' release table). The API exposes no dates (created: 0), so these are editorial.
//
// Array order = display order. Contributor variants are hidden by default: they train on the user's prompts and
// completions, so opting in should be a deliberate choice (unhide in the models list).
const _knownMetaAIModels = llmsDefineManualMappings([
  {
    idPrefix: 'muse-spark-1.3',
    label: 'Muse Spark 1.3',
    description: 'Meta\'s latest frontier reasoning model, tuned for agentic workflows (multi-step tool, browser and long-horizon tasks) with improved coding over 1.2. Text, image, video, PDF and audio input (audio understanding is degraded on 1.3). 1M context.',
    contextWindow: _SPARK_CONTEXT_WINDOW,
    maxCompletionTokens: _SPARK_MAX_OUTPUT_TOKENS,
    interfaces: _sparkInterfaces,
    parameterSpecs: _sparkParamSpecs,
    chatPrice: _sparkStandardPrice,
    initialTemperature: _SPARK_INITIAL_TEMPERATURE,
    pubDate: '20260902',
  },
  {
    idPrefix: 'muse-spark-1.2',
    label: 'Muse Spark 1.2',
    description: 'Previous Muse Spark version, and the Spark to use for audio input (1.3 audio understanding is degraded). Text, image, video, audio and PDF input. 1M context.',
    contextWindow: _SPARK_CONTEXT_WINDOW,
    maxCompletionTokens: _SPARK_MAX_OUTPUT_TOKENS,
    interfaces: _sparkInterfaces,
    parameterSpecs: _sparkParamSpecs,
    chatPrice: _sparkStandardPrice,
    initialTemperature: _SPARK_INITIAL_TEMPERATURE,
    pubDate: '20260805',
  },
  {
    idPrefix: 'muse-spark-1.1',
    label: 'Muse Spark 1.1',
    description: 'The original Muse Spark (July 2026), Meta\'s first frontier reasoning model on the Meta Model API. Text, image, video, audio and PDF input. 1M context.',
    contextWindow: _SPARK_CONTEXT_WINDOW,
    maxCompletionTokens: _SPARK_MAX_OUTPUT_TOKENS,
    interfaces: _sparkInterfaces,
    parameterSpecs: _sparkParamSpecs,
    chatPrice: _sparkStandardPrice,
    initialTemperature: _SPARK_INITIAL_TEMPERATURE,
    pubDate: '20260709',
  },
  {
    idPrefix: 'muse-spark-1.3-contributor',
    label: 'Muse Spark 1.3 (Contributor)',
    description: 'Muse Spark 1.3 on the Contributor tier: ~12x cheaper input and ~21x cheaper output, in exchange for Meta training on your prompts and completions. Lower rate limits. Same model and capabilities as the Standard tier.',
    contextWindow: _SPARK_CONTEXT_WINDOW,
    maxCompletionTokens: _SPARK_MAX_OUTPUT_TOKENS,
    interfaces: _sparkInterfaces,
    parameterSpecs: _sparkParamSpecs,
    chatPrice: _sparkContributorPrice,
    initialTemperature: _SPARK_INITIAL_TEMPERATURE,
    pubDate: '20260902',
    hidden: true,
  },
  {
    idPrefix: 'muse-spark-1.2-contributor',
    label: 'Muse Spark 1.2 (Contributor)',
    description: 'Muse Spark 1.2 on the Contributor tier: ~12x cheaper input and ~21x cheaper output, in exchange for Meta training on your prompts and completions. Lower rate limits. Same model and capabilities as the Standard tier.',
    contextWindow: _SPARK_CONTEXT_WINDOW,
    maxCompletionTokens: _SPARK_MAX_OUTPUT_TOKENS,
    interfaces: _sparkInterfaces,
    parameterSpecs: _sparkParamSpecs,
    chatPrice: _sparkContributorPrice,
    initialTemperature: _SPARK_INITIAL_TEMPERATURE,
    pubDate: '20260805',
    hidden: true,
  },
]);


// --- OpenRouter inheritance ---

const _ORT_META_IF_ALLOWLIST: ReadonlySet<string> = new Set([
  // no LLM_IF_OAI_Responses: OpenRouter serves these over Chat Completions; no image output: OR lists the Spark family only
  LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning,
] as const);

// only the effort spec travels (the hosted web_search is a Responses-API construct; OR has its own)
const _ORT_META_PARAM_ALLOWLIST: ReadonlySet<string> = new Set([
  'llmVndOaiEffort',
] as const satisfies DModelParameterId[]);

/**
 * Lookup for OpenRouter: match an OR Meta model ID to a known hardcoded model (OR's `created` is the onboarding date and
 * api.meta.ai reports created: 0, so pubDate must come from here). OR lists 'meta/muse-spark-*' (+ '-contributor') and the
 * open-weight 'meta/muse-glimmer-30b', which is not on api.meta.ai and falls through (undefined).
 * @param orModelName - The model name after stripping 'meta/' (e.g. 'muse-spark-1.3')
 */
export function llmOrtMetaLookup(orModelName: string): OrtVendorLookupResult | undefined {
  const entry = _knownMetaAIModels.find(m => m.idPrefix === orModelName);
  if (!entry?.interfaces) return undefined;

  const interfaces = entry.interfaces.filter(i => _ORT_META_IF_ALLOWLIST.has(i));

  const parameterSpecs = entry.parameterSpecs
    ?.filter(spec => _ORT_META_PARAM_ALLOWLIST.has(spec.paramId))
    .map(spec => ({ ...spec }));

  return { pubDate: entry.pubDate, interfaces, parameterSpecs, initialTemperature: entry.initialTemperature ?? undefined };
}


// [Meta AI] The list API is type-blind and the catalog mixes families: 'muse-image-1.0' (image output over Responses,
// accepts only the image_generation tool) and 'muse-voice-transcribe-1.0' (own /v1/asr endpoints; 404 model_not_found
// on /v1/responses) are listed next to the chat models and must never reach the chat picker.
const _METAAI_NON_CHAT_PREFIXES = ['muse-image-', 'muse-voice-transcribe-'];


function _prettyModelId(id: string): string {
  // fallback labeler for unknown models, e.g. "muse-spark-1.4" => "Muse Spark 1.4"
  return id
    .replaceAll(/[_-]/g, ' ')
    .split(' ')
    .map(serverCapitalizeFirstLetter)
    .join(' ')
    .trim();
}


export function metaAIModelsToModelDescriptions(wireModels: unknown): ModelDescriptionSchema[] {

  // tolerant top-level unwrap: accept a plain array or `{ data: [...] }`, else fall back to []
  let rawItems: unknown[] = [];
  if (Array.isArray(wireModels))
    rawItems = wireModels;
  else if (wireModels && typeof wireModels === 'object' && Array.isArray((wireModels as { data?: unknown[] }).data))
    rawItems = (wireModels as { data: unknown[] }).data;

  const descriptions: ModelDescriptionSchema[] = [];

  for (const rawItem of rawItems) {
    // per-item safeParse: one bad entry never crashes the rest
    const { data: model, error } = _wireMetaAIModelItemSchema.safeParse(rawItem);
    if (error || !model?.id) {
      if (error) console.warn('[DEV] metaAI: skipping invalid model entry', z.prettifyError(error));
      continue;
    }

    // drop the non-chat families by id (the API gives us nothing else to go by)
    if (_METAAI_NON_CHAT_PREFIXES.some(prefix => model.id.startsWith(prefix)))
      continue;

    // known models get full caps/pricing; unknown ids are uncurated (the list API discloses no type/modality/
    // context): '[?]' + null contextWindow keeps them visible in-app but holds them off the llm-registry-sync
    // publication push. A new Spark version inherits the family's interfaces and params (all versions share them).
    const isSparkFamily = model.id.startsWith('muse-spark-');
    descriptions.push(fromManualMapping(_knownMetaAIModels, model.id, undefined /* API `created` is a constant 0 */, undefined, {
      idPrefix: model.id,
      label: llmsLabelUncurated(_prettyModelId(model.id)),
      description: `New Meta arrival '${model.id}', not yet curated - capabilities and context window unverified.`,
      contextWindow: null,
      interfaces: isSparkFamily ? _sparkInterfaces : [LLM_IF_OAI_Responses, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision],
      ...(isSparkFamily ? { parameterSpecs: _sparkParamSpecs } : {}),
      hidden: false,
    }));
  }

  // sort into editorial display order (= _knownMetaAIModels array order; unknown models sort at their
  // family slot via prefix, ties by id) - the client preserves the service's list order
  const _rank = (id: string) => {
    const exact = _knownMetaAIModels.findIndex(known => id === known.idPrefix);
    if (exact !== -1) return exact;
    const prefix = _knownMetaAIModels.findIndex(known => id.startsWith(known.idPrefix));
    return prefix === -1 ? _knownMetaAIModels.length : prefix;
  };
  return descriptions.sort((a, b) => _rank(a.id) - _rank(b.id) || a.id.localeCompare(b.id));
}
