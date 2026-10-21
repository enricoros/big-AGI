import * as z from 'zod/v4';

import { LLM_IF_HOTFIX_NoStream, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_PromptCaching, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Responses, LLM_IF_OAI_Vision, LLM_IF_Outputs_Image, LLM_IF_Outputs_NoText } from '~/common/stores/llms/llms.types';

import { serverCapitalizeFirstLetter } from '~/server/wire';

import type { DModelParameterId } from '~/common/stores/llms/llms.parameters';

import type { ModelDescriptionSchema, OrtVendorLookupResult } from '../../llm.server.types';

import { fromManualMapping, type KnownModel, llmsDefineManualMappings, llmsLabelUncurated } from '../../models.mappings';

// --- Meta Model ID inference (auto-derived from _knownMetaAIModels) ---
export type LlmsMetaAIModelId = typeof _knownMetaAIModels[number]['idPrefix'];


// [Meta AI] Models List API - https://api.meta.ai/v1/models (verified 2026-10-21). Every item is
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


// [Meta AI] Pricing, USD per 1M tokens - https://dev.meta.ai/docs/pricing-rate-limits (2026-10-21).
// Flat ("no long-context premium"); all Standard Spark versions share one rate. Caching is automatic
// (prefix KV, no breakpoints, no write charge): cached input bills at the reduced 'read' rate.
// Web search grounding: $2.50 / 1K queries on top of tokens.
const _wonderStandardPrice: ModelDescriptionSchema['chatPrice'] = {
  input: 4,
  output: 20,
  cache: { read: 0.20 },
  tools: { webSearch: 2.5 },
};

const _sparkStandardPrice: ModelDescriptionSchema['chatPrice'] = {
  input: 1.25,
  output: 4.25,
  cache: { read: 0.15 },
  tools: { webSearch: 2.5 },
};

// [Meta AI] Contributor tier: the same model at ~12x/21x lower rates, in exchange for permission to train on
// prompts and completions; also lower team rate limits (150 RPM / 3M TPM vs 3,000 RPM / 4M TPM on Standard).
// Spark 1.3 and 1.2 only: Wonder has no Contributor tier on the API.
const _sparkContributorPrice: ModelDescriptionSchema['chatPrice'] = {
  input: 0.10,
  output: 0.20,
  cache: { read: 0.002 },
  tools: { webSearch: 2.5 },
};


// Muse Spark parameters (Responses API, probed 2026-09-02 on all five Spark ids; effort re-probed 2026-10-21):
// - reasoning.effort: 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'. 'none' parses but 400s on every Spark and Wonder
//   model ("not supported for model"). Omitted, the server defaults to 'high' - left as the vendor default (no initialValue).
// - 'max' (extended reasoning beyond 'xhigh', same per-token price): muse-wonder-1.0, muse-spark-1.3 and 1.3-contributor. 1.1, 1.2
//   and 1.2-contributor 400 on it. reasoning.md excludes 1.3-contributor, but it accepts and honors max (2026-10-15: 2.6-3.1K
//   reasoning tokens at max vs 0.4-0.8K at xhigh on the same prompt, matching 1.3 Standard). 'max' on Wonder does not select
//   Muse Wonder Full, a Muse Code-only variant (models.md).
// - web search: the OpenAI-shaped hosted 'web_search' tool, with search_context_size low|medium|high and an approximate
//   user_location (dev.meta.ai/docs/search-grounding); $2.50 / 1K queries on top of tokens. Responses API only.
const _sparkParamSpecs: ModelDescriptionSchema['parameterSpecs'] = [
  { paramId: 'llmVndOaiEffort', enumValues: ['minimal', 'low', 'medium', 'high', 'xhigh'] },
  { paramId: 'llmVndOaiWebSearchContext' },
  { paramId: 'llmVndOaiWebSearchGeolocation' },
];

