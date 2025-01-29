import type { ModelDescriptionSchema } from '~/modules/llms/server/llm.server.types';
import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';
import { _knownOpenAIChatModels } from '~/modules/llms/server/openai/models/openai.models';
import { wireOpenPipeModelOutputSchema } from '~/modules/llms/server/openai/openpipe.wiretypes';
import { fromManualMapping, ManualMapping } from '~/modules/llms/server/openai/models/models.data';

const _knownOpenPipeChatModels: ModelDescriptionSchema[] = [

  /* OpenPipe models - by default it's OpenAI models, through the proxy service. */

  // OpenAI models: these work
  {
    id: 'gpt-4o-mini-2024-07-18',
    label: '💾➜ GPT-4o Mini (2024-07-18)',
    description: 'Affordable model for fast, lightweight tasks. GPT-4o mini is cheaper and more capable than GPT-3.5 Turbo.',
    contextWindow: 128000,
    maxCompletionTokens: 16384,
    trainingDataCutoff: 'Oct 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: _knownOpenAIChatModels.find(m => m.idPrefix === 'gpt-4o-mini-2024-07-18')?.chatPrice,
    benchmark: { cbaMmlu: 82.0 },
  },
  {
    id: 'gpt-4o-2024-05-13',
    label: '💾➜ GPT-4o (2024-05-13)',
    description: 'Advanced, multimodal flagship model that\'s cheaper and faster than GPT-4 Turbo.',
    contextWindow: 128000,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Oct 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: _knownOpenAIChatModels.find(m => m.idPrefix === 'gpt-4o-2024-05-13')?.chatPrice,
    benchmark: { cbaElo: 1287 },
  },
  {
    id: 'gpt-3.5-turbo-1106',
    label: '💾➜ GPT-3.5 Turbo (1106)',
    description: 'GPT-3.5 Turbo model from November 2023',
    contextWindow: 16385,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Sep 2021',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: _knownOpenAIChatModels.find(m => m.idPrefix === 'gpt-3.5-turbo-1106')?.chatPrice,
    benchmark: { cbaElo: 1072 },
  },
  {
    id: 'gpt-3.5-turbo-0125',
    label: '💾➜ GPT-3.5 Turbo (0125)',
    description: 'The latest GPT-3.5 Turbo model with higher accuracy at responding in requested formats',
    contextWindow: 16385,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Sep 2021',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: _knownOpenAIChatModels.find(m => m.idPrefix === 'gpt-3.5-turbo-0125')?.chatPrice,
    benchmark: { cbaElo: 1105 },
  },

  // Not supported yet "We don't support streaming responses for chat completions with Anthropic yet. Please email us at support@openpipe.ai if this is a feature you need!"
  // {
  //   id: 'claude-3-5-sonnet-20240620',
  //   label: '💾➜ Claude 3.5 Sonnet',
  //   description: 'The most intelligent Claude model',
  //   contextWindow: 200000, // Characters
  //   maxCompletionTokens: 8192,
  //   trainingDataCutoff: 'Apr 2024',
  //   interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
  //   pricing: { input: 3, output: 15 },
  // },

  // Default finetune, not available at the onset
  // {
  //   id: 'mistral-ft-optimized-1227',
  //   label: 'OpenPipe · Mistral FT Optimized',
  //   description: 'OpenPipe optimized Mistral fine-tuned model',
  //   contextWindow: 32768, // Assuming similar to Mixtral, as it's Mistral-based
  //   interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn], // Assuming similar to Mixtral
  // },

  // Finetune-able models, but not present
  // {
  //   id: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
  //   label: 'Meta-Llama 3.1 · 8B Instruct',
  //   description: 'Meta-Llama 3.1 8B Instruct model',
  //   contextWindow: 128000, // Inferred from Llama 3 models in the original code
  //   maxCompletionTokens: 4096, // Inferred from Llama 3 models in the original code
  //   interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json], // Inferred from Llama 3 models
  // },
  // {
  //   id: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
  //   label: 'Meta-Llama 3.1 · 70B Instruct',
  //   description: 'Meta-Llama 3.1 70B Instruct model',
  //   contextWindow: 128000, // Inferred from Llama 3 models in the original code
  //   maxCompletionTokens: 4096, // Inferred from Llama 3 models in the original code
  //   interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json], // Inferred from Llama 3 models
  // },
  // {
  //   id: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
  //   label: 'Mixtral · 8x7B Instruct v0.1',
  //   description: 'Mixtral 8x7B Instruct v0.1 model',
  //   contextWindow: 32768, // Inferred from Mixtral model in the original code
  //   interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn], // Inferred from Mixtral model
  // },

];
const openPipeModelFamilyOrder = [
  'gpt-4o', 'gpt-3.5-turbo', 'mistral-ft', 'meta-llama', 'mistralai', '',
];

export function openPipeModelDescriptions() {
  return _knownOpenPipeChatModels;
}

export function openPipeModelSort(a: ModelDescriptionSchema, b: ModelDescriptionSchema): number {
  const aPrefixIndex = openPipeModelFamilyOrder.findIndex(prefix => a.id.startsWith(prefix));
  const bPrefixIndex = openPipeModelFamilyOrder.findIndex(prefix => b.id.startsWith(prefix));
  // Sort by family
  if (aPrefixIndex !== bPrefixIndex)
    return aPrefixIndex - bPrefixIndex;
  // Then by reverse label (newer versions first)
  return b.label.localeCompare(a.label);
}

export function openPipeModelToModelDescriptions(wireModel: object): ModelDescriptionSchema {
  // parse the model
  const model = wireOpenPipeModelOutputSchema.parse(wireModel);

  // note: model.id is a UUID, but when making the requests, this is the id we use
  const namedId = `openpipe:${model.name}`;

  // parse the ISO strings
  let created: number | undefined;
  let updated: number | undefined;
  try {
    created = Date.parse(model.created) || undefined;
    updated = Date.parse(model.updated) || undefined;
  } catch (e) {
    // .. prevent issues
  }

  // patch label and description based on the `.openpipe` field
  let label = 'OpenPipe · ' + model.name;
  let description = model.description || 'Fine-tuned model.';
  switch (model.openpipe?.status) {
    case 'PENDING':
      label = `🟦 ${label} (PENDING)`;
      break;
    case 'TRAINING':
      label = `🟦 ${label} (TRAINING)`;
      break;
    case 'DEPLOYED':
      label = `🟩 ${label}`;
      break;
    case 'ERROR':
      label = `🟥 ${label} (ERROR)`;
      break;
    case 'DEPRECATED':
      label = `🟨 ${label} (DEPRECATED)`;
      break;
  }

  if (model.openpipe?.baseModel)
    description += `\n\nBased on: ${model.openpipe.baseModel}`;
  if (model.openpipe?.datasetId)
    description += `\nDataset Id: ${model.openpipe.datasetId}`;
  if (model.openpipe?.errorMessage)
    description += `\n\nError: ${model.openpipe.errorMessage}\n`;
  description += `\n\nUUID: ${model.id}`;


  const manualMapping: ManualMapping = {
    idPrefix: namedId,
    label,
    description,
    contextWindow: model.contextWindow,
    maxCompletionTokens: model.maxCompletionTokens,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
  };

  if (model.pricing) {
    manualMapping.chatPrice = {
      input: model.pricing.chatIn,
      output: model.pricing.chatOut,
    };
  }

  return fromManualMapping([], namedId, created, updated, manualMapping);
}