import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import { fromManualMapping, ManualMappings } from './models.data';
import type { ModelDescriptionSchema } from '../../llm.server.types';
import { wireMistralModelsListOutputSchema } from '../mistral.wiretypes';


// [Mistral]
// updated from the models on: https://docs.mistral.ai/getting-started/models/
// and the pricing available on: https://mistral.ai/technology/#pricing

const _knownMistralChatModels: ManualMappings = [
  // Premier models

  // Mistral Large 24.11
  {
    idPrefix: 'mistral-large-2411',
    label: 'Mistral Large (24.11)',
    description: 'Top-tier reasoning for high-complexity tasks and sophisticated problems.',
    contextWindow: 131 * 1024, // 131K tokens
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 2, output: 6 },
    benchmark: { cbaElo: 1248 },
  },
  {
    isLegacy: true,
    hidden: true,
    idPrefix: 'mistral-large-2407',
    label: 'Mistral Large (24.07)',
    description: 'Our top-tier reasoning model for high-complexity tasks with the second version released July 2024. Learn more on our blog post',
    contextWindow: 131072,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 2, output: 6 },
    benchmark: { cbaElo: 1251 },
  },
  {
    isLegacy: true,
    hidden: true,
    idPrefix: 'mistral-large-2402',
    label: 'Mistral Large (24.02)',
    description: 'Our top-tier reasoning model for high-complexity tasks with the first version released Feb. 2024. Learn more on our blog post',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 2, output: 6 },
    benchmark: { cbaElo: 1157 },
  },
  {
    hidden: true,
    idPrefix: 'mistral-large-latest',
    label: 'Mistral Large (latest)',
    symLink: 'mistral-large-2411',
    // Copied details from 24.11
    description: 'Top-tier reasoning for high-complexity tasks and sophisticated problems.',
    contextWindow: 131 * 1024, // 131K tokens
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 2, output: 6 },
    benchmark: { cbaElo: 1248 },
  },


  // Pixtral Large
  {
    idPrefix: 'pixtral-large-2411',
    label: 'Pixtral Large (24.11)',
    description: 'Vision-capable large model with frontier reasoning capabilities.',
    contextWindow: 131 * 1024, // 131K tokens
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision],
    chatPrice: { input: 2, output: 6 },
  },
  {
    hidden: true,
    idPrefix: 'pixtral-large-latest',
    label: 'Pixtral Large (latest)',
    symLink: 'pixtral-large-2411',
    // Copied details from 24.11
    description: 'Vision-capable large model with frontier reasoning capabilities.',
    contextWindow: 131 * 1024, // 131K tokens
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision],
    chatPrice: { input: 2, output: 6 },
  },


  // Mistral Small 25.01
  {
    idPrefix: 'mistral-small-2501',
    label: 'Mistral Small (25.01)',
    description: 'Cost-efficient, fast, and reliable option for use cases such as translation, summarization, and sentiment analysis. A new leader in the small models category with the latest version v3 released January 2025.',
    contextWindow: 32 * 1024, // 32K tokens
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 0.1, output: 0.3 },
    benchmark: { cbaElo: 1216 },
  },
  {
    // isLegacy: true,
    hidden: true,
    idPrefix: 'mistral-small-2409',
    label: 'Mistral Small (24.09)',
    description: 'A new leader in the small models category. Cost-efficient, fast, and reliable option for use cases such as translation, summarization, and sentiment analysis.', // old description, keeping for legacy
    contextWindow: 131072, // Old value, doc says 32k now for small
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 0.1, output: 0.3 },
  },
  {
    isLegacy: true,
    hidden: true,
    idPrefix: 'mistral-small-2402',
    label: 'Mistral Small (24.02)',
    description: '',
    contextWindow: 32 * 1024, // 32K tokens
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    isLegacy: true,
    hidden: true,
    idPrefix: 'mistral-small-2312',
    label: 'Mistral Small (23.12)',
    description: '',
    contextWindow: 32 * 1024, // 32K tokens
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    hidden: true,
    idPrefix: 'mistral-small-latest',
    label: 'Mistral Small (latest)',
    symLink: 'mistral-small-2501',
    // Copied details from 25.01
    description: 'Cost-efficient, fast, and reliable option for use cases such as translation, summarization, and sentiment analysis. A new leader in the small models category with the latest version v3 released January 2025.',
    contextWindow: 32 * 1024, // 32K tokens
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 0.1, output: 0.3 },
  },
  {
    isLegacy: true,
    hidden: true,
    idPrefix: 'mistral-small',
    label: 'Mistral Small',
    symLink: 'mistral-small-latest',
    // Copied details from small-latest
    description: 'Cost-efficient, fast, and reliable option for use cases such as translation, summarization, and sentiment analysis. A new leader in the small models category with the latest version v3 released January 2025.',
    contextWindow: 32 * 1024, // 32K tokens
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 0.1, output: 0.3 },
  },

  // Codestral
  {
    idPrefix: 'codestral-2501',
    label: 'Codestral (25.01)',
    description: 'State-of-the-art Mistral model trained specifically for code tasks with the second version released January 2025, Codestral specializes in low-latency, high-frequency tasks such as fill-in-the-middle (FIM), code correction and test generation.',
    contextWindow: 256 * 1024, // 256K tokens
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 0.3, output: 0.9 },
  },
  {
    // isLegacy: true,
    hidden: true,
    idPrefix: 'codestral-2412',
    label: 'Codestral (24.12)',
    description: 'Our cutting-edge language model for coding with the first version released May 2024.',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 0.3, output: 0.9 },
  },
  {
    // isLegacy: true,
    hidden: true,
    idPrefix: 'codestral-2411-rc5',
    label: 'Codestral (24.11 RC5)',
    description: 'Our cutting-edge language model for coding with the first version released May 2024.',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 0.3, output: 0.9 },
  },
  {
    isLegacy: true,
    hidden: true,
    idPrefix: 'codestral-2405',
    label: 'Codestral (24.05)',
    description: 'Our cutting-edge language model for coding with the first version released May 2024.',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 0.3, output: 0.9 },
  },
  {
    hidden: true,
    idPrefix: 'codestral-latest',
    label: 'Codestral (latest)',
    symLink: 'codestral-2501',
    // Copied details from 25.01
    description: 'State-of-the-art Mistral model trained specifically for code tasks with the second version released January 2025, Codestral specializes in low-latency, high-frequency tasks such as fill-in-the-middle (FIM), code correction and test generation.',
    contextWindow: 256 * 1024, // 256K tokens
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 0.3, output: 0.9 },
  },

  // Ministral 8B 24.10
  {
    idPrefix: 'ministral-8b-2410',
    label: 'Ministral 8B (24.10)',
    description: 'Powerful edge model with extremely high performance/price ratio.',
    contextWindow: 131 * 1024, // 131K tokens
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 0.1, output: 0.1 },
  },
  {
    hidden: true,
    idPrefix: 'ministral-8b-latest',
    label: 'Ministral 8B (latest)',
    symLink: 'ministral-8b-2410',
    // Copied:
    description: 'Powerful edge model with extremely high performance/price ratio.',
    contextWindow: 131 * 1024, // 131K tokens
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 0.1, output: 0.1 },
  },

  // Ministral 3B 24.10
  {
    idPrefix: 'ministral-3b-2410',
    label: 'Ministral 3B (24.10)',
    description: 'World\'s best edge model.',
    contextWindow: 131 * 1024, // 131K tokens
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 0.04, output: 0.04 },
  },
  {
    hidden: true,
    idPrefix: 'ministral-3b-latest',
    label: 'Ministral 3B (latest)',
    symLink: 'ministral-3b-2410',
    // Copied:
    description: 'World\'s best edge model.',
    contextWindow: 131 * 1024, // 131K tokens
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 0.04, output: 0.04 },
  },

  // Mistral Embed
  {
    hidden: true, // Embedding model, thus hidden
    idPrefix: 'mistral-embed',
    label: 'Mistral Embed',
    description: 'State-of-the-art semantic for extracting representation of text extracts',
    contextWindow: 8 * 1024, // 8K tokens
    maxCompletionTokens: 8 * 1024,
    interfaces: [],
    chatPrice: { input: 0.1, output: 0 }, // $0.1 /1M tokens input, output not applicable
  },

  // Mistral Moderation 24.11
  {
    hidden: true, // Not a chat model
    idPrefix: 'mistral-moderation-2411',
    label: 'Mistral Moderation (24.11)',
    description: 'Our moderation service that enables our users to detect harmful text content',
    contextWindow: 8 * 1024, // 8K tokens
    interfaces: [], // Not a chat interface
    chatPrice: { input: 0.1, output: 0 }, // Assuming only input cost, like embedding
  },
  {
    hidden: true, // Not a chat model
    idPrefix: 'mistral-moderation-latest',
    label: 'Mistral Moderation (latest)',
    symLink: 'mistral-moderation-2411',
    // Copied:
    description: 'Our moderation service that enables our users to detect harmful text content',
    contextWindow: 8 * 1024, // 8K tokens
    interfaces: [], // Not a chat interface
    chatPrice: { input: 0.1, output: 0 }, // Assuming only input cost, like embedding
  },


  ///
  /// Downloadable models (they call them free, but they cost money on their API service)
  ///

  // Pixtral 12B
  {
    idPrefix: 'pixtral-12b-2409',
    label: 'Pixtral 12B (24.09)',
    description: 'Vision-capable small model.',
    contextWindow: 131 * 1024, // 131K tokens
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
    chatPrice: { input: 0.15, output: 0.15 },
  },
  {
    hidden: true,
    idPrefix: 'pixtral-12b-latest',
    label: 'Pixtral 12B (latest)',
    symLink: 'pixtral-12b-2409',
    // Copied details
    description: 'Vision-capable small model.',
    contextWindow: 131 * 1024, // 131K tokens
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
    chatPrice: { input: 0.15, output: 0.15 },
  },
  {
    isLegacy: true,
    hidden: true,
    idPrefix: 'pixtral-12b',
    label: 'Pixtral 12B',
    symLink: 'pixtral-12b-latest',
    // Copied details
    description: 'Vision-capable small model.',
    contextWindow: 131 * 1024, // 131K tokens
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
    chatPrice: { input: 0.15, output: 0.15 },
  },

  // Mistral Nemo
  {
    idPrefix: 'open-mistral-nemo-2407',
    label: 'Mistral NeMo (24.07)',
    description: 'State-of-the-art Mistral model built in collaboration with NVIDIA. The most powerful model in its size category. Multi-lingual (incl. European languages, Chinese, Japanese, Korean, Hindi, Arabic). Large context window of 128K tokens.',
    contextWindow: 131 * 1024, // 131K tokens - Doc and Tech page says 128k, using 131k for consistency
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 0.15, output: 0.15 },
  },
  {
    isLegacy: true,
    hidden: true,
    idPrefix: 'open-mistral-nemo', // XX
    label: 'Mistral NeMo',
    symLink: 'open-mistral-nemo-2407',
    // Copied details
    description: 'State-of-the-art Mistral model built in collaboration with NVIDIA. The most powerful model in its size category. Multi-lingual (incl. European languages, Chinese, Japanese, Korean, Hindi, Arabic). Large context window of 128K tokens.',
    contextWindow: 131 * 1024, // 131K tokens - Doc and Tech page says 128k, using 131k for consistency
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 0.15, output: 0.15 },
  },

  // Codestral Mamba
  {
    // hidden: true, // Research model
    idPrefix: 'codestral-mamba-2407',
    label: 'Codestral Mamba (24.07)',
    description: 'A Mamba2 language model designed for coding tasks.',
    contextWindow: 256 * 1024, // 256K tokens
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 0.3, output: 0.9 }, // Assuming same price as codestral-latest
  },
  {
    hidden: true,
    idPrefix: 'codestral-mamba-latest',
    label: 'Codestral Mamba (latest)',
    symLink: 'codestral-mamba-2407',
    // Copied details
    description: 'A Mamba2 language model designed for coding tasks.',
    contextWindow: 256 * 1024, // 256K tokens
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 0.3, output: 0.9 }, // Assuming same price as codestral-latest
  },
  {
    isLegacy: true, // Former name was Codestral Mamba
    hidden: true, // Research model
    idPrefix: 'open-codestral-mamba',
    label: 'Codestral Mamba',
    description: 'A Mamba2 language model designed for coding tasks.',
    contextWindow: 256 * 1024, // 256K tokens
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 0.3, output: 0.9 }, // Assuming same price as codestral-latest
  },


  // Legacy models - Deprecated and Retired on March 30, 2025

  // Mistral Medium
  {
    isLegacy: true,
    hidden: true,
    idPrefix: 'mistral-medium-2312',
    label: 'Mistral Medium (23.12)',
    description: 'Ideal for intermediate tasks that require moderate reasoning',
    contextWindow: 32 * 1024,
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 2.75, output: 8.1 },
    benchmark: { cbaElo: 1148 },
  },
  {
    isLegacy: true,
    hidden: true,
    idPrefix: 'mistral-medium-latest',
    label: 'Mistral Medium (latest)',
    symLink: 'mistral-medium-2312',
    // Copied details
    description: 'Ideal for intermediate tasks that require moderate reasoning',
    contextWindow: 32 * 1024,
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 2.75, output: 8.1 },
    benchmark: { cbaElo: 1148 },
  },
  {
    isLegacy: true,
    hidden: true,
    idPrefix: 'mistral-medium',
    label: 'Mistral Medium',
    symLink: 'mistral-medium-latest',
    // Copied details
    description: 'Ideal for intermediate tasks that require moderate reasoning',
    contextWindow: 32 * 1024,
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 2.75, output: 8.1 },
    benchmark: { cbaElo: 1148 },
  },

  // Mixtral 8x22B
  {
    isLegacy: true,
    hidden: true,
    idPrefix: 'open-mixtral-8x22b-2404',
    label: 'Mixtral 8x22B (24.04)',
    description: 'Mixtral 8x22B is currently the most performant open model.',
    contextWindow: 64 * 1024, // 64K tokens
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 2, output: 6 },
    benchmark: { cbaElo: 1147 },
  },
  {
    isLegacy: true,
    hidden: true,
    idPrefix: 'open-mixtral-8x22b',
    label: 'Mixtral 8x22B',
    symLink: 'open-mixtral-8x22b-2404',
    // Copied details
    description: 'Mixtral 8x22B is currently the most performant open model.',
    contextWindow: 64 * 1024, // 64K tokens
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 2, output: 6 },
    benchmark: { cbaElo: 1147 },
  },

  // Mixtral 8x7B
  {
    isLegacy: true,
    hidden: true,
    idPrefix: 'open-mixtral-8x7b',
    label: 'Mixtral 8x7B',
    description: 'A high-quality sparse mixture of experts (SMoE) with open weights. Matches or outperforms GPT3.5 on most standard benchmarks, particularly in multilingual capabilities and code.',
    contextWindow: 32 * 1024, // 32K tokens
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 0.7, output: 0.7 },
  },

  // Mistral 7B
  {
    isLegacy: true,
    hidden: true,
    idPrefix: 'open-mistral-7b',
    label: 'Mistral 7B',
    description: 'Our first dense model released September 2023.',
    contextWindow: 32 * 1024, // 32K tokens
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 0.25, output: 0.25 },
  },

  // Mistral Tiny
  {
    isLegacy: true,
    hidden: true,
    idPrefix: 'mistral-tiny-2407',
    label: 'Mistral Tiny (24.07)',
    description: 'Used for large batch processing tasks where cost is a significant factor but reasoning capabilities are not crucial.',
    contextWindow: 32 * 1024,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    isLegacy: true,
    hidden: true,
    idPrefix: 'mistral-tiny-2312',
    label: 'Mistral Tiny (23.12)',
    description: 'Used for large batch processing tasks where cost is a significant factor but reasoning capabilities are not crucial.',
    contextWindow: 32 * 1024,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    isLegacy: true,
    hidden: true,
    idPrefix: 'mistral-tiny-latest',
    label: 'Mistral Tiny (latest)',
    symLink: 'mistral-tiny-2407',
    // Copied details
    description: 'Used for large batch processing tasks where cost is a significant factor but reasoning capabilities are not crucial.',
    contextWindow: 32 * 1024,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    isLegacy: true,
    hidden: true,
    idPrefix: 'mistral-tiny',
    label: 'Mistral Tiny',
    symLink: 'mistral-tiny-latest',
    // Copied details
    description: 'Used for large batch processing tasks where cost is a significant factor but reasoning capabilities are not crucial.',
    contextWindow: 32 * 1024,
    interfaces: [LLM_IF_OAI_Chat],
  },

];