const _maxEffortParamSpecs: ModelDescriptionSchema['parameterSpecs'] = [
  { paramId: 'llmVndOaiEffort', enumValues: ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'] },
  { paramId: 'llmVndOaiWebSearchContext' },
  { paramId: 'llmVndOaiWebSearchGeolocation' },
];

// Muse Spark interfaces. LLM_IF_OAI_Responses: every Meta model is driven via the Responses API (see chatGenerate.dispatch),
// the only Meta surface that carries reasoning across turns (Chat Completions redacts reasoning_content for external keys).
// Vision: image input (jpeg/png/gif/webp, data URLs, up to 50 per request). PDF, video and audio are accepted upstream
// too, but AIX has no native parts for them yet. Json: text.format json_schema / json_object verified. Prompt caching:
// automatic, reported in usage.input_tokens_details.cached_tokens.
// Muse Wonder takes the same requests on the same endpoints (models.md); verified 2026-10-13 on muse-wonder-1.0: parallel
// function calls, web search, json_schema, image input, and cached_tokens on a repeated prefix.
const _sparkInterfaces: ModelDescriptionSchema['interfaces'] = [LLM_IF_OAI_Responses, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision, LLM_IF_OAI_Json, LLM_IF_OAI_PromptCaching];

// All Spark versions and Wonder share one context window (dev.meta.ai/docs/models). The output cap is not documented by Meta:
// 131072 is what Meta's own agent configs advertise for Spark 1.3 (quickstart, coding-agents) and is assumed for Wonder, while
// the server accepted max_output_tokens up to 1M without a 400 (probed 2026-09-02) - an advertised figure, not an enforced
// ceiling. Reasoning tokens share it.
const _SPARK_CONTEXT_WINDOW = 1048576;
const _SPARK_MAX_OUTPUT_TOKENS = 131072;

// Muse Spark is "tuned to run at the defaults (temperature=1.0, top_p=1.0)" - dev.meta.ai/docs/protocols/responses
// (the docs say this of Spark only; applied to Wonder too, as it is the server default)
const _SPARK_INITIAL_TEMPERATURE = 1.0;

// Muse Image 1.0 - image generation over the Responses API ($0.01 per generated image, flat; not modeled in chatPrice).
// Accepts text + reference images, returns one 'image_generation_call' item with base64 WebP and an empty message. The
// server streams no item events for it (response.created -> response.completed only, probed 2026-09-02), so it runs
// non-streaming: the NS parser reads the final output items. Accepts ONLY the image_generation tool (function/web_search
// tools 400), so no Fn interface and no params; the tool's reasoning_strength/size controls are not wired.
const _museImageInterfaces: ModelDescriptionSchema['interfaces'] = [LLM_IF_OAI_Responses, LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_Outputs_Image, LLM_IF_Outputs_NoText, LLM_IF_HOTFIX_NoStream];

// Release dates: 1.1 2026-07-09 (ai.meta.com/blog/introducing-muse-spark-meta-model-api, which also dates Muse Image to
// the same week - 07-07), 1.2 2026-08-05 (research.meta.ai/blog/introducing-muse-code-and-muse-spark-1-2), 1.3 2026-09-02
// (Meta research blog, Wikipedia 'Muse Spark' release table), Wonder 1.0 2026-10-12 (research.meta.ai/blog/muse-wonder,
// about.fb.com/news/2026/10/introducing-muse-wonder-models). The API exposes no dates (created: 0), so these are editorial.
//
// Array order = display order, newest first within a line (the uncurated-id guesser below relies on it). Contributor
// variants are hidden by default: they train on the user's prompts and completions, so opting in should be a deliberate
// choice (unhide in the models list).
const _knownMetaAIModels = llmsDefineManualMappings([
  {
    idPrefix: 'muse-wonder-1.0',
    label: 'Muse Wonder 1.0',
    description: 'Meta\'s most capable model (preview), for complex software engineering and long-horizon agentic work: multi-file changes, sub-agent delegation, parallel tool calls. Text, image, video, audio and PDF input. 1M context. Standard tier only.',
    contextWindow: _SPARK_CONTEXT_WINDOW,
    maxCompletionTokens: _SPARK_MAX_OUTPUT_TOKENS,
    interfaces: _sparkInterfaces,
    parameterSpecs: _maxEffortParamSpecs,
    chatPrice: _wonderStandardPrice,
    initialTemperature: _SPARK_INITIAL_TEMPERATURE,
    pubDate: '20261012',
  },
  {
    idPrefix: 'muse-spark-1.3',
    label: 'Muse Spark 1.3',
    description: 'Latest Muse Spark, Meta\'s reasoning model for high-volume and cost-sensitive work, tuned for agentic workflows (multi-step tool, browser and long-horizon tasks) with improved coding over 1.2. Text, image, video, PDF and audio input (audio understanding is degraded on 1.3). 1M context.',
    contextWindow: _SPARK_CONTEXT_WINDOW,
    maxCompletionTokens: _SPARK_MAX_OUTPUT_TOKENS,
    interfaces: _sparkInterfaces,
    parameterSpecs: _maxEffortParamSpecs,
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
    idPrefix: 'muse-image-1.0',
    label: 'Muse Image 1.0',
    description: 'Meta\'s image generation model: generates and edits images from text and reference images, with built-in web and image search. Flat $0.01 per generated image. Non-streaming.',
    contextWindow: null, // undocumented for the image model (the text prompt is small by construction)
    interfaces: _museImageInterfaces,
    pubDate: '20260707',
  },
  {
    idPrefix: 'muse-spark-1.3-contributor',
    label: 'Muse Spark 1.3 (Contributor)',
    description: 'Muse Spark 1.3 on the Contributor tier: ~12x cheaper input and ~21x cheaper output, in exchange for Meta training on your prompts and completions. Lower rate limits. Same model and capabilities as the Standard tier.',
    contextWindow: _SPARK_CONTEXT_WINDOW,
    maxCompletionTokens: _SPARK_MAX_OUTPUT_TOKENS,
    interfaces: _sparkInterfaces,
    parameterSpecs: _maxEffortParamSpecs,
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

// Open-weight Muse models: not on api.meta.ai, reached through OpenRouter's 'meta/' namespace. Kept out of _knownMetaAIModels
// so the API mapper and the uncurated-id guesser never treat them as API siblings.
const _ortOpenWeightMetaModels: ReadonlyArray<Pick<KnownModel, 'idPrefix' | 'pubDate' | 'interfaces' | 'parameterSpecs' | 'initialTemperature'>> = [
  {
    // Muse Spark Open: the open-weight Spark (816B MoE, 42B active), 1,048,576 context, text/image/audio/video in. Always
    // reasons: reasoning_effort low|medium|high|xhigh, default xhigh; 'none', 'minimal' and 'max' are rejected
    // (dev.meta.ai/docs/muse-spark-open/prompting). Recommended temperature 1.0 (.../muse-spark-open/settings).
    idPrefix: 'muse-spark-open',
    pubDate: '20261015', // OpenRouter canonical slug meta/muse-spark-open-20261015
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    parameterSpecs: [{ paramId: 'llmVndOaiEffort', enumValues: ['low', 'medium', 'high', 'xhigh'] }],
    initialTemperature: 1.0,
  },
  {
    // Muse Glimmer: the open-weight 30B dense model distilled from Spark, text/image in, 128K default context. Always reasons:
    // reasoning_strength low|medium|high|xhigh, default high (dev.meta.ai/docs/muse-glimmer/prompting). On OpenRouter (2026-10-21)
    // 'none' 400s ("reasoning is mandatory"); 'minimal' and 'max' are accepted but outside the template's domain. Model-card
    // temperature 1.0.
    idPrefix: 'muse-glimmer-30b',
    pubDate: '20260810', // OpenRouter canonical slug meta/muse-glimmer-30b-20260810
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    parameterSpecs: [{ paramId: 'llmVndOaiEffort', enumValues: ['low', 'medium', 'high', 'xhigh'] }],
    initialTemperature: 1.0,
  },
];

/**
 * Lookup for OpenRouter: match an OR Meta model ID to a known hardcoded model (OR's `created` is the onboarding date and
 * api.meta.ai reports created: 0, so pubDate must come from here). OR lists 'meta/muse-spark-*' (+ '-contributor'), the
 * unversioned 'meta/muse-wonder' (resolved to the newest curated Standard version of the line), and the open-weight
 * 'meta/muse-spark-open' and 'meta/muse-glimmer-30b' (_ortOpenWeightMetaModels).
 * @param orModelName - The model name after stripping 'meta/' (e.g. 'muse-spark-1.3')
 */
export function llmOrtMetaLookup(orModelName: string): OrtVendorLookupResult | undefined {
  const entry = _knownMetaAIModels.find(m => m.idPrefix === orModelName)
    ?? _ortOpenWeightMetaModels.find(m => m.idPrefix === orModelName)
    ?? (/^muse-[a-z]+$/.test(orModelName) ? _knownMetaAIModels.find(m => m.idPrefix.startsWith(`${orModelName}-`) && !m.idPrefix.endsWith(_METAAI_CONTRIBUTOR_SUFFIX)) : undefined);
  if (!entry?.interfaces) return undefined;

  const interfaces = entry.interfaces.filter(i => _ORT_META_IF_ALLOWLIST.has(i));

  const parameterSpecs = entry.parameterSpecs
    ?.filter(spec => _ORT_META_PARAM_ALLOWLIST.has(spec.paramId))
    .map(spec => ({ ...spec }));

  return { pubDate: entry.pubDate, interfaces, parameterSpecs, initialTemperature: entry.initialTemperature ?? undefined };
}


// [Meta AI] The list API is type-blind and the catalog mixes families: 'muse-voice-transcribe-1.0' (speech-to-text on its
// own /v1/asr endpoints; 404 model_not_found on /v1/responses) and 'sam-3.1' (segmentation: boxes and masks as special-token
// text on /v1/responses) must never reach the chat picker. Muse Image stays: it is a Responses-API model with image output.
const _METAAI_NON_CHAT_PREFIXES = ['muse-voice-transcribe-', 'sam-'];

const _METAAI_CONTRIBUTOR_SUFFIX = '-contributor';


// [Meta AI] Guessing uncurated ids. Ids are 'muse-<line>-<version>' plus an optional '-contributor' tier suffix (models.md),
// and within a line the context window, modalities, interfaces and params have held across versions (Spark 1.1-1.3), so a
// new version inherits them from its newest curated sibling of the same tier - still '[?]'-labeled until curated, but with a
// real context window, which also lets llm-registry-sync record it. Not inherited: price (per line - Wonder costs 3.2x Spark
// input - and a wrong price is worse than none) and pubDate. Contributor ids are always hidden: Meta trains on their data.
function _metaAIGuessSiblingIndex(modelId: string): number {
  const line = /^muse-[a-z]+-/.exec(modelId)?.[0];
  if (!line) return -1;
  const isContributor = modelId.endsWith(_METAAI_CONTRIBUTOR_SUFFIX);
  // array order is newest-first within a line: the first same-tier match is the newest sibling, else the newest of the line
  const sameTier = _knownMetaAIModels.findIndex(m => m.idPrefix.startsWith(line) && m.idPrefix.endsWith(_METAAI_CONTRIBUTOR_SUFFIX) === isContributor);
  return sameTier !== -1 ? sameTier : _knownMetaAIModels.findIndex(m => m.idPrefix.startsWith(line));
}

function _metaAIGuessModel(modelId: string): KnownModel {
  const isContributor = modelId.endsWith(_METAAI_CONTRIBUTOR_SUFFIX);
  const siblingIndex = _metaAIGuessSiblingIndex(modelId);
  const sibling = siblingIndex !== -1 ? _knownMetaAIModels[siblingIndex] : undefined;
  const tierNote = isContributor ? ' Contributor tier: Meta trains on your prompts and completions.' : '';

  // unknown line: the list API discloses no type/modality/context, so null contextWindow keeps it visible in-app but
  // holds it off the llm-registry-sync publication push
  if (!sibling)
    return {
      idPrefix: modelId,
      label: llmsLabelUncurated(_prettyModelId(modelId)),
      description: `New Meta arrival '${modelId}', not yet curated - capabilities and context window unverified.${tierNote}`,
      contextWindow: null,
      interfaces: [LLM_IF_OAI_Responses, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision],
      hidden: isContributor,
    };

  return {
    idPrefix: modelId,
    label: llmsLabelUncurated(_prettyModelId(modelId)),
    description: `New Meta arrival '${modelId}', not yet curated - context, capabilities and parameters assumed from ${sibling.idPrefix}; price unknown.${tierNote}`,
    contextWindow: sibling.contextWindow,
    maxCompletionTokens: sibling.maxCompletionTokens,
    interfaces: sibling.interfaces,
    parameterSpecs: sibling.parameterSpecs,
    initialTemperature: sibling.initialTemperature,
    hidden: isContributor,
  };
}


function _prettyModelId(id: string): string {
  // fallback labeler for unknown models, e.g. "muse-spark-1.4" => "Muse Spark 1.4", "muse-spark-1.4-contributor" => "Muse Spark 1.4 (Contributor)"
  const isContributor = id.endsWith(_METAAI_CONTRIBUTOR_SUFFIX);
  const pretty = (isContributor ? id.slice(0, -_METAAI_CONTRIBUTOR_SUFFIX.length) : id)
    .replaceAll(/[_-]/g, ' ')
    .split(' ')
    .map(serverCapitalizeFirstLetter)
    .join(' ')
    .trim();
  return isContributor ? `${pretty} (Contributor)` : pretty;
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

    // known models get full caps/pricing (a suffixed id of a curated version, e.g. a dated snapshot, prefix-matches it);
    // unknown ids are guessed from their line. An unknown Contributor id must not prefix-match its Standard twin
    // ('muse-wonder-1.0-contributor' -> 'muse-wonder-1.0'): it would inherit the Standard price and visibility.
    const isUnknownContributor = model.id.endsWith(_METAAI_CONTRIBUTOR_SUFFIX) && !_knownMetaAIModels.some(known => known.idPrefix === model.id);
    descriptions.push(fromManualMapping(isUnknownContributor ? [] : _knownMetaAIModels, model.id, undefined /* API `created` is a constant 0 */, undefined, _metaAIGuessModel(model.id)));
  }

  // sort into editorial display order (= _knownMetaAIModels array order; a suffixed id sorts at its curated base, a
  // guessed id just above its newest sibling, anything else last; ties by id) - the client preserves the service's list order
  const _rank = (id: string) => {
    const exact = _knownMetaAIModels.findIndex(known => id === known.idPrefix);
    if (exact !== -1) return exact;
    const prefix = id.endsWith(_METAAI_CONTRIBUTOR_SUFFIX) ? -1 : _knownMetaAIModels.findIndex(known => id.startsWith(known.idPrefix));
    if (prefix !== -1) return prefix;
    const sibling = _metaAIGuessSiblingIndex(id);
    return sibling === -1 ? _knownMetaAIModels.length : sibling - 0.5;
  };
  return descriptions.sort((a, b) => _rank(a.id) - _rank(b.id) || a.id.localeCompare(b.id));
}
