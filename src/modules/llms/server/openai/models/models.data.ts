import type { OpenAIWire_API_Models_List } from '~/modules/aix/server/dispatch/wiretypes/openai.wiretypes';

import { LLM_IF_OAI_Chat, LLM_IF_OAI_Complete, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Vision, LLM_IF_SPECIAL_OAI_O1Preview } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { wireGroqModelsListOutputSchema } from '../groq.wiretypes';
import { wireOpenPipeModelOutputSchema } from '../openpipe.wiretypes';
import { wireOpenrouterModelsListOutputSchema } from '../openrouter.wiretypes';
import { wireTogetherAIListOutputSchema } from '../togetherai.wiretypes';


// [Azure] / [OpenAI]
// https://platform.openai.com/docs/models
const _knownOpenAIChatModels: ManualMappings = [

  // GPT-4o -> 2024-05-13 (Starting October 2nd, 2024, gpt-4o will point to the gpt-4o-2024-08-06 snapshot)
  {
    idPrefix: 'gpt-4o',
    label: 'GPT-4o',
    description: 'Currently points to gpt-4o-2024-05-13.',
    symLink: 'gpt-4o-2024-05-13',
    hidden: true,
    // copied from symlinked
    contextWindow: 128000,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Oct 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: { input: 5, output: 15 },
    benchmark: { cbaElo: 1286 },
  },
  {
    isLatest: true,
    idPrefix: 'gpt-4o-2024-08-06',
    label: 'GPT-4o (2024-08-06)',
    description: 'Latest snapshot that supports Structured Outputs',
    contextWindow: 128000,
    maxCompletionTokens: 16384,
    trainingDataCutoff: 'Oct 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json], // + Structured Outputs?
    chatPrice: { input: 2.5, output: 10 },
    benchmark: { cbaElo: 1286 + 1 },
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
    benchmark: { cbaElo: 1286 },
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
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: { input: 0.15, output: 0.60 },
    benchmark: { cbaElo: 1277, cbaMmlu: 82.0 },
  },
  {
    idPrefix: 'gpt-4o-mini-2024-07-18',
    label: 'GPT-4o Mini (2024-07-18)',
    description: 'Affordable model for fast, lightweight tasks. GPT-4o mini is cheaper and more capable than GPT-3.5 Turbo.',
    contextWindow: 128000,
    maxCompletionTokens: 16384,
    trainingDataCutoff: 'Oct 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: { input: 0.15, output: 0.60 },
    benchmark: { cbaElo: 1277, cbaMmlu: 82.0 },
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
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_SPECIAL_OAI_O1Preview],
    chatPrice: { input: 15, output: 60 },
    isPreview: true,
  },
  {
    idPrefix: 'o1-preview-2024-09-12',
    label: 'o1 Preview (2024-09-12) ⏱️',
    description: 'This model takes longer to run and does not support streaming.\n\nNew reasoning model for complex tasks that require broad general knowledge.',
    contextWindow: 128000,
    maxCompletionTokens: 32768,
    trainingDataCutoff: 'Oct 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_SPECIAL_OAI_O1Preview],
    chatPrice: { input: 15, output: 60 },
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
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_SPECIAL_OAI_O1Preview],
    chatPrice: { input: 3, output: 12 },
    isPreview: true,
  },
  {
    idPrefix: 'o1-mini-2024-09-12',
    label: 'o1 Mini (2024-09-12) ⏱️',
    description: 'This model feels slow because it does not support streaming.\n\nFast, cost-efficient reasoning model tailored to coding, math, and science use cases.',
    contextWindow: 128000,
    maxCompletionTokens: 65536,
    trainingDataCutoff: 'Oct 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_SPECIAL_OAI_O1Preview],
    chatPrice: { input: 3, output: 12 },
    isPreview: true,
  },

  // GPT4 Turbo with Vision -> 2024-04-09
  {
    idPrefix: 'gpt-4-turbo',
    label: 'GPT-4 Turbo',
    description: 'New GPT-4 Turbo with Vision. The latest GPT-4 Turbo model with vision capabilities. Vision requests can now use JSON mode and function calling. Currently points to gpt-4-turbo-2024-04-09.',
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

  // GPT4 Turbo Previews
  {
    idPrefix: 'gpt-4-turbo-preview',
    label: 'GPT-4 Preview Turbo',
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
    benchmark: { cbaElo: 1245 },
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
    benchmark: { cbaElo: 1245 },
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
    description: 'Snapshot of gpt-4-32 from March 14th 2023. Will be deprecated on June 13th 2024 at the earliest.',
    contextWindow: 32768,
    trainingDataCutoff: 'Sep 2021',
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 60, output: 120 },
    hidden: true,
  },


  // GPT4's
  {
    idPrefix: 'gpt-4-0613',
    label: 'GPT-4 (0613)',
    description: 'Snapshot of gpt-4 from June 13th 2023 with improved function calling support. Data up to Sep 2021.',
    contextWindow: 8192,
    trainingDataCutoff: 'Sep 2021',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 30, output: 60 },
    benchmark: { cbaElo: 1161 },
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
    benchmark: { cbaElo: 1161 },
    isLegacy: true,
  },

  // 3.5-Turbo
  // As of July 2024, gpt-4o-mini should be used in place of gpt-3.5-turbo, as it is cheaper, more capable, multimodal, and just as fast.
  {
    idPrefix: 'gpt-3.5-turbo-0125',
    label: '3.5-Turbo (0125)',
    description: 'The latest GPT-3.5 Turbo model with higher accuracy at responding in requested formats and a fix for a bug which caused a text encoding issue for non-English language function calls.',
    contextWindow: 16385,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Sep 2021',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.5, output: 1.5 },
    benchmark: { cbaElo: 1105 },
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
    benchmark: { cbaElo: 1105 },
  },


  // 3.5-Turbo-Instruct (Not for Chat)
  {
    idPrefix: 'gpt-3.5-turbo-instruct',
    label: '3.5-Turbo Instruct',
    description: 'Similar capabilities as GPT-3 era models. Compatible with legacy Completions endpoint and not Chat Completions.',
    contextWindow: 4097,
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

const openAIModelsDenyList: string[] = [
  /* /v1/audio/speech */
  'tts-1-hd', 'tts-1',
  /* /v1/embeddings */
  'text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002',
  /* /v1/audio/transcriptions, /v1/audio/translations	*/
  'whisper-1',
  /* /v1/images/generations */
  'dall-e-3', 'dall-e-2',
  /* /v1/completions (Legacy)	 */
  '-turbo-instruct', 'davinci-', 'babbage-',

  // just Legacy models, that we should drop
  'gpt-3.5-turbo-16k-0613', 'gpt-3.5-turbo-0613', 'gpt-3.5-turbo-0301', 'gpt-3.5-turbo-16k',
];

export function openAIModelFilter(model: OpenAIWire_API_Models_List.Model) {
  return !openAIModelsDenyList.some(deny => model.id.includes(deny));
}

export function openAIModelToModelDescription(modelId: string, modelCreated: number | undefined, modelUpdated?: number): ModelDescriptionSchema {
  return fromManualMapping(_knownOpenAIChatModels, modelId, modelCreated, modelUpdated);
}

export function azureModelToModelDescription(azureDeploymentRef: string, openAIModelIdBase: string, modelCreated: number, modelUpdated?: number): ModelDescriptionSchema {
  // if the deployment name mataches an OpenAI model prefix, use that
  const known = _knownOpenAIChatModels.find(base => azureDeploymentRef == base.idPrefix);
  return fromManualMapping(_knownOpenAIChatModels, known ? azureDeploymentRef : openAIModelIdBase, modelCreated, modelUpdated, undefined, true);
}


// [Deepseek AI]
const _knownDeepseekChatModels: ManualMappings = [
  // [Models and Pricing](https://platform.deepseek.com/api-docs/pricing)
  // [List Models](https://platform.deepseek.com/api-docs/api/list-models)
  {
    idPrefix: 'deepseek-chat',
    label: 'Deepseek Chat V2',
    description: 'Good at general tasks, 128K context length',
    contextWindow: 128000,
    interfaces: [LLM_IF_OAI_Chat],
    maxCompletionTokens: 4096,
    chatPrice: { input: 0.14, output: 0.28 },
  },
  {
    idPrefix: 'deepseek-coder',
    label: 'Deepseek Coder V2',
    description: 'Good at coding and math tasks, 128K context length',
    contextWindow: 128000,
    interfaces: [LLM_IF_OAI_Chat],
    maxCompletionTokens: 4096,
    chatPrice: { input: 0.14, output: 0.28 },
  },
];

export function deepseekModelToModelDescription(deepseekModelId: string): ModelDescriptionSchema {
  return fromManualMapping(_knownDeepseekChatModels, deepseekModelId, undefined, undefined, {
    idPrefix: deepseekModelId,
    label: deepseekModelId.replaceAll(/[_-]/g, ' '),
    description: 'New Deepseek Model',
    contextWindow: 128000,
    maxCompletionTokens: 4096,
    interfaces: [LLM_IF_OAI_Chat], // assume..
    hidden: true,
  });
}


// [LM Studio]
export function lmStudioModelToModelDescription(modelId: string): ModelDescriptionSchema {

  // LM Studio model ID's are the file names of the model files
  function getFileName(filePath: string): string {
    const normalizedPath = filePath.replace(/\\/g, '/');
    return normalizedPath.split('/').pop() || '';
  }

  return fromManualMapping([], modelId, undefined, undefined, {
    idPrefix: modelId,
    label: getFileName(modelId)
      .replace('.gguf', '')
      .replace('.bin', ''),
    // .replaceAll('-', ' '),
    description: `Unknown LM Studio model. File: ${modelId}`,
    contextWindow: null, // 'not provided'
    interfaces: [LLM_IF_OAI_Chat], // assume..
    chatPrice: { input: 'free', output: 'free' },
  });
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
    contextWindow: null, // 'not provided'
    interfaces: [LLM_IF_OAI_Chat], // assume..
    chatPrice: { input: 'free', output: 'free' },
  });
}


