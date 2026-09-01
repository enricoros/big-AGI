import * as z from 'zod/v4';

import { LLM_IF_ANT_PromptCaching, LLM_IF_Inputs_Video, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_PromptCaching, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision, LLM_IF_Outputs_Audio, LLM_IF_Outputs_Image } from '~/common/stores/llms/llms.types';
import { Release } from '~/common/app.release';

import type { ModelDescriptionSchema, OrtVendorLookupResult } from '../../llm.server.types';
import { formatPubDate, fromManualMapping } from '../../models.mappings';
import { llmOrtAntLookup_ThinkingVariants } from '../../anthropic/anthropic.models';
import { llmOrtGemLookup } from '../../gemini/gemini.models';
import { llmOrtMoonshotLookup } from './moonshot.models';
import { llmOrtOaiLookup } from './openai.models';
import { llmOrtSakLookup } from './sakanaai.models';
import { llmOrtXaiLookup } from './xai.models';
import { llmOrtZaiLookup } from './zai.models';
import { wireOpenrouterModelsListOutputSchema } from '../wiretypes/openrouter.wiretypes';


// configuration
const DEV_DEBUG_OPENROUTER_MODELS = (Release.TenantSlug as any) === 'staging' /* ALSO IN STAGING! */ || Release.IsNodeDevBuild;
const FIXUP_MAX_OUTPUT = true;


// [OpenRouter] - enough API info to auto-detect models, we only decide what to show here
// - models: https://openrouter.ai/models
// - models list API: https://openrouter.ai/docs/models


// NOTE: this list doubles as the visibility allow-list - any model whose family prefix is NOT here is hidden by default (see `hidden` below).
const orModelFamilyOrder = [
  // Leading models/organizations (based on capabilities and popularity)
  'anthropic/', 'deepseek/', 'google/', 'openai/', 'x-ai/', 'meta/',
  // Upcoming
  'moonshotai/', 'z-ai/', 'qwen/',
  // Other major providers
  'mistralai/', 'meta-llama/', 'amazon/', 'cohere/',
  // Specialized/AI companies
  'perplexity/', 'inclusionai/', 'arcee-ai/', 'thinkingmachines/', 'sakana/', 'upstage/', 'nex-agi/',
  // Chinese majors (surfaced on OpenRouter directly)
  'minimax/', 'bytedance/', 'bytedance-seed/', 'tencent/', 'baidu/', 'stepfun/', 'meituan/', 'kwaipilot/',
  // Research/open models
  'nvidia/', 'microsoft/', 'nousresearch/', 'ibm-granite/', 'poolside/', 'xiaomi/',
] as const;

// llmVndMiscEffort thinking levels we expose, in canonical order ('xhigh' deliberately absent) - see llms.parameters.ts
const _MISC_EFFORTS = ['low', 'high', 'max'] as const;

// llmVndOaiEffort levels, canonical ascending order ('none' handled separately) - see llms.parameters.ts
const _OAI_EFFORTS = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;

// [2026-08-28] re-checked against the live catalog: 'openai/gpt-3.5-turbo' still hides 4 ids, the Claude 1/2/instant,
// PaLM 2, Llama 2 and dated gpt-4-0314 prefixes matched zero models and were dropped. 'meta-llama/llama-3-' also
// matches nothing today but stays: Meta rotates its OR listing, and it must not catch 3.1/3.2/3.3/4 when it returns.
const orOldModelIDs = [
  // Older OpenAI models
  'openai/gpt-3.5-turbo',
  // Older Meta models (Llama 3.0 only)
  'meta-llama/llama-3-',
] as const;

// exact ids, not prefixes: 'openai/gpt-4' is the 2023 8K model still listed at $30/$60, but as a prefix it
// would also hide gpt-4o / gpt-4.1 / gpt-4-turbo
const orOldExactModelIDs = [
  'openai/gpt-4',
] as const;


/** '~vendor/model-latest' are OR router aliases (alias_target) - drop the '~' so they match their own family */
function _orUnalias(modelId: string): string {
  return modelId.startsWith('~') ? modelId.slice(1) : modelId;
}

