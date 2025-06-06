import type { ModelDescriptionSchema } from '~/modules/llms/server/llm.server.types';
import { wireOpenrouterModelsListOutputSchema } from '~/modules/llms/server/openai/openrouter.wiretypes';
import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';
import { fromManualMapping } from '~/modules/llms/server/openai/models/models.data';


// [OpenRouter] - enough API info to auto-detect models, we only decide what to show here
// - models: https://openrouter.ai/models
// - models list API: https://openrouter.ai/docs/models

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
];

const orModelFamilyOrder = [
  // Leading models/organizations (based on capabilities and popularity)
  'anthropic/', 'deepseek/', 'google/', 'openai/', 'x-ai/',
  // Other major providers
  'mistralai/', 'meta-llama/', 'amazon/', 'cohere/',
  // Specialized/AI companies
  'perplexity/', 'phind/', 'qwen/', 'inflection/',
  // Research/open models
  'nvidia/', 'microsoft/', 'nousresearch/', 'openchat/', // 'huggingfaceh4/',
  // Community/other providers
  // 'gryphe/', 'thedrummer/', 'undi95/', 'cognitivecomputations/', 'sao10k/',
];

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
    console.warn(`openRouterModelToModelDescription: Failed to parse model data`, { error });
    return null;
  }

  // parse pricing
  const inputPrice = parseFloat(model.pricing.prompt);
  const outputPrice = parseFloat(model.pricing.completion);
  const chatPrice: ModelDescriptionSchema['chatPrice'] = {
    input: inputPrice ? inputPrice * 1000 * 1000 : 'free',
    output: outputPrice ? outputPrice * 1000 * 1000 : 'free',
    // image...
    // request...
  };
  const seemsFree = chatPrice.input === 'free' && chatPrice.output === 'free';

  // openrouter provides the fields we need as part of the model object
  let label = model.name || model.id.replace('/', ' · ');
  if (seemsFree)
    label += ' · 🎁'; // Free? Discounted?
  // label = label.replace('(self-moderated)', '🔓');

  // hidden: hide by default older models or models not in known families; match with startsWith for both orOldModelIDs and orModelFamilyOrder
  const hidden = orOldModelIDs.some(prefix => model.id.startsWith(prefix))
    || !orModelFamilyOrder.some(prefix => model.id.startsWith(prefix));

  return fromManualMapping([], model.id, undefined, undefined, {
    idPrefix: model.id,
    // latest: ...
    label,
    // created: ...
    // updated: ...
    description: model.description,
    contextWindow: model.context_length || 4096,
    maxCompletionTokens: model.top_provider.max_completion_tokens || undefined,
    // trainingDataCutoff: ...
    interfaces: [LLM_IF_OAI_Chat],
    // benchmark: ...
    chatPrice,
    hidden,
  });
}

export function openRouterInjectVariants(models: ModelDescriptionSchema[], model: ModelDescriptionSchema): ModelDescriptionSchema[] {
  // keep the same list of models
  models.push(model);

  // inject thinking variants for Anthropic thinking models
  const antThinkingModels = ['anthropic/claude-opus-4', 'anthropic/claude-sonnet-4', 'anthropic/claude-3-7-sonnet'];
  if (antThinkingModels.includes(model.id)) {

    // create a thinking variant for the model, by setting 'idVariant' and modifying the label/description
    const thinkingVariant: ModelDescriptionSchema = {
      ...model,
      idVariant: 'thinking',
      label: `${model.label} (thinking)`,
      description: `(extended thinking mode) ${model.description}`,
      interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
      // this is what makes it a thinking variant
      parameterSpecs: [
        ...(model.parameterSpecs || []),
        { paramId: 'llmVndAntThinkingBudget', initialValue: 1024 },
      ],
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
