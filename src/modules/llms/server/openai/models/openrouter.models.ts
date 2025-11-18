import * as z from 'zod/v4';

import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_PromptCaching, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision, LLM_IF_Outputs_Audio, LLM_IF_Outputs_Image } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';
import { fromManualMapping } from '../../models.mappings';
import { wireOpenrouterModelsListOutputSchema } from '../wiretypes/openrouter.wiretypes';


// configuration
const FIXUP_MAX_OUTPUT = true;


// [OpenRouter] - enough API info to auto-detect models, we only decide what to show here
// - models: https://openrouter.ai/models
// - models list API: https://openrouter.ai/docs/models


const orModelFamilyOrder = [
  // Leading models/organizations (based on capabilities and popularity)
  'anthropic/', 'deepseek/', 'google/', 'openai/', 'x-ai/',
  // Other major providers
  'mistralai/', 'meta-llama/', 'amazon/', 'cohere/',
  // Specialized/AI companies
  'moonshotai/', 'perplexity/', 'qwen/', 'inflection/',
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
  const interfaces = [LLM_IF_OAI_Chat];

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
  ];

  if (model.id.startsWith('anthropic/') && interfaces.includes(LLM_IF_OAI_Reasoning))
    parameterSpecs.push({ paramId: 'llmVndAntThinkingBudget', initialValue: null });

  if (model.id.startsWith('google/') && interfaces.includes(LLM_IF_OAI_Reasoning))
    parameterSpecs.push({ paramId: 'llmVndGeminiThinkingBudget' });

  if (model.id.startsWith('openai/') && interfaces.includes(LLM_IF_OAI_Reasoning))
    parameterSpecs.push({ paramId: 'llmVndOaiReasoningEffort' });


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
    // trainingDataCutoff: ...
    interfaces,
    // benchmark: ...
    chatPrice,
    hidden,
    parameterSpecs,
  });
}

export function openRouterInjectVariants(models: ModelDescriptionSchema[], model: ModelDescriptionSchema): ModelDescriptionSchema[] {
  // keep the same list of models
  models.push(model);

  // inject thinking variants for Anthropic thinking models
  // NOTE: we flipped the logic of some thinking/non-thinking models
  if (model.id.includes('anthropic/') && model.interfaces.includes(LLM_IF_OAI_Reasoning)) {

    // create a thinking variant for the model, by setting 'idVariant' and modifying the label/description
    const thinkingVariant: ModelDescriptionSchema = {
      ...model,
      idVariant: 'thinking',
      label: `${model.label.replace(' (thinking)', '')} (thinking)`,
      description: `(configurable thinking) ${model.description}`,
      interfaces: model.interfaces.filter(i => i !== LLM_IF_OAI_Reasoning),
      // this is what makes it a thinking variant
      parameterSpecs: model.parameterSpecs?.map(param =>
        param.paramId !== 'llmVndAntThinkingBudget' ? param : {
          ...param,
          initialValue: 8192,
          // initialValue: null, // disable thinking
        }),
    };

    models.push(thinkingVariant);
  }

  // no more variants to inject for now
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
