import * as z from 'zod/v4';

import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_PromptCaching, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision, LLM_IF_Outputs_Audio, LLM_IF_Outputs_Image } from '~/common/stores/llms/llms.types';
import { Release } from '~/common/app.release';

import type { ModelDescriptionSchema, OrtVendorLookupResult } from '../../llm.server.types';
import { fromManualMapping } from '../../models.mappings';
import { llmOrtAntLookup_ThinkingVariants } from '../../anthropic/anthropic.models';
import { llmOrtGemLookup } from '../../gemini/gemini.models';
import { llmOrtOaiLookup } from './openai.models';
import { wireOpenrouterModelsListOutputSchema } from '../wiretypes/openrouter.wiretypes';


// configuration
const DEV_DEBUG_OPENROUTER_MODELS = (Release.TenantSlug as any) === 'staging' /* ALSO IN STAGING! */ || Release.IsNodeDevBuild;
const FIXUP_MAX_OUTPUT = true;


// [OpenRouter] - enough API info to auto-detect models, we only decide what to show here
// - models: https://openrouter.ai/models
// - models list API: https://openrouter.ai/docs/models


const orModelFamilyOrder = [
  // Leading models/organizations (based on capabilities and popularity)
  'anthropic/', 'deepseek/', 'google/', 'openai/', 'x-ai/',
  // Upcoming
  'moonshotai/', 'z-ai/', 'qwen/',
  // Other major providers
  'mistralai/', 'meta-llama/', 'amazon/', 'cohere/',
  // Specialized/AI companies
  'perplexity/', 'inflection/',
  // Research/open models
  'nvidia/', 'microsoft/', 'nousresearch/', 'openchat/', // 'huggingfaceh4/',
  // Community/other providers
  // 'gryphe/', 'thedrummer/', 'undi95/', 'cognitivecomputations/', 'sao10k/',
] as const;

const orOldModelIDs = [
  // Older OpenAI models
  'openai/gpt-3.5-turbo-0301', 'openai/gpt-3.5-turbo-0613', 'openai/gpt-4-0314', 'openai/gpt-4-32k-0314',
  // Older Anthropic models
  'anthropic/claude-1', 'anthropic/claude-1.2', 'anthropic/claude-instant-1.0', 'anthropic/claude-instant-1.1',
  'anthropic/claude-2', 'anthropic/claude-2:beta', 'anthropic/claude-2.0', 'anthropic/claude-2.1', 'anthropic/claude-2.0:beta',
  // Older Google models
  'google/palm-2-',
  // Older Meta models
  'meta-llama/llama-3-', 'meta-llama/llama-2-',
] as const;


