import { SERVER_DEBUG_WIRE } from '~/server/wire';

import { LLM_IF_OAI_Chat, LLM_IF_OAI_Complete, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision } from '../../../store-llms';

import type { ModelDescriptionSchema } from '../server.schemas';
import { wireMistralModelsListOutputSchema } from './mistral.wiretypes';


// [Azure] / [OpenAI]
const _knownOpenAIChatModels: ManualMappings = [
  // GPT4 Turbo
  {
    idPrefix: 'gpt-4-1106-preview',
    label: '4-Turbo (1106)',
    description: '128k context, fresher knowledge, cheaper than GPT-4.',
    contextWindow: 128000,
    maxCompletionTokens: 4096,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    latest: true,
  },
  {
    idPrefix: 'gpt-4-vision-preview',
    label: '4-Turbo (Vision)',
    description: 'Vision support, 128k context, fresher knowledge, cheaper than GPT-4.',
    contextWindow: 128000,
    maxCompletionTokens: 4096,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision],
    latest: true,
    hidden: true,
  },

  // GPT4-32k's
  {
    idPrefix: 'gpt-4-32k-0314',
    label: 'GPT-4-32k (0314)',
    description: 'Snapshot of gpt-4-32 from March 14th 2023. Will be deprecated on June 13th 2024 at the earliest.',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat],
    hidden: true,
  },
  {
    idPrefix: 'gpt-4-32k-0613',
    label: 'GPT-4-32k (0613)',
    description: 'Snapshot of gpt-4-32 from June 13th 2023.',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'gpt-4-32k',
    label: 'GPT-4-32k',
    description: 'Largest context window for big problems',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat],
  },

  // GPT4's
  {
    idPrefix: 'gpt-4-0613',
    label: 'GPT-4 (0613)',
    description: 'Snapshot of gpt-4 from June 13th 2023 with function calling data.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  },
  {
    idPrefix: 'gpt-4-0314',
    label: 'GPT-4 (0314)',
    description: 'Snapshot of gpt-4 from March 14th 2023 with function calling data.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    hidden: true,
  },
  {
    idPrefix: 'gpt-4',
    label: 'GPT-4',
    description: 'Insightful, big thinker, slower, pricey',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat],
    hidden: true,
  },


  // 3.5-Turbo-16k's
  {
    idPrefix: 'gpt-3.5-turbo-1106',
    label: '3.5-Turbo-16k (1106)',
    description: 'Snapshot of gpt-3.5-turbo-16k from November 6th 2023.',
    contextWindow: 16385,
    maxCompletionTokens: 4096,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    latest: true,
  },
  {
    idPrefix: 'gpt-3.5-turbo-16k-0613',
    label: '3.5-Turbo-16k (0613)',
    description: 'Snapshot of gpt-3.5-turbo-16k from June 13th 2023.',
    contextWindow: 16385,
    interfaces: [LLM_IF_OAI_Chat],
    hidden: true,
  },
  {
    idPrefix: 'gpt-3.5-turbo-16k',
    label: '3.5-Turbo-16k',
    description: 'Same capabilities as the standard gpt-3.5-turbo model but with 4 times the context.',
    contextWindow: 16385,
    interfaces: [LLM_IF_OAI_Chat],
    hidden: true,
  },

  // 3.5-Turbo-Instruct
  {
    idPrefix: 'gpt-3.5-turbo-instruct',
    label: '3.5-Turbo-Instruct',
    description: 'Not for chat.',
    contextWindow: 4097,
    interfaces: [LLM_IF_OAI_Complete],
    hidden: true,
  },

  // 3.5-Turbo's
  {
    idPrefix: 'gpt-3.5-turbo-0301',
    label: '3.5-Turbo (0301)',
    description: 'Snapshot of gpt-3.5-turbo from March 1st 2023. Will be deprecated on June 13th 2024 at the earliest.',
    contextWindow: 4097,
    hidden: true,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'gpt-3.5-turbo-0613',
    label: '3.5-Turbo (0613)',
    description: 'Snapshot of gpt-3.5-turbo from June 13th 2023 with function calling data.',
    contextWindow: 4097,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    hidden: true,
  },
  {
    idPrefix: 'gpt-3.5-turbo',
    label: '3.5-Turbo',
    description: 'Fair speed and smarts.',
    contextWindow: 4097,
    hidden: true,
    interfaces: [LLM_IF_OAI_Chat],
  },


  // Azure variants - because someone forgot the dot
  {
    idPrefix: 'gpt-35-turbo-16k',
    label: '3.5-Turbo-16k',
    description: 'Fair speed and smarts, large context',
    contextWindow: 16384,
    interfaces: [LLM_IF_OAI_Chat], // as azure doesn't version model id's (in the deployments), let's assume no function calling
  },
  {
    idPrefix: 'gpt-35-turbo',
    label: '3.5-Turbo',
    contextWindow: 4097,
    description: 'Fair speed and smarts',
    interfaces: [LLM_IF_OAI_Chat], // as azure doesn't version model id's (in the deployments), let's assume no function calling
  },

  // Fallback - unknown
  {
    idPrefix: '',
    label: '?:',
    description: 'Unknown, please let us know the ID. Assuming a 4097 context window size and Chat capabilities.',
    contextWindow: 4097,
    interfaces: [LLM_IF_OAI_Chat],
    hidden: true,
  },
];

