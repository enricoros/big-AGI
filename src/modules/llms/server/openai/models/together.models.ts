import { LLM_IF_OAI_Chat } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';
import { fromManualMapping, ManualMappings } from './models.data';
import { wireTogetherAIListOutputSchema } from '../togetherai.wiretypes';


const _knownTogetherAIChatModels: ManualMappings = [
  {
    idPrefix: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    label: 'Llama 3.3 70B Instruct Turbo',
    description: 'Llama 3.3 70B Instruct Turbo is an advanced model from Meta with a context length of 131072 tokens, using FP8 quantization.',
    contextWindow: 131072,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
    label: 'Llama 3.1 8B Instruct Turbo',
    description: 'Llama 3.1 8B Instruct Turbo is an advanced model from Meta with a context length of 131072 tokens, using FP8 quantization.',
    contextWindow: 131072,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    label: 'Llama 3.1 70B Instruct Turbo',
    description: 'Llama 3.1 70B Instruct Turbo is an advanced model from Meta with a context length of 131072 tokens, using FP8 quantization.',
    contextWindow: 131072,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo',
    label: 'Llama 3.1 405B Instruct Turbo',
    description: 'Llama 3.1 405B Instruct Turbo is a large-scale model from Meta with a context length of 130815 tokens, using FP8 quantization.',
    contextWindow: 130815,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'meta-llama/Meta-Llama-3-8B-Instruct-Turbo',
    label: 'Llama 3 8B Instruct Turbo',
    description: 'Llama 3 8B Instruct Turbo is an advanced model from Meta with a context length of 8192 tokens, using FP8 quantization.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'meta-llama/Meta-Llama-3-70B-Instruct-Turbo',
    label: 'Llama 3 70B Instruct Turbo',
    description: 'Llama 3 70B Instruct Turbo is an advanced model from Meta with a context length of 8192 tokens, using FP8 quantization.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'meta-llama/Llama-3.2-3B-Instruct-Turbo',
    label: 'Llama 3.2 3B Instruct Turbo',
    description: 'Llama 3.2 3B Instruct Turbo is a model from Meta with a context length of 131072 tokens, using FP16 precision.',
    contextWindow: 131072,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'meta-llama/Meta-Llama-3-8B-Instruct-Lite',
    label: 'Llama 3 8B Instruct Lite',
    description: 'Llama 3 8B Instruct Lite is an efficient model from Meta with a context length of 8192 tokens, using INT4 quantization.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'meta-llama/Meta-Llama-3-70B-Instruct-Lite',
    label: 'Llama 3 70B Instruct Lite',
    description: 'Llama 3 70B Instruct Lite is an efficient model from Meta with a context length of 8192 tokens, using INT4 quantization.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'meta-llama/Llama-3-8b-chat-hf',
    label: 'Llama 3 8B Instruct Reference',
    description: 'Llama 3 8B Instruct Reference is a base model from Meta with a context length of 8192 tokens.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'meta-llama/Llama-3-70b-chat-hf',
    label: 'Llama 3 70B Instruct Reference',
    description: 'Llama 3 70B Instruct Reference is a base model from Meta with a context length of 8192 tokens.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'nvidia/Llama-3.1-Nemotron-70B-Instruct-HF',
    label: 'Llama 3.1 Nemotron 70B',
    description: 'Llama 3.1 Nemotron 70B is a model from Nvidia with a context length of 32768 tokens, using FP16 precision.',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'Qwen/Qwen2.5-Coder-32B-Instruct',
    label: 'Qwen 2.5 Coder 32B Instruct',
    description: 'Qwen 2.5 Coder 32B Instruct is a model from Qwen optimized for code tasks, with a context length of 32768 tokens.',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'Qwen/QwQ-32B-Preview',
    label: 'QwQ-32B-Preview',
    description: 'QwQ-32B-Preview is a preview model from Qwen with a context length of 32768 tokens.',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'microsoft/WizardLM-2-8x22B',
    label: 'WizardLM-2 8x22B',
    description: 'WizardLM-2 8x22B is a model from Microsoft with a context length of 65536 tokens.',
    contextWindow: 65536,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'google/gemma-2-27b-it',
    label: 'Gemma 2 27B',
    description: 'Gemma 2 27B is a model from Google with a context length of 8192 tokens.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'google/gemma-2-9b-it',
    label: 'Gemma 2 9B',
    description: 'Gemma 2 9B is a model from Google with a context length of 8192 tokens.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'databricks/dbrx-instruct',
    label: 'DBRX Instruct',
    description: 'DBRX Instruct is a model from Databricks with a context length of 32768 tokens.',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'deepseek-ai/deepseek-llm-67b-chat',
    label: 'DeepSeek LLM Chat (67B)',
    description: 'DeepSeek LLM Chat (67B) is a model from DeepSeek AI with a context length of 4096 tokens.',
    contextWindow: 4096,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'deepseek-ai/DeepSeek-V3',
    label: 'DeepSeek-V3',
    description: 'DeepSeek-V3 is a model from DeepSeek AI with a context length of 131072 tokens, using FP8 quantization.',
    contextWindow: 131072,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'google/gemma-2b-it',
    label: 'Gemma Instruct (2B)',
    description: 'Gemma Instruct (2B) is a model from Google with a context length of 8192 tokens.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'Gryphe/MythoMax-L2-13b',
    label: 'MythoMax-L2 (13B)',
    description: 'MythoMax-L2 (13B) is a model from Gryphe with a context length of 4096 tokens.',
    contextWindow: 4096,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'meta-llama/Llama-2-13b-chat-hf',
    label: 'LLaMA-2 Chat (13B)',
    description: 'LLaMA-2 Chat (13B) is a model from Meta with a context length of 4096 tokens.',
    contextWindow: 4096,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'mistralai/Mistral-7B-Instruct-v0.1',
    label: 'Mistral (7B) Instruct',
    description: 'Mistral (7B) Instruct v0.1 is the initial instruct fine-tuned version of the Mistral 7B model.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'mistralai/Mistral-7B-Instruct-v0.2',
    label: 'Mistral (7B) Instruct v0.2',
    description: 'Mistral (7B) Instruct v0.2 is an improved version with extended context length.',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'mistralai/Mistral-7B-Instruct-v0.3',
    label: 'Mistral (7B) Instruct v0.3',
    description: 'Mistral (7B) Instruct v0.3 is the latest version of Mistral 7B Instruct.',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
    label: 'Mixtral-8x7B Instruct (46.7B)',
    description: 'Mixtral-8x7B Instruct is a model from Mistral AI with a context length of 32768 tokens.',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'mistralai/Mixtral-8x22B-Instruct-v0.1',
    label: 'Mixtral-8x22B Instruct (141B)',
    description: 'Mixtral-8x22B Instruct is a larger model from Mistral AI with a context length of 65536 tokens.',
    contextWindow: 65536,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO',
    label: 'Nous Hermes 2 - Mixtral 8x7B-DPO (46.7B)',
    description: 'Nous Hermes 2 - Mixtral 8x7B-DPO is a model from NousResearch with a context length of 32768 tokens.',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'NousResearch/Nous-Hermes-2-Mixtral-8x7B-SFT',
    label: 'Nous Hermes 2 - Mixtral 8x7B-SFT',
    description: 'Nous Hermes 2 Mixtral 8x7B-SFT is a model from Nous Research trained over the Mixtral 8x7B MoE LLM.',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'NousResearch/Nous-Hermes-2-Yi-34B',
    label: 'Nous Hermes-2 Yi (34B)',
    description: 'Nous Hermes 2 - Yi-34B is a state-of-the-art model from Nous Research.',
    contextWindow: 4097,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'Qwen/Qwen2.5-7B-Instruct-Turbo',
    label: 'Qwen 2.5 7B Instruct Turbo',
    description: 'Qwen 2.5 7B Instruct Turbo is a model from Qwen with a context length of 32768 tokens, using FP8 quantization.',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'Qwen/Qwen2.5-72B-Instruct-Turbo',
    label: 'Qwen 2.5 72B Instruct Turbo',
    description: 'Qwen 2.5 72B Instruct Turbo is a model from Qwen with a context length of 32768 tokens, using FP8 quantization.',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'Qwen/Qwen2-72B-Instruct',
    label: 'Qwen 2 Instruct (72B)',
    description: 'Qwen 2 Instruct (72B) is a model from Qwen with a context length of 32768 tokens.',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'upstage/SOLAR-10.7B-Instruct-v1.0',
    label: 'Upstage SOLAR Instruct v1 (11B)',
    description: 'Upstage SOLAR Instruct v1 is a model from Upstage with a context length of 4096 tokens.',
    contextWindow: 4096,
    interfaces: [LLM_IF_OAI_Chat],
  },
] as const;


export function togetherAIModelsToModelDescriptions(wireModels: unknown): ModelDescriptionSchema[] {

  function togetherAIModelToModelDescription(model: { id: string, created: number }) {
    return fromManualMapping(_knownTogetherAIChatModels, model.id, model.created, undefined, {
      idPrefix: model.id,
      label: model.id.replaceAll('/', ' · ').replaceAll(/[_-]/g, ' '),
      description: 'New Together AI Model',
      contextWindow: null, // unknown
      interfaces: [LLM_IF_OAI_Chat], // assume
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