export function openRouterModelFamilySortFn(a: { id: string, created?: number }, b: { id: string, created?: number }): number {
  const aPrefixIndex = orModelFamilyOrder.findIndex(prefix => _orUnalias(a.id).startsWith(prefix));
  const bPrefixIndex = orModelFamilyOrder.findIndex(prefix => _orUnalias(b.id).startsWith(prefix));

  // If both have a prefix, sort by family first
  if (aPrefixIndex !== -1 && bPrefixIndex !== -1) {
    if (aPrefixIndex !== bPrefixIndex)
      return aPrefixIndex - bPrefixIndex;
    // ...then within the same family, newest-first by OpenRouter 'created' timestamp.
    // Reverse-alphabetical id sorting got this wrong: the tier name dominated, so 'sonnet'/'opus'
    // outranked 'fable' and the latest flagship (e.g. claude-fable-5) sank below older tiers.
    // By release date this yields fable-5, then opus 4.8 > 4.7 > 4.6 > 4.5, etc.
    if ((a.created ?? 0) !== (b.created ?? 0))
      return (b.created ?? 0) - (a.created ?? 0);
    // stable final tiebreaker for same-day releases (e.g. base vs '-fast' variants)
    return b.id.localeCompare(a.id);
  }

  // If one has a prefix and the other doesn't, prioritize the one with prefix
  return aPrefixIndex !== -1 ? -1 : 1;
}