export function openAIModelToModelDescription(modelId: string, modelCreated: number, modelUpdated?: number): ModelDescriptionSchema {
  return fromManualMapping(_knownOpenAIChatModels, modelId, modelCreated, modelUpdated);
}


// [LocalAI]
const _knownLocalAIChatModels: ManualMappings = [
  {
    idPrefix: 'ggml-gpt4all-j',
    label: 'GPT4All-J',
    description: 'GPT4All-J on LocalAI',
    contextWindow: 2048,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'luna-ai-llama2',
    label: 'Luna AI Llama2 Uncensored',
    description: 'Luna AI Llama2 on LocalAI',
    contextWindow: 4096,
    interfaces: [LLM_IF_OAI_Chat],
  },
];

export function localAIModelToModelDescription(modelId: string): ModelDescriptionSchema {
  return fromManualMapping(_knownLocalAIChatModels, modelId, undefined, undefined, {
    idPrefix: modelId,
    label: modelId
      .replace('ggml-', '')
      .replace('.bin', '')
      .replaceAll('-', ' '),
    description: 'Unknown localAI model. Please update `models.data.ts` with this ID',
    contextWindow: 4096, // sensible default
    interfaces: [LLM_IF_OAI_Chat], // assume..
  });
}


// [Mistral]

const _knownMistralChatModels: ManualMappings = [
  {
    idPrefix: 'mistral-medium',
    label: 'Mistral Medium',
    description: 'Mistral internal prototype model.',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'mistral-small',
    label: 'Mistral Small',
    description: 'Higher reasoning capabilities and more capabilities (English, French, German, Italian, Spanish, and Code)',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'mistral-tiny',
    label: 'Mistral Tiny',
    description: 'Used for large batch processing tasks where cost is a significant factor but reasoning capabilities are not crucial',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'mistral-embed',
    label: 'Mistral Embed',
    description: 'Mistral Medium on Mistral',
    // output: 1024 dimensions
    maxCompletionTokens: 1024, // HACK - it's 1024 dimensions, but those are not 'completion tokens'
    contextWindow: 32768, // actually unknown, assumed from the other models
    interfaces: [],
    hidden: true,
  },
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
  if (a.hidden && !b.hidden)
    return 1;
  if (!a.hidden && b.hidden)
    return -1;
  return a.id.localeCompare(b.id);
}


// [Oobabooga]
const _knownOobaboogaChatModels: ManualMappings = [];

const _knownOobaboogaNonChatModels: string[] = [
  'None', 'text-curie-001', 'text-davinci-002', 'all-mpnet-base-v2', 'text-embedding-ada-002',
  /* 'gpt-3.5-turbo' // used to be here, but now it's the way to select the activly loaded ooababooga model */
];