// [Mistral] moved to own file


// [OpenPipe]

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


// [OpenRouter]

const orOldModelIDs = [
  'openai/gpt-3.5-turbo-0301', 'openai/gpt-4-0314', 'openai/gpt-4-32k-0314', 'openai/text-davinci-002',
  'anthropic/claude-2.1', 'anthropic/claude-2.0', 'anthropic/claude-v1', 'anthropic/claude-1.2',
  'anthropic/claude-instant-v1-100k', 'anthropic/claude-v1-100k', 'anthropic/claude-instant-1.0',
];

const orModelFamilyOrder = [
  // great models (pickes by hand, they're free)
  'mistralai/mistral-7b-instruct', 'nousresearch/nous-capybara-7b',
  // great orgs
  'huggingfaceh4/', 'openchat/', 'anthropic/', 'google/', 'mistralai/', 'openai/', 'meta-llama/', 'phind/',
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

export function openRouterModelToModelDescription(wireModel: object): ModelDescriptionSchema {

  // parse the model
  const model = wireOpenrouterModelsListOutputSchema.parse(wireModel);

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

  // hidden: hide by default older models or models not in known families
  const hidden = orOldModelIDs.includes(model.id) || !orModelFamilyOrder.some(prefix => model.id.startsWith(prefix));

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


// [Together AI]

const _knownTogetherAIChatModels: ManualMappings = [
  {
    idPrefix: 'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO',
    label: 'Nous Hermes 2 - Mixtral 8x7B-DPO',
    description: 'Nous Hermes 2 Mixtral 7bx8 DPO is the new flagship Nous Research model trained over the Mixtral 7bx8 MoE LLM. The model was trained on over 1,000,000 entries of primarily GPT-4 generated data, as well as other high quality data from open datasets across the AI landscape, achieving state of the art performance on a variety of tasks.',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'NousResearch/Nous-Hermes-2-Mixtral-8x7B-SFT',
    label: 'Nous Hermes 2 - Mixtral 8x7B-SFT',
    description: 'Nous Hermes 2 Mixtral 7bx8 SFT is the new flagship Nous Research model trained over the Mixtral 7bx8 MoE LLM. The model was trained on over 1,000,000 entries of primarily GPT-4 generated data, as well as other high quality data from open datasets across the AI landscape, achieving state of the art performance on a variety of tasks.',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
    label: 'Mixtral-8x7B Instruct',
    description: 'The Mixtral-8x7B Large Language Model (LLM) is a pretrained generative Sparse Mixture of Experts.',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'mistralai/Mistral-7B-Instruct-v0.2',
    label: 'Mistral (7B) Instruct v0.2',
    description: 'The Mistral-7B-Instruct-v0.2 Large Language Model (LLM) is an improved instruct fine-tuned version of Mistral-7B-Instruct-v0.1.',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'NousResearch/Nous-Hermes-2-Yi-34B',
    label: 'Nous Hermes-2 Yi (34B)',
    description: 'Nous Hermes 2 - Yi-34B is a state of the art Yi Fine-tune',
    contextWindow: 4097,
    interfaces: [LLM_IF_OAI_Chat],
  },
] as const;

export function togetherAIModelsToModelDescriptions(wireModels: unknown): ModelDescriptionSchema[] {

  function togetherAIModelToModelDescription(model: { id: string, created: number }) {
    return fromManualMapping(_knownTogetherAIChatModels, model.id, model.created, undefined, {
      idPrefix: model.id,
      label: model.id.replaceAll('/', ' · ').replaceAll(/[_-]/g, ' '),
      description: 'New Togehter AI Model',
      contextWindow: null, // unknown
      interfaces: [LLM_IF_OAI_Chat], // assume..
      hidden: true,
    });
  }

  function togetherAIModelsSort(a: ModelDescriptionSchema, b: ModelDescriptionSchema): number {
    if (a.hidden && !b.hidden)
      return 1;
    if (!a.hidden && b.hidden)
      return -1;
    if (a.created !== b.created)
      return (b.created || 0) - (a.created || 0);
    return a.id.localeCompare(b.id);
  }

  return wireTogetherAIListOutputSchema.parse(wireModels)
    .map(togetherAIModelToModelDescription)
    .sort(togetherAIModelsSort);
}


// Perplexity


// Groq - https://console.groq.com/docs/models

const _knownGroqModels: ManualMappings = [
  {
    isLatest: true,
    idPrefix: 'llama-3.1-405b-reasoning',
    label: 'Llama 3.1 · 405B',
    description: 'LLaMA 3.1 405B developed by Meta with a context window of 131,072 tokens. Supports tool use.',
    contextWindow: 131072,
    maxCompletionTokens: 8000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  },
  {
    isLatest: true,
    idPrefix: 'llama-3.1-70b-versatile',
    label: 'Llama 3.1 · 70B',
    description: 'LLaMA 3.1 70B developed by Meta with a context window of 131,072 tokens. Supports tool use.',
    contextWindow: 131072,
    maxCompletionTokens: 8000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  },
  {
    isLatest: true,
    idPrefix: 'llama-3.1-8b-instant',
    label: 'Llama 3.1 · 8B',
    description: 'LLaMA 3.1 8B developed by Meta with a context window of 131,072 tokens. Supports tool use.',
    contextWindow: 131072,
    maxCompletionTokens: 8000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  },
  {
    idPrefix: 'llama3-groq-70b-8192-tool-use-preview',
    label: 'Llama 3 Groq · 70B Tool Use',
    description: 'LLaMA 3 70B Tool Use developed by Groq with a context window of 8,192 tokens. Optimized for tool use.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  },
  {
    idPrefix: 'llama3-groq-8b-8192-tool-use-preview',
    label: 'Llama 3 Groq · 8B Tool Use',
    description: 'LLaMA 3 8B Tool Use developed by Groq with a context window of 8,192 tokens. Optimized for tool use.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  },
  {
    idPrefix: 'llama3-70b-8192',
    label: 'Llama 3 · 70B',
    description: 'LLaMA3 70B developed by Meta with a context window of 8,192 tokens. Supports tool use.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    // isLegacy: true,
    hidden: true,
  },
  {
    idPrefix: 'llama3-8b-8192',
    label: 'Llama 3 · 8B',
    description: 'LLaMA3 8B developed by Meta with a context window of 8,192 tokens. Supports tool use.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    // isLegacy: true,
    hidden: true,
  },
  {
    idPrefix: 'mixtral-8x7b-32768',
    label: 'Mixtral 8x7B',
    description: 'Mixtral 8x7B developed by Mistral with a context window of 32,768 tokens. Supports tool use.',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  },
  {
    idPrefix: 'gemma2-9b-it',
    label: 'Gemma 2 · 9B Instruct',
    description: 'Gemma 2 9B developed by Google with a context window of 8,192 tokens. Supports tool use.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  },
  {
    idPrefix: 'gemma-7b-it',
    label: 'Gemma 1.1 · 7B Instruct',
    description: 'Gemma 7B developed by Google with a context window of 8,192 tokens. Supports tool use.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat],
    hidden: true,
  },
];

export function groqModelToModelDescription(_model: unknown): ModelDescriptionSchema {
  const model = wireGroqModelsListOutputSchema.parse(_model);
  return fromManualMapping(_knownGroqModels, model.id, model.created, undefined, {
    idPrefix: model.id,
    label: model.id.replaceAll(/[_-]/g, ' '),
    description: 'New Model',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat],
    hidden: true,
  });
}

export function groqModelSortFn(a: ModelDescriptionSchema, b: ModelDescriptionSchema): number {
  // sort hidden at the end
  if (a.hidden && !b.hidden)
    return 1;
  if (!a.hidden && b.hidden)
    return -1;
  // sort as per their order in the known models
  const aIndex = _knownGroqModels.findIndex(base => a.id.startsWith(base.idPrefix));
  const bIndex = _knownGroqModels.findIndex(base => b.id.startsWith(base.idPrefix));
  if (aIndex !== -1 && bIndex !== -1)
    return aIndex - bIndex;
  return a.id.localeCompare(b.id);
}


// Helpers

export type ManualMapping = ({
  idPrefix: string,
  isLatest?: boolean,
  isPreview?: boolean,
  isLegacy?: boolean,
  symLink?: string
} & Omit<ModelDescriptionSchema, 'id' | 'created' | 'updated'>);

export type ManualMappings = ManualMapping[];

export function fromManualMapping(mappings: ManualMappings, id: string, created?: number, updated?: number, fallback?: ManualMapping, disableSymLink?: boolean): ModelDescriptionSchema {

  // find the closest known model, or fall back, or take the last
  const known = mappings.find(base => id === base.idPrefix)
    || mappings.find(base => id.startsWith(base.idPrefix))
    || fallback
    || mappings[mappings.length - 1];

  // label for symlinks
  let label = known.label;
  if (!disableSymLink && known.symLink && id === known.idPrefix)
    label = `🔗 ${known.label} → ${known.symLink/*.replace(known.idPrefix, '')*/}`;

  // check whether this is a partial map, which indicates an unknown/new variant
  const suffix = id.slice(known.idPrefix.length).trim();

  // create the model description
  const md: ModelDescriptionSchema = {
    id,
    label: label
      + (suffix ? ` [${suffix.replaceAll('-', ' ').trim()}]` : '')
      + (known.isLatest ? ' 🌟' : '')
      + (known.isLegacy ? /*' 💩'*/ ' [legacy]' : ''),
    created: created || 0,
    updated: updated || created || 0,
    description: known.description,
    contextWindow: known.contextWindow,
    interfaces: known.interfaces,
  };

  // apply optional fields
  if (known.maxCompletionTokens)
    md.maxCompletionTokens = known.maxCompletionTokens;
  if (known.trainingDataCutoff)
    md.trainingDataCutoff = known.trainingDataCutoff;
  if (known.benchmark)
    md.benchmark = known.benchmark;
  if (known.chatPrice)
    md.chatPrice = known.chatPrice;
  if (known.hidden)
    md.hidden = true;

  return md;
}