export function openRouterModelToModelDescription(wireModel: object): ModelDescriptionSchema | null {

  // parse the model
  const { data: model, error } = wireOpenrouterModelsListOutputSchema.safeParse(wireModel);
  if (error) {
    console.warn('[DEV] openRouterModelToModelDescription: parser fail', z.prettifyError(error), wireModel);
    return null;
  }

  // drop ':batch' variants: async batch tiers (50%-off resold vendor batch APIs) can't serve
  // synchronous chat; they'd list as half-price chat models and fail or queue on send.
  // They came back and stayed: 31 across 7 vendors as of 2026-08-28 (17 openai/* at the 2026-07-22 debut, 60 on 08-27).
  // Before ever removing this gate, re-verify the semantics:
  // - if batch stays async (jobs API / delayed delivery), keep the gate; proper support means a batch
  //   job surface (submit/poll/retrieve) outside the chat list, a product feature not a parser change
  // - if OR ships them as sync-callable discounted endpoints, replace the gate with a visible variant:
  //   '(batch)' label suffix + hidden-by-default + latency note, so users opt in knowingly
  if (model.id.endsWith(':batch'))
    return null;

  // [OpenRouter, 2026-08-17] listed but unusable - same rationale as ':batch': they'd list as chat models and fail on send
  // - google/lyria-3-*: music generation billed per song ($0.08) / clip ($0.04), with pricing.prompt '0' so they'd
  //   also carry the free tag; a chat completion returns 500 'Internal error encountered' (probed)
  // - anthropic/claude-opus-4.7-fast: OR still lists the retired 6x tier at $30/$150, but Anthropic removed `speed`
  //   from Opus 4.7 on 2026-07-24, so EVERY request 400s ("'claude-opus-4-7' does not support the `speed`
  //   parameter", probed). Drop the gate if Anthropic restores fast mode there - 4.8-fast/opus-5-fast are fine.
  if (model.id.startsWith('google/lyria-') || model.id === 'anthropic/claude-opus-4.7-fast')
    return null;

  // the 12 '~vendor/model-latest' aliases are full members of their vendor family: resolve them to the
  // model they point at (`alias_target`) everywhere (vendor inheritance, visibility), or they'd fall
  // through to the generic branch - dropping the '~' alone leaves refs like 'claude-opus-latest', which
  // no vendor index can look up (verified: all missed their native interfaces/params before this)
  const modelIdUnaliased = model.alias_target?.slug || _orUnalias(model.id);


  // -- Label --

  let label = model.name || model.id.replace('/', ' · ');


  // -- Pricing --

  const pricing = model.pricing;

  // [OpenRouter, 2026-08-06] `pricing.overrides` are long-context surcharge tiers, ascending by
  // `min_prompt_tokens` (e.g. google/gemini-2.5-pro: 1.25/10 up to 200K, then 2.50/15 above it). 48 of the
  // 388 listed models are tiered today (Qwen, GPT-5.x, Gemini Pro, Grok 4.x, ByteDance Seed, Claude Sonnet 4.x,
  // Sakana Fugu): without folding them in, long prompts would be costed at the cheapest tier.
  // [OpenRouter, 2026-08-16] time-of-day overrides (utc_start/utc_end and, since 2026-08-27, day-of-week utc_days,
  // no min_prompt_tokens) are a peak/off-peak schedule, not context tiers - separated here and folded as the peak
  // below; 3 models today (deepseek-v4-pro-0813, deepseek-v4-flash-vision-exp, tencent/hy3).
  const contextTiers = pricing.overrides?.filter((tier): tier is typeof tier & { min_prompt_tokens: number } => typeof tier.min_prompt_tokens === 'number');
  const priceTiers = contextTiers?.length ? contextTiers : undefined;
  const clockTiers = pricing.overrides?.filter(tier => tier.min_prompt_tokens === undefined && (tier.utc_start !== undefined || tier.utc_end !== undefined || tier.utc_days !== undefined));

  /** per-token price string -> our per-1M price, tiered when the model has long-context overrides */
  function _orPricePerM(field: 'prompt' | 'completion' | 'input_cache_read' | 'input_cache_write'): NonNullable<ModelDescriptionSchema['chatPrice']>['input'] {
    const basePrice = pricing[field];
    if (basePrice === undefined) return undefined;
    let baseValue = parseFloat(basePrice) * 1000 * 1000;
    if (isNaN(baseValue)) return undefined;
    // [OpenRouter, 2026-08-17] `pricing.*` tracks the CURRENT clock window, so an unfolded quote flips through the
    // day (verified on deepseek/deepseek-v4-pro-0813: base == the off-peak half at fetch time). Take the peak, so
    // the listed price is stable and never understates - same upper-bound convention as the native DeepSeek defs.
    if (clockTiers?.length)
      for (const tier of clockTiers) {
        const tierPrice = tier[field];
        const peakValue = tierPrice === undefined ? NaN : parseFloat(tierPrice) * 1000 * 1000;
        if (!isNaN(peakValue) && peakValue > baseValue) baseValue = peakValue;
      }
    if (!priceTiers) return baseValue;
    // 'upTo' is the tier's inclusive upper bound, i.e. where the next tier's `min_prompt_tokens` starts
    let value = baseValue;
    const tieredValues = priceTiers.map((tier, index) => {
      const tierPrice = tier[field];
      if (tierPrice !== undefined) value = parseFloat(tierPrice) * 1000 * 1000;
      return { upTo: priceTiers[index + 1]?.min_prompt_tokens ?? null, price: value };
    });
    return tieredValues.every(tier => tier.price === baseValue) ? baseValue
      : [{ upTo: priceTiers[0].min_prompt_tokens, price: baseValue }, ...tieredValues];
  }

  const inputPrice = _orPricePerM('prompt');
  const outputPrice = _orPricePerM('completion');
  const cacheWritePrice = _orPricePerM('input_cache_write');
  const cacheReadPrice = _orPricePerM('input_cache_read');

  // [OpenRouter] the 6 'openrouter/*' routers (auto, fusion, pareto-code, ...) quote '-1': the price is only
  // known after routing. Emit no price at all - a raw -1 becomes -$1,000,000/M, and 'free' would be a lie.
  const isPostRoutingPrice = typeof inputPrice === 'number' && inputPrice < 0;

  const chatPrice: ModelDescriptionSchema['chatPrice'] | undefined = isPostRoutingPrice ? undefined : {
    input: inputPrice || 'free',
    output: outputPrice || 'free',
  };

  if (chatPrice) {
    if (cacheWritePrice && cacheReadPrice) {
      // if writing, assume anthropic-style
      chatPrice.cache = {
        cType: 'ant-bp',
        read: cacheReadPrice,
        write: cacheWritePrice,
        duration: 300, // 5 minutes default
      };
    } else if (cacheReadPrice) {
      // if only reading, assume openai-style
      chatPrice.cache = {
        cType: 'oai-ac',
        read: cacheReadPrice,
      };
    }
  }

  // -- Pricing: free --
  const seemsFree = chatPrice?.input === 'free' && chatPrice.output === 'free';
  if (seemsFree)
    label += ' · 🎁'; // Free? Discounted?


  // -- Context windows --
  const contextWindow = model.context_length || null; // API value; null (not a guess) when absent
  let maxCompletionTokens = model.top_provider.max_completion_tokens || undefined;

  // sometimes maxCompletionTokens is equal to the context window somehow - if we detect it's > 50%, we set it to undefined
  if (FIXUP_MAX_OUTPUT && maxCompletionTokens && contextWindow !== null && (maxCompletionTokens > contextWindow * 0.5)) {
    // console.log(`[FIXUP] openRouterModelToModelDescription: ignoring maxCompletionTokens=${maxCompletionTokens} for model ${model.id} with contextWindow=${contextWindow}`);
    maxCompletionTokens = undefined;
  }

  // -- Interfaces --
  const interfaces: ModelDescriptionSchema['interfaces'] = [
    LLM_IF_OAI_Chat, // very basic, everyone gets this
  ];

  // input: vision
  if (model.architecture?.input_modalities?.includes('image'))
    interfaces.push(LLM_IF_OAI_Vision);
  // input: video - the chatCompletions adapter lowers media_url parts to OR's 'video_url' extension
  // Gemini-only: the catalog flags ~70 models with `video`, but a live probe (2026-08-27, YouTube
  // watch URL, one latest model per family) showed only Gemini ingests it - the others error
  // upstream (direct-file-only decoders, 'not supported', no endpoints) or silently drop the video
  // (MiniMax: empty answer, 26 prompt tokens). Re-probe before widening.
  if (model.architecture?.input_modalities?.includes('video') && model.id.includes('gemini'))
    interfaces.push(LLM_IF_Inputs_Video);

  // output: image
  if (model.architecture?.output_modalities?.includes('image'))
    interfaces.push(LLM_IF_Outputs_Image);
  // output: audio
  if (model.architecture?.output_modalities?.includes('audio'))
    interfaces.push(LLM_IF_Outputs_Audio);

  // FC
  if (model.supported_parameters?.includes('tools'))
    interfaces.push(LLM_IF_OAI_Fn);
  // Json
  if (model.supported_parameters?.includes('response_format') || model.supported_parameters?.includes('structured_outputs'))
    interfaces.push(LLM_IF_OAI_Json);
  // Reasoning
  if (model.supported_parameters?.includes('reasoning'))
    interfaces.push(LLM_IF_OAI_Reasoning);

  // Prompt caching support, data-driven from pricing signals (probe-verified 2026-07-10):
  // - paid cache writes where breakpoints CONTROL caching (Anthropic, Qwen: no breakpoints = no caching)
  //   = explicit Anthropic-style breakpoints: the client emits meta_cache_control hints and the
  //   oai-completions adapter stamps cache_control (OR dialect)
  // - read-only pricing (Grok, DeepSeek, Moonshot, older OpenAI, ...) = automatic upstream caching,
  //   informational tag only
  // - google/ excluded from breakpoints: explicit Gemini caching via OR double-counts prompt tokens
  //   (net cost INCREASE vs uncached), and implicit caching was not observed through OR at all
  // - openai/ excluded from breakpoints: GPT-5.6+ writes to the paid cache automatically even without
  //   cache_control (stamps are a no-op), so a breakpoint toggle would be fake - informational tag +
  //   cache_write_tokens usage read-back give correct cost accounting anyway
  if (cacheWritePrice && !modelIdUnaliased.startsWith('google/') && !modelIdUnaliased.startsWith('openai/'))
    interfaces.push(LLM_IF_ANT_PromptCaching);
  else if (cacheReadPrice || model.pricing?.input_cache_read !== undefined)
    interfaces.push(LLM_IF_OAI_PromptCaching);


  // -- Parameters --

  const parameterSpecs: ModelDescriptionSchema['parameterSpecs'] = [
    { paramId: 'llmVndOrtWebSearch' }, // OpenRouter web search is available for all models
  ] as const;

  // -- Vendor parameter & interface inheritance --
  // strip the vendor prefix, then the ':free' variant suffix (the Anthropic lookup already strips it internally,
  // the others did not - so 'gemma-4-31b-it:free' missed its def). ':free' only, NOT a blanket /:.*$/: vendor ref
  // maps key their deny entries by the full suffixed id (openai.models.ts: 'gpt-4o:extended': null), and stripping
  // every suffix would hand the lookup the base id and silently un-deny the variant.
  // OR lists 18 non-':batch' colon ids today, all ':free' (2026-08-27; the one ':thinking' id is gone).
  const llmRef = modelIdUnaliased.replace(/^[^/]+\//, '').replace(/:free$/, '');
  let initialTemperature: number | undefined;
  let pubDate: string | undefined;

  const _mergeLookup = (lookup: OrtVendorLookupResult | undefined) => {
    if (lookup?.pubDate !== undefined)
      pubDate = lookup.pubDate;
    if (lookup?.interfaces)
      for (const iface of lookup.interfaces)
        if (!interfaces.includes(iface))
          interfaces.push(iface);
    if (lookup?.parameterSpecs)
      for (const param of lookup.parameterSpecs)
        if (!parameterSpecs.some(p => p.paramId === param.paramId))
          parameterSpecs.push(param);
    if (lookup?.initialTemperature !== undefined)
      initialTemperature = lookup.initialTemperature;
  };

  switch (true) {

    /**
     * Anthropic: all models come in thinking flavor, which is then labeled as variant, or stripped for the base.
     * The 0-day adds the thiking budget
     */
    case modelIdUnaliased.startsWith('anthropic/'):
      // '-fast' is Anthropic's priority service tier resold as a twin id (2x price, same model): look up the base
      const antLookup = llmOrtAntLookup_ThinkingVariants(llmRef.replace(/-fast$/, ''));
      _mergeLookup(antLookup);

      if (DEV_DEBUG_OPENROUTER_MODELS && !antLookup)
        console.log('[DEV] openRouterModelToModelDescription: unknown Anthropic model:', model.id);

      // 0-day: unknown models only - indexed ones use native definitions via llmOrtAntLookup.
      // OR sweep shows effort on all Anthropic models because OR translates reasoning_effort internally;
      // the native API only supports effort on select models - trust the manual definitions for those.

      // NOTE: Fable/Mythos 5+ use always-on adaptive thinking (no budget param). The guard `!antLookup`
      // ensures we only inject the thinking budget for genuinely unknown models, not indexed ones that
      // intentionally omit it.
      const isAntUnknown = !antLookup;
      if (isAntUnknown && interfaces.includes(LLM_IF_OAI_Reasoning) && !parameterSpecs.some(p => p.paramId === 'llmVndAntThinkingBudget')) {
        DEV_DEBUG_OPENROUTER_MODELS && console.log('[DEV] openRouterModelToModelDescription: unknown Anthropic reasoning model:', model.id);
        parameterSpecs.push({ paramId: 'llmVndAntThinkingBudget' }); // configurable thinking budget
        if (!parameterSpecs.some(p => p.paramId === 'llmVndAntEffort'))
          parameterSpecs.push({ paramId: 'llmVndAntEffort', enumValues: ['low', 'medium', 'high', 'xhigh', 'max'] }); // tunneled via OpenRouter's `verbosity` field
      }

      // [Anthropic, 2026-08-17] The Claude 5 generation thinks by default THROUGH OpenRouter (probed: sonnet-5
      // with no `reasoning` field spends reasoning tokens, 4.8 and older spend none), and Fable 5/5.1 reject
      // reasoning.enabled=false outright ('Reasoning is mandatory for this endpoint'). Since sending no field no
      // longer means "off", the non-thinking twin openRouterInjectVariants derives from the thinking-budget spec
      // would be a mislabel (no brain icon, but it reasons and bills for it): drop the spec so those models ship
      // as ONE always-thinking entry, matching their native defs. Revisit if the adapter learns to send an
      // explicit reasoning.enabled=false for the base variant - that would give Sonnet 5 a real non-thinking twin.
      if (model.reasoning?.mandatory || model.reasoning?.default_enabled) {
        const budgetIndex = parameterSpecs.findIndex(p => p.paramId === 'llmVndAntThinkingBudget');
        if (budgetIndex !== -1)
          parameterSpecs.splice(budgetIndex, 1);
      }
      break;

    case modelIdUnaliased.startsWith('google/'):
      const gemLookup = llmOrtGemLookup(llmRef);
      _mergeLookup(gemLookup);

      if (DEV_DEBUG_OPENROUTER_MODELS && !gemLookup && ['google/gemma-', 'google/gemini-2.5-pro-preview-05-06'].every(silence => !model.id.startsWith(silence)))
        console.log('[DEV] openRouterModelToModelDescription: unknown Gemini model:', model.id);

      // 0-day: non-indexed models only - indexed ones use native definitions via llmOrtGemLookup.
      // OR sweep shows effort on all Gemini models because OR translates reasoning_effort internally;
      // the native API uses thinkingLevel (discrete) or thinkingBudget (integer) depending on generation.
      if (interfaces.includes(LLM_IF_OAI_Reasoning) && !parameterSpecs.some(p => p.paramId === 'llmVndGeminiThinkingBudget' || p.paramId === 'llmVndGemEffort')) {
        // DEV_DEBUG_OPENROUTER_MODELS && console.log(`[DEV] openRouterModelToModelDescription: tagging ${gemLookup ? 'KNOWN' : 'unknown'} Gemini reasoning model:`, model.id);
        parameterSpecs.push({ paramId: 'llmVndGemEffort' }); // use the latest known Gemini effort (thinking) levels superset
        // parameterSpecs.push({ paramId: 'llmVndGeminiThinkingBudget' }); // fallback with default range
      }

      // 0-day: Gemini image generation params
      if (interfaces.includes(LLM_IF_Outputs_Image) && !parameterSpecs.some(p => p.paramId === 'llmVndGeminiAspectRatio' || p.paramId === 'llmVndGeminiImageSize')) {
        DEV_DEBUG_OPENROUTER_MODELS && console.log(`[DEV] openRouterModelToModelDescription: tagging ${gemLookup ? 'KNOWN' : 'unknown'} Gemini image output model:`, model.id);
        parameterSpecs.push({ paramId: 'llmVndGeminiAspectRatio' });
        // NOTE: temporarily disable the size, as the returned data is a > 16MB pic which will cause issues
        // to the Zod parser, with "Maximum call stack size exceeded"
        // parameterSpecs.push({ paramId: 'llmVndGeminiImageSize' });
      }
      break;

    case modelIdUnaliased.startsWith('openai/'):
      const oaiLookup = llmOrtOaiLookup(llmRef);
      if (oaiLookup === null) return null; // drop models we really don't care about
      _mergeLookup(oaiLookup);

      if (DEV_DEBUG_OPENROUTER_MODELS && !oaiLookup && ['openai/gpt-oss', 'openai/gpt-3.5'].every(silence => !model.id.startsWith(silence)))
        console.log('[DEV] openRouterModelToModelDescription: unknown OpenAI model:', model.id);

      // 0-day: non-indexed models only - indexed ones use native definitions via llmOrtOaiLookup.
      // OR sweep may show broader effort ranges than the native API supports (OR adds levels internally).
      if (interfaces.includes(LLM_IF_OAI_Reasoning) && !parameterSpecs.some(p => p.paramId === 'llmVndOaiEffort')) {
        // console.log('[DEV] openRouterModelToModelDescription: unexpected OpenAI reasoning model:', model.id);
        parameterSpecs.push({ paramId: 'llmVndOaiEffort' }); // latest known OpenAI effort levels superset
      }
      break;

    case modelIdUnaliased.startsWith('x-ai/') || modelIdUnaliased.startsWith('moonshotai/') || modelIdUnaliased.startsWith('z-ai/') || modelIdUnaliased.startsWith('deepseek/') || modelIdUnaliased.startsWith('sakana/'):
      // inherit native truth (pubDate + real effort ladders): OR's own reasoning fields and `created` are unreliable here
      if (modelIdUnaliased.startsWith('x-ai/'))
        _mergeLookup(llmOrtXaiLookup(llmRef));
      else if (modelIdUnaliased.startsWith('moonshotai/'))
        _mergeLookup(llmOrtMoonshotLookup(llmRef));
      else if (modelIdUnaliased.startsWith('z-ai/'))
        _mergeLookup(llmOrtZaiLookup(llmRef));
      else if (modelIdUnaliased.startsWith('sakana/'))
        _mergeLookup(llmOrtSakLookup(llmRef));

      // ':free' tiers are thinner than their paid twin (glm-5.2:free has no tool endpoints, probed 2026-08-17): OR's
      // per-endpoint `supported_parameters` wins over the inherited Fn interface
      if (model.supported_parameters && !model.supported_parameters.includes('tools')) {
        const fnIndex = interfaces.indexOf(LLM_IF_OAI_Fn);
        if (fnIndex !== -1) interfaces.splice(fnIndex, 1);
      }

      // 0-day: xAI/Grok/Moonshot/Z.ai/DeepSeek/Sakana models get default reasoning effort if not inherited.
      // Checks llmVndOaiEffort too (else an inherited spec gets a 2nd control stacked); skips mandatory models,
      // where a binary on/off is meaningless.
      if (interfaces.includes(LLM_IF_OAI_Reasoning) && !parameterSpecs.some(p => p.paramId === 'llmVndMiscEffort' || p.paramId === 'llmVndOaiEffort')
        && !model.reasoning?.mandatory) {
        // console.log('[DEV] openRouterModelToModelDescription: unexpected xAI/Grok/DeepSeek reasoning model:', model.id);
        // Binary thinking only: we pin enumValues so the shared llmVndMiscEffort registry (which also includes 'max'
        // for native DeepSeek V4) does not surface 'max' in the UI for OR-routed third-party models - unverified they
        // honor it (OR itself accepts reasoning.effort='max' since GPT-5.6, see openai.chatCompletions.ts).
        // [DeepSeek, 2026-08-14] Exception: OR's supported_efforts is right here, separating the dated flash 0731
        // and pro 0813 (max/high/low) from the April ids (xhigh/high -> binary). deepseek/ only - for xAI it is wrong.
        // [2026-08-17] Re-evaluated widening it to every family, and rejected: OR omits xhigh for grok-4.5 (native
        // has it), Z.ai reports [xhigh,high] where the real ladder is none/high/max (folding LOSES 'max'), and
        // Qwen/Meta/ByteDance report xhigh+medium, which llmVndMiscEffort cannot express - they'd collapse to a
        // single degenerate tier. Native truth keeps arriving via llmOrt*Lookup, not via raw OR values.
        const orEfforts = modelIdUnaliased.startsWith('deepseek/') ? model.reasoning?.supported_efforts : undefined;
        const derived = _MISC_EFFORTS.filter(e => orEfforts?.includes(e));
        parameterSpecs.push({
          paramId: 'llmVndMiscEffort',
          // empty list means "no information" -> binary fallback, never "no efforts". 'none' is safe: mandatory never gets here.
          enumValues: !derived.length ? ['none', 'high'] : ['none', ...derived],
        });
      }
      break;

    default:
      // 0-day: generic reasoning models with no upstream-specific vendor mapping. OpenRouter's unified reasoning
      // API (2025-11-11) translates whatever we send via the OAI-compatible branch in openai.chatCompletions.ts
      // to `reasoning: { enabled, effort }`: 'none' -> enabled:false, any other level -> enabled:true + effort,
      // unset ('Default') -> no field (model default).
      // Guard: only when the model advertises reasoning AND no equivalent reasoning control is already present
      // (so we never double up or override a vendor-specific one).
      if (interfaces.includes(LLM_IF_OAI_Reasoning) && !parameterSpecs.some(p =>
        p.paramId === 'llmVndMiscEffort'
        || p.paramId === 'llmVndAntEffort' || p.paramId === 'llmVndAntThinkingBudget'
        || p.paramId === 'llmVndGemEffort' || p.paramId === 'llmVndGeminiThinkingBudget'
        || p.paramId === 'llmVndOaiEffort',
      )) {
        // [OpenRouter, 2026-08-28] use OR's per-model `supported_efforts` where it exists: it is the only truth we
        // have for these families (no native defs to inherit from), and the binary fallback was both lossy and
        // sometimes wrong - it offered 'high' to models whose ladder excludes it (qwen3.8-27b is xhigh/medium/low,
        // nemotron-3-super is medium/low only) and dropped the ladder entirely for the mandatory ones (Meta Muse,
        // qwen3.8-max, stepfun/step-3.7-flash got NO control at all). llmVndOaiEffort, not llmVndMiscEffort: its
        // registry spans minimal..max, so xhigh/medium/minimal survive instead of collapsing onto a single tier.
        // 'none' rides along only when OR says reasoning is disableable (mandatory models 400 on it).
        const orLadder = _OAI_EFFORTS.filter(e => model.reasoning?.supported_efforts?.includes(e));
        if (orLadder.length >= 2)
          parameterSpecs.push({ paramId: 'llmVndOaiEffort', enumValues: model.reasoning?.mandatory ? orLadder : ['none', ...orLadder] });
        else if (!model.reasoning?.mandatory)
          // no usable ladder: shared on/off/Default toggle. Skipped when reasoning is mandatory, where a binary
          // on/off is meaningless - same rule as the xAI/Moonshot/Z.ai/DeepSeek branch above.
          parameterSpecs.push({ paramId: 'llmVndMiscEffort', enumValues: ['none', 'high'] });
      }
      break;
  }


  // 'none' 400s where OR marks reasoning mandatory (verified: grok-4.5, grok-4.20-multi-agent, grok-build-0.1),
  // and that holds in every vendor branch (gemini-3.5/3.6-flash, gpt-5.x-pro/-codex, claude-fable-5, ...), so
  // the strip runs on the merged specs. Replace, don't mutate - specs may be shared with the native defs.
  if (model.reasoning?.mandatory)
    parameterSpecs.forEach((spec, i) => {
      if ((spec.paramId === 'llmVndOaiEffort' || spec.paramId === 'llmVndMiscEffort') && spec.enumValues?.includes('none'))
        parameterSpecs[i] = { ...spec, enumValues: spec.enumValues.filter(v => v !== 'none') };
    });


  // -- Hidden --

  // hidden: hide by default older models or models not in known families; match with startsWith for both orOldModelIDs and orModelFamilyOrder
  const hidden = orOldModelIDs.some(prefix => modelIdUnaliased.startsWith(prefix))
    || orOldExactModelIDs.some(oldId => modelIdUnaliased === oldId)
    || !orModelFamilyOrder.some(prefix => modelIdUnaliased.startsWith(prefix));


  // -- pubDate fallback --

  // When no editorial vendor pubDate was inherited (generic / 0-day / unmapped OR models), derive a
  // day-precision pubDate from OpenRouter's 'created' (catalog/release timestamp) so the "new" badge and
  // newest-model surfaces light up for OR models too. An inherited vendor pubDate always wins (more
  // authoritative than OR's index date), and stale models fall outside the recency window automatically.
  if (pubDate === undefined && model.created)
    pubDate = formatPubDate(model.created);


  return fromManualMapping([], model.id, model?.created, undefined, {
    idPrefix: model.id,
    // latest: ...
    label,
    ...(pubDate !== undefined && { pubDate }),
    description: model.description?.length > 280 ? model.description.slice(0, 277) + '...' : model.description,
    contextWindow,
    maxCompletionTokens,
    interfaces,
    // benchmark: ...
    ...(chatPrice !== undefined && { chatPrice }),
    hidden,
    parameterSpecs,
    ...(initialTemperature !== undefined && { initialTemperature }),
  });
}

/**
 * Inject model variants for OpenRouter models.
 *
 * Unlike other providers that use the centralized createVariantInjector() from llm.server.variants.ts,
 * OpenRouter uses dynamic variant creation based on model properties (vendor prefix, interfaces).
 * This is because OpenRouter aggregates models from multiple vendors and needs provider-specific logic.
 *
 * For static variant maps, prefer using createVariantInjector() or createMultiVariantInjector().
 */
export function openRouterInjectVariants(models: ModelDescriptionSchema[], model: ModelDescriptionSchema): ModelDescriptionSchema[] {

  // OR->Anthropic: inject non-thinking variants
  if (model.id.includes('anthropic/') && model.interfaces.includes(LLM_IF_OAI_Reasoning) && model.parameterSpecs?.some(p => p.paramId === 'llmVndAntThinkingBudget')) {

    // remove the
    const isAdaptive = !!model.parameterSpecs?.find(p => p.paramId === 'llmVndAntThinkingBudget' && p.initialValue === -1);
    const thinkingVariant: ModelDescriptionSchema = {
      ...model,
      idVariant: '::thinking',
      label: `${model.label.replace(' (thinking)', '')} ${isAdaptive ? '(Adaptive)' : '(thinking)'}`,
      description: `(configurable thinking) ${model.description}`,
    };
    models.push(thinkingVariant);

    // base model: remove reasoning interface and thinking budget param (no 🧠 icon)
    const nonThinkingModel: ModelDescriptionSchema = {
      ...model,
      interfaces: model.interfaces.filter(i => i !== LLM_IF_OAI_Reasoning),
      // NOTE: the following line removes the thinking budget param entirely, instead of keeping it with initialValue: null
      parameterSpecs: model.parameterSpecs?.filter(p => p.paramId !== 'llmVndAntThinkingBudget'),
    };
    models.push(nonThinkingModel);

    return models;
  }

  // default
  models.push(model);
  return models;
}

/*
export function openRouterStatTokenizers(openRouterModels: any[]): void {
  // parse all
  const tokenizersMap: Record<string, string[]> = {};
  for (const model of openRouterModels) {
    const { data, error } = wireOpenrouterModelsListOutputSchema.safeParse(model);
    if (error) continue;
    const tokenizer = data.architecture?.tokenizer || 'unknown';
    if (!tokenizersMap[tokenizer])
      tokenizersMap[tokenizer] = [];
    tokenizersMap[tokenizer].push(data.id);
  }
  console.log('\n=== Tokenizer Statistics ===');
  Object.entries(tokenizersMap)
    .sort(([, modelsA], [, modelsB]) => modelsB.length - modelsA.length)
    .forEach(([tokenizer, models]) => {
      console.log(`${tokenizer}: ${models.length} models`);
    });
}*/