export function oobaboogaModelToModelDescription(modelId: string, created: number): ModelDescriptionSchema {
  let label = modelId.replaceAll(/[_-]/g, ' ').split(' ').map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
  if (label.endsWith('.bin'))
    label = label.slice(0, -4);

  // special case for the default (and only 'chat') model
  if (modelId === 'gpt-3.5-turbo')
    label = 'Oobabooga Model';

  return fromManualMapping(_knownOobaboogaChatModels, modelId, created, undefined, {
    idPrefix: modelId,
    label: label,
    description: 'Oobabooga model',
    contextWindow: 4096, // FIXME: figure out how to the context window size from Oobabooga
    interfaces: [LLM_IF_OAI_Chat], // assume..
    hidden: _knownOobaboogaNonChatModels.includes(modelId),
  });
}


// [OpenRouter]

/**
 * Created to reflect the doc page: https://openrouter.ai/docs
 *
 * Update prompt (last updated 2023-12-12)
 *   "Please update the following typescript object (do not change the definition, just values, and do not miss any rows), based on the information provided thereafter:"
 *
 * fields:
 *  - cw: context window size (max tokens, total)
 *  - cp: cost per 1k prompt tokens
 *  - cc: cost per 1k completion tokens
 *  - old: if true, this is an older model that has been superseded by a newer one
 */
