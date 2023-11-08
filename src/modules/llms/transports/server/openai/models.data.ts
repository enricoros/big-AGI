import type { ModelDescriptionSchema } from '../server.schemas';
import { LLM_IF_OAI_Chat, LLM_IF_OAI_Complete, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision } from '../../../store-llms';


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


// [Oobabooga]
const _knownOobaboogaChatModels: ManualMappings = [];

const _knownOobaboogaNonChatModels: string[] = [
  'None', 'text-curie-001', 'text-davinci-002', 'all-mpnet-base-v2', 'gpt-3.5-turbo', 'text-embedding-ada-002',
];

export function oobaboogaModelToModelDescription(modelId: string, created: number): ModelDescriptionSchema {
  let label = modelId.replaceAll(/[_-]/g, ' ').split(' ').map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
  if (label.endsWith('.bin'))
    label = label.slice(0, -4);

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
 * Update prompt:
 *   "Please update the typescript object below (do not change the definition, just the object), based on the updated upstream documentation:"
 *
 * fields:
 *  - cw: context window size (max tokens, total)
 *  - cp: cost per 1k prompt tokens
 *  - cc: cost per 1k completion tokens
 *  - old: if true, this is an older model that has been superseded by a newer one
 */
const orModelMap: { [id: string]: { name: string; cw: number; cp: number; cc: number; old?: boolean; unfilt?: boolean; } } = {
  'huggingfaceh4/zephyr-7b-beta': { name: 'Hugging Face: Zephyr 7B (beta)', cw: 4096, cp: 0, cc: 0, unfilt: true },
  'mistralai/mistral-7b-instruct': { name: 'Mistral 7B Instruct v0.1 (beta)', cw: 8192, cp: 0, cc: 0, unfilt: true },
  'openai/gpt-3.5-turbo': { name: 'OpenAI: GPT-3.5 Turbo', cw: 4095, cp: 0.0015, cc: 0.002 },
  'openai/gpt-3.5-turbo-1106': { name: 'OpenAI: GPT-3.5 Turbo 16k (preview)', cw: 16385, cp: 0.001, cc: 0.002 },
  'openai/gpt-3.5-turbo-16k': { name: 'OpenAI: GPT-3.5 Turbo 16k', cw: 16383, cp: 0.003, cc: 0.004 },
  'openai/gpt-4-1106-preview': { name: 'OpenAI: GPT-4 Turbo (preview)', cw: 128000, cp: 0.01, cc: 0.03 },
  'openai/gpt-4': { name: 'OpenAI: GPT-4', cw: 8191, cp: 0.03, cc: 0.06 },
  'openai/gpt-4-32k': { name: 'OpenAI: GPT-4 32k', cw: 32767, cp: 0.06, cc: 0.12 },
  'openai/gpt-3.5-turbo-instruct': { name: 'OpenAI: GPT-3.5 Turbo Instruct', cw: 4095, cp: 0.0015, cc: 0.002 },
  'google/palm-2-chat-bison': { name: 'Google: PaLM 2 Chat', cw: 9216, cp: 0.0005, cc: 0.0005, unfilt: true },
  'google/palm-2-codechat-bison': { name: 'Google: PaLM 2 Code Chat', cw: 7168, cp: 0.0005, cc: 0.0005, unfilt: true },
  'google/palm-2-chat-bison-32k': { name: 'Google: PaLM 2 Chat 32k', cw: 32000, cp: 0.0005, cc: 0.0005, unfilt: true },
  'google/palm-2-codechat-bison-32k': { name: 'Google: PaLM 2 Code Chat 32k', cw: 32000, cp: 0.0005, cc: 0.0005, unfilt: true },
  'meta-llama/llama-2-13b-chat': { name: 'Meta: Llama v2 13B Chat (beta)', cw: 4096, cp: 0.0002345, cc: 0.0002345, unfilt: true },
  'meta-llama/llama-2-70b-chat': { name: 'Meta: Llama v2 70B Chat (beta)', cw: 4096, cp: 0.0007, cc: 0.00095, unfilt: true },
  'nousresearch/nous-hermes-llama2-13b': { name: 'Nous: Hermes Llama2 13B (beta)', cw: 4096, cp: 0.0002, cc: 0.0002, unfilt: true },
  'nousresearch/nous-hermes-llama2-70b': { name: 'Nous: Hermes Llama2 70B (beta)', cw: 4096, cp: 0.001, cc: 0.001, unfilt: true },
  'meta-llama/codellama-34b-instruct': { name: 'Meta: CodeLlama 34B Instruct (beta)', cw: 8192, cp: 0.0004, cc: 0.0004, unfilt: true },
  'phind/phind-codellama-34b': { name: 'Phind: CodeLlama 34B v2 (beta)', cw: 4096, cp: 0.0004, cc: 0.0004, unfilt: true },
  'jondurbin/airoboros-l2-70b': { name: 'Airoboros L2 70B (beta)', cw: 4096, cp: 0.0007, cc: 0.00095, unfilt: true },
  'migtissera/synthia-70b': { name: 'Synthia 70B (beta)', cw: 8192, cp: 0.009375, cc: 0.009375, unfilt: true },
  'open-orca/mistral-7b-openorca': { name: 'Mistral OpenOrca 7B (beta)', cw: 8192, cp: 0.0002, cc: 0.0002, unfilt: true },
  'teknium/openhermes-2-mistral-7b': { name: 'Mistral OpenHermes 7B (beta)', cw: 4096, cp: 0.0002, cc: 0.0002, unfilt: true },
  'pygmalionai/mythalion-13b': { name: 'Pygmalion: Mythalion 13B (beta)', cw: 8192, cp: 0.001125, cc: 0.001125, unfilt: true },
  'undi95/remm-slerp-l2-13b': { name: 'ReMM SLERP L2 13B (beta)', cw: 6144, cp: 0.001125, cc: 0.001125, unfilt: true },
  'gryphe/mythomax-l2-13b': { name: 'MythoMax L2 13B', cw: 4096, cp: 0.0008, cc: 0.0008, unfilt: true },
  'xwin-lm/xwin-lm-70b': { name: 'Xwin 70B (beta)', cw: 8192, cp: 0.009375, cc: 0.009375, unfilt: true },
  'gryphe/mythomax-l2-13b-8k': { name: 'MythoMax L2 13B 8k (beta)', cw: 8192, cp: 0.001125, cc: 0.001125, unfilt: true },
  'anthropic/claude-2': { name: 'Anthropic: Claude v2', cw: 100000, cp: 0.01102, cc: 0.03268 },
  'anthropic/claude-instant-v1': { name: 'Anthropic: Claude Instant v1', cw: 100000, cp: 0.00163, cc: 0.00551 },
  'mancer/weaver': { name: 'Mancer: Weaver 12k (alpha)', cw: 8000, cp: 0.0045, cc: 0.0045, unfilt: true },
  'openai/gpt-3.5-turbo-0301': { name: 'OpenAI: GPT-3.5 Turbo (older v0301)', cw: 4095, cp: 0.0015, cc: 0.002, old: true },
  'openai/gpt-4-0314': { name: 'OpenAI: GPT-4 (older v0314)', cw: 8191, cp: 0.03, cc: 0.06, old: true },
  'openai/gpt-4-32k-0314': { name: 'OpenAI: GPT-4 32k (older v0314)', cw: 32767, cp: 0.06, cc: 0.12, old: true },
  'openai/text-davinci-002': { name: 'OpenAI: Davinci 2', cw: 4095, cp: 0.02, cc: 0.02, old: true },
  'anthropic/claude-v1': { name: 'Anthropic: Claude v1', cw: 9000, cp: 0.01102, cc: 0.03268, old: true },
  'anthropic/claude-1.2': { name: 'Anthropic: Claude (older v1)', cw: 9000, cp: 0.01102, cc: 0.03268, old: true },
  'anthropic/claude-instant-v1-100k': { name: 'Anthropic: Claude Instant 100k v1', cw: 100000, cp: 0.00163, cc: 0.00551, old: true },
  'anthropic/claude-v1-100k': { name: 'Anthropic: Claude 100k v1', cw: 100000, cp: 0.01102, cc: 0.03268, old: true },
  'anthropic/claude-instant-1.0': { name: 'Anthropic: Claude Instant (older v1)', cw: 9000, cp: 0.00163, cc: 0.00551, old: true },
};

const orModelFamilyOrder = ['mistralai/', 'huggingfaceh4/', 'openai/', 'anthropic/', 'google/', 'meta-llama/', 'phind/'];

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
    label += ' - 🎁 Free';

  // if (!orModel)
  //   console.log('openRouterModelToModelDescription: unknown model id:', modelId);

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
    ...(!!known.hidden && { hidden: known.hidden })
  };
}