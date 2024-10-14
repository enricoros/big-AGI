import type { OpenAIWire_API_Models_List } from '~/modules/aix/server/dispatch/wiretypes/openai.wiretypes';

import { LLM_IF_OAI_Chat, LLM_IF_OAI_Complete, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_PromptCaching, LLM_IF_OAI_Realtime, LLM_IF_OAI_Vision, LLM_IF_SPECIAL_OAI_O1Preview } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';
import { fromManualMapping, ManualMappings } from './models.data';


// [Azure] / [OpenAI]
// https://platform.openai.com/docs/models
export const _knownOpenAIChatModels: ManualMappings = [

  // GPT-4o -> 2024-05-13 (Starting October 2nd, 2024, gpt-4o will point to the gpt-4o-2024-08-06 snapshot)
  {
    idPrefix: 'gpt-4o',
    label: 'GPT-4o',
    description: 'Points to gpt-4o-2024-08-06 starting on Oct 2, 2024.',
    symLink: 'gpt-4o-2024-08-06',
    hidden: true,
    // copied from symlinked
    contextWindow: 128000,
    maxCompletionTokens: 16384,
    trainingDataCutoff: 'Oct 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_PromptCaching],
    chatPrice: { input: 2.5, cache: { cType: 'oai-ac', read: 1.25 }, output: 10 },
    benchmark: { cbaElo: 1286 + 1 },
  },
  {
    isLatest: true,
    idPrefix: 'gpt-4o-2024-08-06',
    label: 'GPT-4o (2024-08-06)',
    description: 'Latest snapshot that supports Structured Outputs.',
    contextWindow: 128000,
    maxCompletionTokens: 16384,
    trainingDataCutoff: 'Oct 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_PromptCaching], // + Structured Outputs?
    chatPrice: { input: 2.5, cache: { cType: 'oai-ac', read: 1.25 }, output: 10 },
    benchmark: { cbaElo: 1264 },
  },
  {
    idPrefix: 'gpt-4o-2024-05-13',
    label: 'GPT-4o (2024-05-13)',
    description: 'Advanced, multimodal flagship model that\'s cheaper and faster than GPT-4 Turbo.',
    contextWindow: 128000,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Oct 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: { input: 5, output: 15 },
    benchmark: { cbaElo: 1285 },
    hidden: true,
  },
  {
    idPrefix: 'chatgpt-4o-latest',
    label: 'ChatGPT-4o Latest',
    description: 'Intended for research and evaluation. Dynamic model continuously updated to the current version of GPT-4o in ChatGPT.',
    contextWindow: 128000,
    maxCompletionTokens: 16384,
    trainingDataCutoff: 'Oct 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: { input: 5, output: 15 },
    benchmark: { cbaElo: 1337 },
  },

  // GPT-4o mini
  {
    idPrefix: 'gpt-4o-mini',
    label: 'GPT-4o mini',
    description: 'Currently points to gpt-4o-mini-2024-07-18.',
    symLink: 'gpt-4o-mini-2024-07-18',
    hidden: true,
    // copied from symlinked
    contextWindow: 128000,
    maxCompletionTokens: 16384,
    trainingDataCutoff: 'Oct 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_PromptCaching],
    chatPrice: { input: 0.15, cache: { cType: 'oai-ac', read: 0.075 }, output: 0.60 },
    benchmark: { cbaElo: 1272 },
  },
  {
    idPrefix: 'gpt-4o-mini-2024-07-18',
    label: 'GPT-4o Mini (2024-07-18)',
    description: 'Affordable model for fast, lightweight tasks. GPT-4o Mini is cheaper and more capable than GPT-3.5 Turbo.',
    contextWindow: 128000,
    maxCompletionTokens: 16384,
    trainingDataCutoff: 'Oct 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_PromptCaching],
    chatPrice: { input: 0.15, cache: { cType: 'oai-ac', read: 0.075 }, output: 0.60 },
    benchmark: { cbaElo: 1272 },
  },

  // GPT-4o Realtime Preview
  {
    idPrefix: 'gpt-4o-realtime-preview',
    label: 'GPT-4o Realtime',
    description: 'Points to the latest snapshot of GPT-4o Realtime Preview model: gpt-4o-realtime-preview-2024-10-01',
    symLink: 'gpt-4o-realtime-preview-2024-10-01',
    hidden: true,
    // copied from symlinked
    contextWindow: 128000,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Oct 2023',
    interfaces: [LLM_IF_OAI_Realtime /* TBA FC, AUDIO */],
    chatPrice: { input: 5, output: 20 /* TODO: AUDIO 100/200 */ },
    isPreview: true,
  },
  {
    idPrefix: 'gpt-4o-realtime-preview-2024-10-01',
    label: 'GPT-4o Realtime (2024-10-01)',
    description: 'Latest snapshot of GPT-4o Realtime Preview model supporting low-latency, multimodal experiences including speech-to-speech capabilities.',
    contextWindow: 128000,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Oct 2023',
    interfaces: [LLM_IF_OAI_Realtime /* TBA FC, AUDIO */],
    chatPrice: { input: 5, output: 20 /* TODO: AUDIO 100/200 */ },
    isPreview: true,
  },

  // o1-preview
  {
    idPrefix: 'o1-preview',
    label: 'o1 Preview',
    description: 'Points to the most recent snapshot of the o1 model: o1-preview-2024-09-12',
    symLink: 'o1-preview-2024-09-12',
    hidden: true,
    // copied from symlinked
    contextWindow: 128000,
    maxCompletionTokens: 32768,
    trainingDataCutoff: 'Oct 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_SPECIAL_OAI_O1Preview, LLM_IF_OAI_PromptCaching],
    chatPrice: { input: 15, cache: { cType: 'oai-ac', read: 7.50 }, output: 60 },
    benchmark: { cbaElo: 1339 },
    isPreview: true,
  },
  {
    idPrefix: 'o1-preview-2024-09-12',
    label: 'o1 Preview (2024-09-12) ⏱️',
    description: 'This model takes longer to run and does not support streaming.\n\nNew reasoning model for complex tasks that require broad general knowledge.',
    contextWindow: 128000,
    maxCompletionTokens: 32768,
    trainingDataCutoff: 'Oct 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_SPECIAL_OAI_O1Preview, LLM_IF_OAI_PromptCaching],
    chatPrice: { input: 15, cache: { cType: 'oai-ac', read: 7.50 }, output: 60 },
    benchmark: { cbaElo: 1339 },
    isPreview: true,
  },

  // o1-mini
  {
    idPrefix: 'o1-mini',
    label: 'o1 Mini',
    description: 'Points to the most recent o1-mini snapshot: o1-mini-2024-09-12',
    symLink: 'o1-mini-2024-09-12',
    hidden: true,
    // copied from symlinked
    contextWindow: 128000,
    maxCompletionTokens: 65536,
    trainingDataCutoff: 'Oct 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_SPECIAL_OAI_O1Preview, LLM_IF_OAI_PromptCaching],
    chatPrice: { input: 3, cache: { cType: 'oai-ac', read: 1.5 }, output: 12 },
    benchmark: { cbaElo: 1314 },
    isPreview: true,
  },
  {
    idPrefix: 'o1-mini-2024-09-12',
    label: 'o1 Mini (2024-09-12) ⏱️',
    description: 'This model feels slow because it does not support streaming.\n\nFast, cost-efficient reasoning model tailored to coding, math, and science use cases.',
    contextWindow: 128000,
    maxCompletionTokens: 65536,
    trainingDataCutoff: 'Oct 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_SPECIAL_OAI_O1Preview, LLM_IF_OAI_PromptCaching],
    chatPrice: { input: 3, cache: { cType: 'oai-ac', read: 1.5 }, output: 12 },
    benchmark: { cbaElo: 1314 },
    isPreview: true,
  },

  // GPT-4 Turbo with Vision -> 2024-04-09
  {
    idPrefix: 'gpt-4-turbo',
    label: 'GPT-4 Turbo',
    description: 'GPT-4 Turbo with Vision. Currently points to gpt-4-turbo-2024-04-09.',
    symLink: 'gpt-4-turbo-2024-04-09',
    hidden: true,
    // copied from symlinked
    contextWindow: 128000,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Dec 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: { input: 10, output: 30 },
    benchmark: { cbaElo: 1257 },
  },
  {
    idPrefix: 'gpt-4-turbo-2024-04-09',
    label: 'GPT-4 Turbo (2024-04-09)',
    description: 'GPT-4 Turbo with Vision model. Vision requests can now use JSON mode and function calling. gpt-4-turbo currently points to this version.',
    contextWindow: 128000,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Dec 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: { input: 10, output: 30 },
    benchmark: { cbaElo: 1257 },
  },

  // GPT-4 Turbo Previews
  {
    idPrefix: 'gpt-4-turbo-preview',
    label: 'GPT-4 Turbo Preview',
    description: 'GPT-4 Turbo preview model. Currently points to gpt-4-0125-preview.',
    symLink: 'gpt-4-0125-preview',
    hidden: true,
    // copied from symlinked
    isPreview: true,
    contextWindow: 128000,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Dec 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: { input: 10, output: 30 },
    benchmark: { cbaElo: 1251 },
  },
  {
    idPrefix: 'gpt-4-0125-preview',
    label: 'GPT-4 Turbo (0125)',
    description: 'GPT-4 Turbo preview model intended to reduce cases of "laziness" where the model doesn\'t complete a task.',
    contextWindow: 128000,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Dec 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: { input: 10, output: 30 },
    benchmark: { cbaElo: 1251 },
    hidden: true,
  },
  {
    idPrefix: 'gpt-4-1106-preview', // GPT-4 Turbo preview model
    label: 'GPT-4 Turbo (1106)',
    description: 'GPT-4 Turbo preview model featuring improved instruction following, JSON mode, reproducible outputs, parallel function calling, and more.',
    contextWindow: 128000,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Apr 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: { input: 10, output: 30 },
    benchmark: { cbaElo: 1251 },
    hidden: true,
  },


  // GPT4-32k's
  {
    idPrefix: 'gpt-4-32k',
    label: 'GPT-4 32k',
    description: 'Currently points to gpt-4-32k-0613. This model was never rolled out widely in favor of GPT-4 Turbo.',
    symLink: 'gpt-4-32k-0613',
    // copied from symlinked
    contextWindow: 32768,
    trainingDataCutoff: 'Sep 2021',
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 60, output: 120 },
    hidden: true,
  },
  {
    idPrefix: 'gpt-4-32k-0613',
    label: 'GPT-4 32k (0613)',
    description: 'Snapshot of gpt-4-32k from June 13th 2023 with improved function calling support. This model was never rolled out widely in favor of GPT-4 Turbo.',
    contextWindow: 32768,
    trainingDataCutoff: 'Sep 2021',
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 60, output: 120 },
    hidden: true,
  },
  {
    idPrefix: 'gpt-4-32k-0314',
    label: 'GPT-4 32k (0314)',
    description: 'Snapshot of gpt-4-32k from March 14th 2023. Will be deprecated on June 13th 2024 at the earliest.',
    contextWindow: 32768,
    trainingDataCutoff: 'Sep 2021',
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 60, output: 120 },
    hidden: true,
  },


  // GPT4's
  {
    idPrefix: 'gpt-4',
    label: 'GPT-4',
    description: 'Currently points to gpt-4-0613.',
    symLink: 'gpt-4-0613',
    hidden: true,
    // copied from symlinked
    contextWindow: 8192,
    trainingDataCutoff: 'Sep 2021',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 30, output: 60 },
    benchmark: { cbaElo: 1163 },
    isLegacy: true,
  },
  {
    idPrefix: 'gpt-4-0613',
    label: 'GPT-4 (0613)',
    description: 'Snapshot of gpt-4 from June 13th 2023 with improved function calling support. Data up to Sep 2021.',
    contextWindow: 8192,
    trainingDataCutoff: 'Sep 2021',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 30, output: 60 },
    benchmark: { cbaElo: 1163 },
    hidden: true,
  },
  {
    idPrefix: 'gpt-4-0314',
    label: 'GPT-4 (0314)',
    description: 'Snapshot of gpt-4 from March 14th 2023 with function calling data. Data up to Sep 2021.',
    contextWindow: 8192,
    trainingDataCutoff: 'Sep 2021',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 30, output: 60 },
    benchmark: { cbaElo: 1186 },
    hidden: true,
  },

  // 3.5-Turbo
  // Note: As of July 2024, gpt-4o-mini should be used in place of gpt-3.5-turbo, as it is cheaper, more capable, multimodal, and just as fast.
  // As such, many 3.5 models are in the 'deny list' below, and not even returned to the UI.
  {
    idPrefix: 'gpt-3.5-turbo-0125',
    label: '3.5-Turbo (2024-01-25)',
    description: 'The latest GPT-3.5 Turbo model with higher accuracy at responding in requested formats and a fix for a bug which caused a text encoding issue for non-English language function calls.',
    contextWindow: 4096,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Sep 2021',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.5, output: 1.5 },
    benchmark: { cbaElo: 1106 },
  },
  {
    idPrefix: 'gpt-3.5-turbo',
    label: '3.5-Turbo',
    description: 'Currently points to gpt-3.5-turbo-0125. As of July 2024, gpt-4o-mini should be used in place of gpt-3.5-turbo, as it is cheaper, more capable, multimodal, and just as fast.',
    symLink: 'gpt-3.5-turbo-0125',
    hidden: true,
    // copied
    contextWindow: 16385,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Sep 2021',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.5, output: 1.5 },
    benchmark: { cbaElo: 1106 },
  },
  {
    idPrefix: 'gpt-3.5-turbo-1106',
    label: '3.5-Turbo (1106)',
    description: 'GPT-3.5 Turbo model with improved instruction following, JSON mode, reproducible outputs, parallel function calling, and more.',
    contextWindow: 16385,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Sep 2021',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 1, output: 2 },
    benchmark: { cbaElo: 1072 },
    hidden: true,
  },

  // 3.5-Turbo-Instruct (Not for Chat)
  {
    idPrefix: 'gpt-3.5-turbo-instruct',
    label: '3.5-Turbo Instruct',
    description: 'Similar capabilities as GPT-3 era models. Compatible with legacy Completions endpoint and not Chat Completions.',
    contextWindow: 4096,
    trainingDataCutoff: 'Sep 2021',
    interfaces: [/* NO: LLM_IF_OAI_Chat,*/ LLM_IF_OAI_Complete],
    chatPrice: { input: 1.5, output: 2 },
    hidden: true,
  },

  // Azure variants - because someone forgot the dot
  {
    idPrefix: 'gpt-35-turbo-16k',
    label: '3.5-Turbo 16k',
    description: 'Fair speed and smarts, large context',
    contextWindow: 16384,
    interfaces: [LLM_IF_OAI_Chat], // as azure doesn't version model id's (in the deployments), let's assume no function calling
  },
  {
    idPrefix: 'gpt-35-turbo',
    label: '3.5-Turbo',
    contextWindow: 4096,
    description: 'Fair speed and smarts',
    interfaces: [LLM_IF_OAI_Chat], // as azure doesn't version model id's (in the deployments), let's assume no function calling
  },

  // Fallback - unknown
  {
    idPrefix: '',
    label: '?:',
    description: 'Unknown, please let us know the ID. Assuming a context window of 128k tokens, and a maximum output of 4k tokens.',
    contextWindow: 128000,
    maxCompletionTokens: 4096,
    interfaces: [LLM_IF_OAI_Chat],
    // hidden: true,
  },
];

const openAIModelsDenyList: string[] = [
  // Legacy GPT models
  'gpt-3.5-turbo-0301',
  'gpt-3.5-turbo-0613',
  'gpt-3.5-turbo-16k',
  'gpt-3.5-turbo-16k-0613',

  // Other unwanted GPT models
  'gpt-4-turbo-preview',

  // Non-chat GPT models
  '-turbo-instruct', 'davinci-', 'babbage-',

  // Embedding models: /v1/embeddings
  'text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002',

  // TTS Models: /v1/audio/speech
  'tts-1-hd', 'tts-1',

  // STT models: /v1/audio/transcriptions, /v1/audio/translations
  'whisper-1',

  // Image models: /v1/images/generations
  'dall-e-3', 'dall-e-2',
];

export function openAIModelFilter(model: OpenAIWire_API_Models_List.Model) {
  return !openAIModelsDenyList.some(deny => model.id.includes(deny));
}

export function openAIModelToModelDescription(modelId: string, modelCreated: number | undefined, modelUpdated?: number): ModelDescriptionSchema {
  return fromManualMapping(_knownOpenAIChatModels, modelId, modelCreated, modelUpdated);
}