const orModelMap: { [id: string]: { name: string; cw: number; cp?: number; cc?: number; old?: boolean; unfilt?: boolean; } } = {
  // 'openrouter/auto': { name: 'Auto (best for prompt)', cw: 128000, cp: undefined, cc: undefined, unfilt: undefined },
  'nousresearch/nous-capybara-7b': { name: 'Nous: Capybara 7B', cw: 4096, cp: 0, cc: 0, unfilt: true },
  'mistralai/mistral-7b-instruct': { name: 'Mistral 7B Instruct', cw: 8192, cp: 0, cc: 0, unfilt: true },
  'huggingfaceh4/zephyr-7b-beta': { name: 'Hugging Face: Zephyr 7B', cw: 4096, cp: 0, cc: 0, unfilt: true },
  'openchat/openchat-7b': { name: 'OpenChat 3.5', cw: 8192, cp: 0, cc: 0, unfilt: true },
  'gryphe/mythomist-7b': { name: 'MythoMist 7B', cw: 32768, cp: 0, cc: 0, unfilt: true },
  'openrouter/cinematika-7b': { name: 'Cinematika 7B (alpha)', cw: 32000, cp: 0, cc: 0, unfilt: true },
  'mistralai/mixtral-8x7b-instruct': { name: 'Mistral: Mixtral 8x7B Instruct (beta)', cw: 32000, cp: 0, cc: 0, unfilt: true },
  'rwkv/rwkv-5-world-3b': { name: 'RWKV v5 World 3B (beta)', cw: 10000, cp: 0, cc: 0, unfilt: true },
  'recursal/rwkv-5-3b-ai-town': { name: 'RWKV v5 3B AI Town (beta)', cw: 10000, cp: 0, cc: 0, unfilt: true },
  'jebcarter/psyfighter-13b': { name: 'Psyfighter 13B', cw: 4096, cp: 0.001, cc: 0.001, unfilt: true },
  'koboldai/psyfighter-13b-2': { name: 'Psyfighter v2 13B', cw: 4096, cp: 0.001, cc: 0.001, unfilt: true },
  'nousresearch/nous-hermes-llama2-13b': { name: 'Nous: Hermes 13B', cw: 4096, cp: 0.000075, cc: 0.000075, unfilt: true },
  'meta-llama/codellama-34b-instruct': { name: 'Meta: CodeLlama 34B Instruct', cw: 8192, cp: 0.0002, cc: 0.0002, unfilt: true },
  'phind/phind-codellama-34b': { name: 'Phind: CodeLlama 34B v2', cw: 4096, cp: 0.0002, cc: 0.0002, unfilt: true },
  'intel/neural-chat-7b': { name: 'Neural Chat 7B v3.1', cw: 4096, cp: 0.0025, cc: 0.0025, unfilt: true },
  'haotian-liu/llava-13b': { name: 'Llava 13B', cw: 2048, cp: 0.0025, cc: 0.0025, unfilt: true },
  'nousresearch/nous-hermes-2-vision-7b': { name: 'Nous: Hermes 2 Vision 7B (alpha)', cw: 4096, cp: 0.0025, cc: 0.0025, unfilt: true },
  'meta-llama/llama-2-13b-chat': { name: 'Meta: Llama v2 13B Chat', cw: 4096, cp: 0.000156755, cc: 0.000156755, unfilt: true },
  'openai/gpt-3.5-turbo': { name: 'OpenAI: GPT-3.5 Turbo', cw: 4095, cp: 0.001, cc: 0.002, unfilt: false },
  'openai/gpt-3.5-turbo-1106': { name: 'OpenAI: GPT-3.5 Turbo 16k (preview)', cw: 16385, cp: 0.001, cc: 0.002, unfilt: false },
  'openai/gpt-3.5-turbo-16k': { name: 'OpenAI: GPT-3.5 Turbo 16k', cw: 16385, cp: 0.003, cc: 0.004, unfilt: false },
  'openai/gpt-4-1106-preview': { name: 'OpenAI: GPT-4 Turbo (preview)', cw: 128000, cp: 0.01, cc: 0.03, unfilt: false },
  'openai/gpt-4': { name: 'OpenAI: GPT-4', cw: 8191, cp: 0.03, cc: 0.06, unfilt: false },
  'openai/gpt-4-32k': { name: 'OpenAI: GPT-4 32k', cw: 32767, cp: 0.06, cc: 0.12, unfilt: false },
  'openai/gpt-4-vision-preview': { name: 'OpenAI: GPT-4 Vision (preview)', cw: 128000, cp: 0.01, cc: 0.03, unfilt: false },
  'openai/gpt-3.5-turbo-instruct': { name: 'OpenAI: GPT-3.5 Turbo Instruct', cw: 4095, cp: 0.0015, cc: 0.002, unfilt: false },
  'google/palm-2-chat-bison': { name: 'Google: PaLM 2 Chat', cw: 9216, cp: 0.0005, cc: 0.0005, unfilt: true },
  'google/palm-2-codechat-bison': { name: 'Google: PaLM 2 Code Chat', cw: 7168, cp: 0.0005, cc: 0.0005, unfilt: true },
  'google/palm-2-chat-bison-32k': { name: 'Google: PaLM 2 Chat 32k', cw: 32000, cp: 0.0005, cc: 0.0005, unfilt: true },
  'google/palm-2-codechat-bison-32k': { name: 'Google: PaLM 2 Code Chat 32k', cw: 32000, cp: 0.0005, cc: 0.0005, unfilt: true },
  'perplexity/pplx-70b-online': { name: 'Perplexity: PPLX 70B Online', cw: 4096, cp: 0, cc: 0.0028, unfilt: true },
  'perplexity/pplx-7b-online': { name: 'Perplexity: PPLX 7B Online', cw: 4096, cp: 0, cc: 0.00028, unfilt: true },
  'perplexity/pplx-7b-chat': { name: 'Perplexity: PPLX 7B Chat', cw: 8192, cp: 0.00007, cc: 0.00028, unfilt: true },
  'perplexity/pplx-70b-chat': { name: 'Perplexity: PPLX 70B Chat', cw: 4096, cp: 0.0007, cc: 0.0028, unfilt: true },
  'meta-llama/llama-2-70b-chat': { name: 'Meta: Llama v2 70B Chat', cw: 4096, cp: 0.0007, cc: 0.00095, unfilt: true },
  'nousresearch/nous-hermes-llama2-70b': { name: 'Nous: Hermes 70B', cw: 4096, cp: 0.0009, cc: 0.0009, unfilt: true },
  'nousresearch/nous-capybara-34b': { name: 'Nous: Capybara 34B', cw: 32000, cp: 0.0007, cc: 0.0028, unfilt: true },
  'jondurbin/airoboros-l2-70b': { name: 'Airoboros 70B', cw: 4096, cp: 0.0007, cc: 0.00095, unfilt: true },
  'migtissera/synthia-70b': { name: 'Synthia 70B', cw: 8192, cp: 0.00375, cc: 0.00375, unfilt: true },
  'open-orca/mistral-7b-openorca': { name: 'Mistral OpenOrca 7B', cw: 8192, cp: 0.0002, cc: 0.0002, unfilt: true },
  'teknium/openhermes-2-mistral-7b': { name: 'OpenHermes 2 Mistral 7B', cw: 4096, cp: 0.0002, cc: 0.0002, unfilt: true },
  'teknium/openhermes-2.5-mistral-7b': { name: 'OpenHermes 2.5 Mistral 7B', cw: 4096, cp: 0.0002, cc: 0.0002, unfilt: true },
  'pygmalionai/mythalion-13b': { name: 'Pygmalion: Mythalion 13B', cw: 8192, cp: 0.001125, cc: 0.001125, unfilt: true },
  'undi95/remm-slerp-l2-13b': { name: 'ReMM SLERP 13B', cw: 6144, cp: 0.001125, cc: 0.001125, unfilt: true },
  'xwin-lm/xwin-lm-70b': { name: 'Xwin 70B', cw: 8192, cp: 0.00375, cc: 0.00375, unfilt: true },
  'gryphe/mythomax-l2-13b-8k': { name: 'MythoMax 13B 8k', cw: 8192, cp: 0.001125, cc: 0.001125, unfilt: true },
  'undi95/toppy-m-7b': { name: 'Toppy M 7B', cw: 32768, cp: 0.000375, cc: 0.000375, unfilt: true },
  'alpindale/goliath-120b': { name: 'Goliath 120B', cw: 6144, cp: 0.009375, cc: 0.009375, unfilt: true },
  'lizpreciatior/lzlv-70b-fp16-hf': { name: 'lzlv 70B', cw: 4096, cp: 0.0007, cc: 0.00095, unfilt: true },
  'neversleep/noromaid-20b': { name: 'Noromaid 20B', cw: 8192, cp: 0.00225, cc: 0.00225, unfilt: true },
  '01-ai/yi-34b-chat': { name: 'Yi 34B Chat', cw: 4096, cp: 0.0008, cc: 0.0008, unfilt: true },
  '01-ai/yi-34b': { name: 'Yi 34B (base)', cw: 4096, cp: 0.0008, cc: 0.0008, unfilt: true },
  '01-ai/yi-6b': { name: 'Yi 6B (base)', cw: 4096, cp: 0.00014, cc: 0.00014, unfilt: true },
  'togethercomputer/stripedhyena-nous-7b': { name: 'StripedHyena Nous 7B', cw: 32000, cp: 0.0002, cc: 0.0002, unfilt: true },
  'togethercomputer/stripedhyena-hessian-7b': { name: 'StripedHyena Hessian 7B (base)', cw: 32000, cp: 0.0002, cc: 0.0002, unfilt: true },
  'mistralai/mixtral-8x7b': { name: 'Mistral: Mixtral 8x7B (base) (beta)', cw: 32000, cp: 0.0006, cc: 0.0006, unfilt: true },
  'anthropic/claude-2': { name: 'Anthropic: Claude v2.1', cw: 200000, cp: 0.008, cc: 0.024, unfilt: false },
  'anthropic/claude-2.0': { name: 'Anthropic: Claude v2.0', cw: 100000, cp: 0.008, cc: 0.024, unfilt: false },
  'anthropic/claude-instant-v1': { name: 'Anthropic: Claude Instant v1', cw: 100000, cp: 0.00163, cc: 0.00551, unfilt: false },
  'mancer/weaver': { name: 'Mancer: Weaver (alpha)', cw: 8000, cp: 0.003375, cc: 0.003375, unfilt: true },
  'gryphe/mythomax-l2-13b': { name: 'MythoMax 13B', cw: 4096, cp: 0.0006, cc: 0.0006, unfilt: true },
  // Old models (maintained for reference)
  'openai/gpt-3.5-turbo-0301': { name: 'OpenAI: GPT-3.5 Turbo (older v0301)', cw: 4095, cp: 0.001, cc: 0.002, old: true },
  'openai/gpt-4-0314': { name: 'OpenAI: GPT-4 (older v0314)', cw: 8191, cp: 0.03, cc: 0.06, old: true },
  'openai/gpt-4-32k-0314': { name: 'OpenAI: GPT-4 32k (older v0314)', cw: 32767, cp: 0.06, cc: 0.12, old: true },
  'openai/text-davinci-002': { name: 'OpenAI: Davinci 2', cw: 4095, cp: 0.02, cc: 0.02, old: true },
  'anthropic/claude-v1': { name: 'Anthropic: Claude v1', cw: 9000, cp: 0.008, cc: 0.024, old: true },
  'anthropic/claude-1.2': { name: 'Anthropic: Claude (older v1)', cw: 9000, cp: 0.008, cc: 0.024, old: true },
  'anthropic/claude-instant-v1-100k': { name: 'Anthropic: Claude Instant 100k v1', cw: 100000, cp: 0.00163, cc: 0.00551, old: true },
  'anthropic/claude-v1-100k': { name: 'Anthropic: Claude 100k v1', cw: 100000, cp: 0.008, cc: 0.024, old: true },
  'anthropic/claude-instant-1.0': { name: 'Anthropic: Claude Instant (older v1)', cw: 9000, cp: 0.00163, cc: 0.00551, old: true },
};

