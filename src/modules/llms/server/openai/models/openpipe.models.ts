import type { ModelDescriptionSchema } from '~/modules/llms/server/llm.server.types';
import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';
import { _knownOpenAIChatModels } from '~/modules/llms/server/openai/models/openai.models';
import { wireOpenPipeModelOutputSchema } from '~/modules/llms/server/openai/wiretypes/openpipe.wiretypes';
import { fromManualMapping, KnownModel } from '~/modules/llms/server/models.mappings';

const _knownOpenPipeChatModels: ModelDescriptionSchema[] = [

  /* OpenPipe models - by default it's OpenAI models, through the proxy service. */

  // OpenAI models: pass-through at standard OpenAI rates
  {
    id: 'gpt-4o-mini-2024-07-18',
    label: '💾➜ GPT-4o Mini (2024-07-18)',
    description: 'Affordable model for fast, lightweight tasks. GPT-4o mini is cheaper and more capable than GPT-3.5 Turbo.',
    contextWindow: 128000,
    maxCompletionTokens: 16384,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: _knownOpenAIChatModels.find(m => m.idPrefix === 'gpt-4o-mini-2024-07-18')?.chatPrice,
  },
  {
    id: 'gpt-4o-2024-08-06',
    label: '💾➜ GPT-4o (2024-08-06)',
    description: 'Advanced, multimodal flagship model that\'s cheaper and faster than GPT-4 Turbo.',
    contextWindow: 128000,
    maxCompletionTokens: 16384,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: _knownOpenAIChatModels.find(m => m.idPrefix === 'gpt-4o-2024-08-06')?.chatPrice,
    benchmark: { cbaElo: 1287 },
  },
  {
    id: 'gpt-3.5-turbo-0125',
    label: '💾➜ GPT-3.5 Turbo (0125)',
    description: 'The latest GPT-3.5 Turbo model with higher accuracy at responding in requested formats',
    contextWindow: 16385,
    maxCompletionTokens: 4096,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: _knownOpenAIChatModels.find(m => m.idPrefix === 'gpt-3.5-turbo-0125')?.chatPrice,
    benchmark: { cbaElo: 1105 },
  },

  // Google Gemini models: pass-through at standard Google rates
  {
    id: 'gemini-1.0-pro-001',
    label: '💾➜ Gemini 1.0 Pro',
    description: 'Google\'s Gemini 1.0 Pro model',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  },
  {
    id: 'gemini-1.5-flash-001',
    label: '💾➜ Gemini 1.5 Flash',
    description: 'Google\'s Gemini 1.5 Flash model - fast and efficient',
    contextWindow: 1000000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn],
  },

  // Hosted inference models with OpenPipe pricing - Llama 3.1 series
  {
    id: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
    label: '💾 Llama 3.1 · 8B Instruct',
    description: 'Meta Llama 3.1 8B Instruct - hosted inference with per-token pricing',
    contextWindow: 128000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: { input: 0.30, output: 0.45 },
  },
  {
    id: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
    label: '💾 Llama 3.1 · 70B Instruct',
    description: 'Meta Llama 3.1 70B Instruct - hosted inference with per-token pricing',
    contextWindow: 128000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: { input: 1.80, output: 2.00 },
  },
  {
    id: 'meta-llama/Llama-3.1-8B',
    label: '💾 Llama 3.1 · 8B Base',
    description: 'Meta Llama 3.1 8B base model for fine-tuning',
    contextWindow: 128000,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    id: 'meta-llama/Llama-3.1-70B',
    label: '💾 Llama 3.1 · 70B Base',
    description: 'Meta Llama 3.1 70B base model for fine-tuning',
    contextWindow: 128000,
    interfaces: [LLM_IF_OAI_Chat],
  },

  // Hosted inference models - Llama 3.2 series
  {
    id: 'meta-llama/Llama-3.2-1B-Instruct',
    label: '💾 Llama 3.2 · 1B Instruct',
    description: 'Meta Llama 3.2 1B Instruct - lightweight model for edge and mobile deployment',
    contextWindow: 128000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
  },
  {
    id: 'meta-llama/Llama-3.2-3B-Instruct',
    label: '💾 Llama 3.2 · 3B Instruct',
    description: 'Meta Llama 3.2 3B Instruct - efficient model for edge deployment',
    contextWindow: 128000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
  },

  // Hosted inference models - Llama 3.3 series
  {
    id: 'meta-llama/Llama-3.3-70B-Instruct',
    label: '💾 Llama 3.3 · 70B Instruct',
    description: 'Meta Llama 3.3 70B Instruct - latest 70B model with performance comparable to Llama 3.1 405B',
    contextWindow: 128000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
  },

  // Hosted inference models - Qwen 2.5 series
  {
    id: 'Qwen/Qwen2.5-1.5B-Instruct',
    label: '💾 Qwen 2.5 · 1.5B Instruct',
    description: 'Alibaba Qwen 2.5 1.5B Instruct - efficient small model',
    contextWindow: 131072,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
  },
  {
    id: 'Qwen/Qwen2.5-7B-Instruct',
    label: '💾 Qwen 2.5 · 7B Instruct',
    description: 'Alibaba Qwen 2.5 7B Instruct - balanced performance and efficiency',
    contextWindow: 131072,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
  },
  {
    id: 'Qwen/Qwen2.5-14B-Instruct',
    label: '💾 Qwen 2.5 · 14B Instruct',
    description: 'Alibaba Qwen 2.5 14B Instruct - hosted inference with per-token pricing',
    contextWindow: 131072,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: { input: 1.00, output: 1.50 },
  },
  {
    id: 'Qwen/Qwen2.5-72B-Instruct',
    label: '💾 Qwen 2.5 · 72B Instruct',
    description: 'Alibaba Qwen 2.5 72B Instruct - flagship model with performance comparable to Llama 3.1 405B',
    contextWindow: 131072,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
  },
  {
    id: 'Qwen/Qwen2.5-Coder-32B-Instruct',
    label: '💾 Qwen 2.5 · Coder 32B Instruct',
    description: 'Alibaba Qwen 2.5 Coder 32B Instruct - specialized for code generation and understanding',
    contextWindow: 131072,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
  },

  // Hosted inference models - Mistral series
  {
    id: 'mistralai/Mistral-Nemo-Base-2407',
    label: '💾 Mistral Nemo · Base',
    description: 'Mistral Nemo 12B base model (July 2024) for fine-tuning',
    contextWindow: 128000,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    id: 'mistralai/Mistral-Small-24B-Base-2501',
    label: '💾 Mistral Small · 24B Base',
    description: 'Mistral Small 24B base model (Jan 2025) - competitive with larger models while faster',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat],
  },

];
const openPipeModelFamilyOrder = [
  'gpt-4o', 'gpt-3.5-turbo', 'gemini', 'meta-llama/Llama-3.3', 'meta-llama/Llama-3.2', 'meta-llama/Meta-Llama-3.1', 'meta-llama/Llama-3.1', 'meta-llama', 'Qwen', 'mistralai', '',
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


  const manualMapping: KnownModel = {
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