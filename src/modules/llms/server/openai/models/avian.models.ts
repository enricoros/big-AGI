import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';
import { fromManualMapping, ManualMappings } from '../../models.mappings';


/**
 * Avian models.
 * - API: https://api.avian.io/v1 (OpenAI-compatible)
 * - updated: 2026-02-27
 */
const _knownAvianModels: ManualMappings = [

  // DeepSeek V3.2
  {
    idPrefix: 'deepseek/deepseek-v3.2',
    label: 'DeepSeek V3.2',
    description: 'DeepSeek V3.2 MoE model. Strong reasoning and coding. 164K context, 65K max output.',
    contextWindow: 163840,
    maxCompletionTokens: 65536,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.26, output: 0.38 },
  },

  // Moonshot Kimi K2.5
  {
    idPrefix: 'moonshotai/kimi-k2.5',
    label: 'Kimi K2.5',
    description: 'Moonshot AI Kimi K2.5 MoE model. Advanced agentic coding. 131K context, 8K max output.',
    contextWindow: 131072,
    maxCompletionTokens: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.45, output: 2.20 },
  },

  // Z.ai GLM-5
  {
    idPrefix: 'z-ai/glm-5',
    label: 'GLM-5',
    description: 'Z.ai GLM-5 large language model. Strong multilingual and reasoning. 131K context, 16K max output.',
    contextWindow: 131072,
    maxCompletionTokens: 16384,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.30, output: 2.55 },
  },

  // MiniMax M2.5
  {
    idPrefix: 'minimax/minimax-m2.5',
    label: 'MiniMax M2.5',
    description: 'MiniMax M2.5 model. 1M context window and 1M max output.',
    contextWindow: 1048576,
    maxCompletionTokens: 1048576,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.30, output: 1.10 },
  },

];


export function avianModelFilter(modelId: string): boolean {
  // accept all models from the Avian API
  return true;
}

export function avianModelToModelDescription(modelId: string, modelCreated?: number): ModelDescriptionSchema {
  return fromManualMapping(_knownAvianModels, modelId, modelCreated, undefined, {
    idPrefix: modelId,
    label: modelId.replaceAll(/[/_-]/g, ' '),
    description: 'Avian model',
    contextWindow: 131072,
    interfaces: [LLM_IF_OAI_Chat],
    hidden: true,
  });
}

export function avianModelSort(a: ModelDescriptionSchema, b: ModelDescriptionSchema): number {
  // sort hidden at the end
  if (a.hidden && !b.hidden) return 1;
  if (!a.hidden && b.hidden) return -1;

  // sort as per their order in the known models
  const aIndex = _knownAvianModels.findIndex(base => a.id.startsWith(base.idPrefix));
  const bIndex = _knownAvianModels.findIndex(base => b.id.startsWith(base.idPrefix));
  if (aIndex !== -1 && bIndex !== -1)
    return aIndex - bIndex;

  return a.id.localeCompare(b.id);
}