const mistralModelFamilyOrder = [
  // Premier
  'mistral-large',
  'pixtral-large',
  'mistral-small',
  'codestral-mamba',
  'open-codestral-mamba',
  'codestral',
  'ministral-8b',
  'ministral-3b',
  'mistral-embed',
  'mistral-moderation',
  // Downloadable
  'pixtral-12b',
  'open-mistral-nemo',
  'open-mixtral-8x22b',
  'open-mixtral-8x7b',
  'open-mistral-7b',
  // Deprecated
  'mistral-medium',
  'mistral-tiny',
  // Symlinks at the bottom
  '🔗',
];

export function mistralModelToModelDescription(_model: unknown): ModelDescriptionSchema {
  const model = wireMistralModelsListOutputSchema.parse(_model);
  return fromManualMapping(_knownMistralChatModels, model.id, model.created, undefined, {
    idPrefix: model.id,
    label: model.id.replaceAll(/[_-]/g, ' '),
    description: 'New Mistral Model',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat], // assume..
    hidden: true,
  });
}

export function mistralModelsSort(a: ModelDescriptionSchema, b: ModelDescriptionSchema): number {
  if (a.label.startsWith('🔗') && !b.label.startsWith('🔗')) return 1;
  if (!a.label.startsWith('🔗') && b.label.startsWith('🔗')) return -1;
  const aPrefixIndex = mistralModelFamilyOrder.findIndex(prefix => a.id.startsWith(prefix));
  const bPrefixIndex = mistralModelFamilyOrder.findIndex(prefix => b.id.startsWith(prefix));
  if (aPrefixIndex !== -1 && bPrefixIndex !== -1) {
    if (aPrefixIndex !== bPrefixIndex)
      return aPrefixIndex - bPrefixIndex;
    return b.label.localeCompare(a.label);
  }
  return aPrefixIndex !== -1 ? 1 : -1;
}