export function openRouterModelFamilySortFn(a: { id: string }, b: { id: string }): number {
  const aPrefixIndex = orModelFamilyOrder.findIndex(prefix => a.id.startsWith(prefix));
  const bPrefixIndex = orModelFamilyOrder.findIndex(prefix => b.id.startsWith(prefix));

  // If both have a prefix, sort by prefix first, and then alphabetically
  if (aPrefixIndex !== -1 && bPrefixIndex !== -1)
    return aPrefixIndex !== bPrefixIndex ? aPrefixIndex - bPrefixIndex : b.id.localeCompare(a.id);

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


  // -- Label --

  let label = model.name || model.id.replace('/', ' · ');


  // -- Pricing --

  const inputPrice = parseFloat(model.pricing.prompt);
  const outputPrice = parseFloat(model.pricing.completion);
  const cacheWritePrice = model.pricing.input_cache_write ? parseFloat(model.pricing.input_cache_write) : undefined;
  const cacheReadPrice = model.pricing.input_cache_read ? parseFloat(model.pricing.input_cache_read) : undefined;

  const chatPrice: ModelDescriptionSchema['chatPrice'] = {
    input: inputPrice ? inputPrice * 1000 * 1000 : 'free',
    output: outputPrice ? outputPrice * 1000 * 1000 : 'free',
  };

  if (cacheWritePrice && cacheReadPrice) {
    // if writing, assume anthropic-style
    chatPrice.cache = {
      cType: 'ant-bp',
      read: cacheReadPrice * 1000 * 1000,
      write: cacheWritePrice * 1000 * 1000,
      duration: 300, // 5 minutes default
    };
  } else if (cacheReadPrice) {
    // if only reading, assume openai-style
    chatPrice.cache = {
      cType: 'oai-ac',
      read: cacheReadPrice * 1000 * 1000,
    };
  }

  // -- Pricing: free --
  const seemsFree = chatPrice.input === 'free' && chatPrice.output === 'free';
  if (seemsFree)
    label += ' · 🎁'; // Free? Discounted?


  // -- Context windows --
  const contextWindow = model.context_length || 4096;
  let maxCompletionTokens = model.top_provider.max_completion_tokens || undefined;

  // sometimes maxCompletionTokens is equal to the context window somehow - if we detect it's > 50%, we set it to undefined
  if (FIXUP_MAX_OUTPUT && maxCompletionTokens && (maxCompletionTokens > contextWindow * 0.5)) {
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

  // Prompt caching support: check pricing fields
  if (model.pricing?.input_cache_read !== undefined || model.pricing?.input_cache_write !== undefined)
    interfaces.push(LLM_IF_OAI_PromptCaching);


  // -- Parameters --

  const parameterSpecs: ModelDescriptionSchema['parameterSpecs'] = [
    { paramId: 'llmVndOrtWebSearch' }, // OpenRouter web search is available for all models
  ] as const;

  // -- Vendor parameter & interface inheritance --
  const llmRef = model.id.replace(/^[^/]+\//, '');
  let initialTemperature: number | undefined;

  const _mergeLookup = (lookup: OrtVendorLookupResult | undefined) => {
    if (lookup?.interfaces)
      for (const iface of lookup.interfaces)
        if (!interfaces.includes(iface))
          interfaces.push(iface);
    if (lookup?.parameterSpecs)
      for (const param of lookup.parameterSpecs)
        if (!parameterSpecs.some(p => p.paramId === param.paramId))
          parameterSpecs.push(...lookup.parameterSpecs);
    if (lookup?.initialTemperature !== undefined)
      initialTemperature = lookup.initialTemperature;
  };

  switch (true) {

    /**
     * Anthropic: all models come in thinking flavor, which is then labeled as variant, or stripped for the base.
     * The 0-day adds the thiking budget
     */
    case model.id.startsWith('anthropic/'):
      const antLookup = llmOrtAntLookup_ThinkingVariants(llmRef);
      _mergeLookup(antLookup);

      if (DEV_DEBUG_OPENROUTER_MODELS && !antLookup && ['anthropic/claude-3.5-sonnet'].every(silence => !model.id.startsWith(silence)))
        console.log('[DEV] openRouterModelToModelDescription: unknown Anthropic model:', model.id);

      // 0-day
      if (interfaces.includes(LLM_IF_OAI_Reasoning) && !parameterSpecs.some(p => p.paramId === 'llmVndAntThinkingBudget')) {
        DEV_DEBUG_OPENROUTER_MODELS && console.log(`[DEV] openRouterModelToModelDescription: unexpected ${antLookup ? 'KNOWN' : 'unknown'} Anthropic reasoning model:`, model.id);
        parameterSpecs.push({ paramId: 'llmVndAntThinkingBudget' }); // configurable thinking budget
        if (!parameterSpecs.some(p => p.paramId.startsWith('llmVndAntEffort')))
          parameterSpecs.push({ paramId: 'llmVndAntEffortMax' }); // try to enable the broader support
      }
     break;

    case model.id.startsWith('google/'):
      const gemLookup = llmOrtGemLookup(llmRef);
      _mergeLookup(gemLookup);

      if (DEV_DEBUG_OPENROUTER_MODELS && !gemLookup && ['google/gemma-', 'google/gemini-2.5-pro-preview-05-06'].every(silence => !model.id.startsWith(silence)))
        console.log('[DEV] openRouterModelToModelDescription: unknown Gemini model:', model.id);

      // 0-day: reasoning models get default thinking budget if not inherited
      if (interfaces.includes(LLM_IF_OAI_Reasoning) && !parameterSpecs.some(p => p.paramId === 'llmVndGeminiThinkingBudget' || p.paramId === 'llmVndGeminiThinkingLevel' || p.paramId === 'llmVndGeminiThinkingLevel4')) {
        // DEV_DEBUG_OPENROUTER_MODELS && console.log(`[DEV] openRouterModelToModelDescription: tagging ${gemLookup ? 'KNOWN' : 'unknown'} Gemini reasoning model:`, model.id);
        parameterSpecs.push({ paramId: 'llmVndGeminiThinkingLevel4' }); // fallback
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

    case model.id.startsWith('openai/'):
      const oaiLookup = llmOrtOaiLookup(llmRef);
      if (oaiLookup === null) return null; // drop models we really don't care about
      _mergeLookup(oaiLookup);

      if (DEV_DEBUG_OPENROUTER_MODELS && !oaiLookup && ['openai/gpt-oss', 'openai/gpt-3.5'].every(silence => !model.id.startsWith(silence)))
        console.log('[DEV] openRouterModelToModelDescription: unknown OpenAI model:', model.id);

      // 0-day: reasoning models get default 3-level effort if not inherited
      if (interfaces.includes(LLM_IF_OAI_Reasoning) && !parameterSpecs.some(p => p.paramId.startsWith('llmVndOaiReasoning'))) {
        // console.log('[DEV] openRouterModelToModelDescription: unexpected OpenAI reasoning model:', model.id);
        parameterSpecs.push({ paramId: 'llmVndOaiReasoningEffort' });
      }
      break;

    case model.id.startsWith('x-ai/') || model.id.startsWith('moonshotai/') || model.id.startsWith('z-ai/') || model.id.startsWith('deepseek/'):
      // 0-day: xAI/Grok models get default reasoning effort if not inherited
      if (interfaces.includes(LLM_IF_OAI_Reasoning) && !parameterSpecs.some(p => p.paramId.startsWith('llmVndOaiReasoning'))) {
        // console.log('[DEV] openRouterModelToModelDescription: unexpected xAI/Grok/DeepSeek reasoning model:', model.id);
        parameterSpecs.push({ paramId: 'llmVndOaiReasoningEffort' });
      }
      break;

    default:
      // in the default case, we let it be
      break;
  }


  // -- Hidden --

  // hidden: hide by default older models or models not in known families; match with startsWith for both orOldModelIDs and orModelFamilyOrder
  const hidden = orOldModelIDs.some(prefix => model.id.startsWith(prefix))
    || !orModelFamilyOrder.some(prefix => model.id.startsWith(prefix));


  return fromManualMapping([], model.id, model?.created, undefined, {
    idPrefix: model.id,
    // latest: ...
    label,
    description: model.description?.length > 280 ? model.description.slice(0, 277) + '...' : model.description,
    contextWindow,
    maxCompletionTokens,
    interfaces,
    // benchmark: ...
    chatPrice,
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