const orModelFamilyOrder = [
  // great models
  'mistralai/mixtral-8x7b-instruct', 'mistralai/mistral-7b-instruct', 'nousresearch/nous-capybara-7b',
  // great orgs
  'huggingfaceh4/', 'openchat/', 'anthropic/', 'google/', 'openai/', 'meta-llama/', 'phind/',
];

export function openRouterModelFamilySortFn(a: { id: string }, b: { id: string }): number {
  const aPrefixIndex = orModelFamilyOrder.findIndex(prefix => a.id.startsWith(prefix));
  const bPrefixIndex = orModelFamilyOrder.findIndex(prefix => b.id.startsWith(prefix));

  // If both have a prefix, sort by prefix first, and then alphabetically
  if (aPrefixIndex !== -1 && bPrefixIndex !== -1)
    return aPrefixIndex !== bPrefixIndex ? aPrefixIndex - bPrefixIndex : a.id.localeCompare(b.id);

  // If one has a prefix and the other doesn't, prioritize the one with prefix
  return aPrefixIndex !== -1 ? -1 : 1;
}

export function openRouterModelToModelDescription(modelId: string, created: number, context_length?: number): ModelDescriptionSchema {

  // label: use the known name if available, otherwise format the model id
  const orModel = orModelMap[modelId] ?? null;
  let label = orModel?.name || modelId.replace('/', ' · ');
  if (orModel?.cp === 0 && orModel?.cc === 0)
    label += ' · 🎁'; // Free? Discounted?

  if (SERVER_DEBUG_WIRE && !orModel)
    console.log(' - openRouterModelToModelDescription: non-mapped model id:', modelId);

  // context: use the known size if available, otherwise fallback to the (undocumneted) provided length or fallback again to 4096
  const contextWindow = orModel?.cw || context_length || 4096;

  // hidden: hide by default older models or models not in known families
  const hidden = orModel?.old || !orModelFamilyOrder.some(prefix => modelId.startsWith(prefix));

  return fromManualMapping([], modelId, created, undefined, {
    idPrefix: modelId,
    label,
    description: 'OpenRouter model',
    contextWindow,
    interfaces: [LLM_IF_OAI_Chat],
    hidden,
  });
}


// Helpers

type ManualMappings = ManualMapping[];
type ManualMapping = ({ idPrefix: string, latest?: boolean } & Omit<ModelDescriptionSchema, 'id' | 'created' | 'updated'>);

function fromManualMapping(mappings: ManualMappings, id: string, created?: number, updated?: number, fallback?: ManualMapping): ModelDescriptionSchema {

  // find the closest known model, or fall back, or take the last
  const known = mappings.find(base => id.startsWith(base.idPrefix)) || fallback || mappings[mappings.length - 1];

  // check whether this is a partial map, which indicates an unknown/new variant
  const suffix = id.slice(known.idPrefix.length).trim();

  // return the model description sheet
  return {
    id,
    label: (known.latest ? '🌟 ' : '') + known.label + (suffix ? ` [${suffix.replaceAll('-', ' ').trim()}]` : ''),
    created: created || 0,
    updated: updated || created || 0,
    description: known.description,
    contextWindow: known.contextWindow,
    ...(!!known.maxCompletionTokens && { maxCompletionTokens: known.maxCompletionTokens }),
    interfaces: known.interfaces,
    ...(!!known.hidden && { hidden: known.hidden }),
  };
}