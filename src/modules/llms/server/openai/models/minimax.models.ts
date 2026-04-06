import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';


// [MiniMax] URL/host heuristic for OpenAI-compatible detection
export function minimaxHeuristic(urlOrHost: string | undefined): boolean {
  return !!urlOrHost && urlOrHost.includes('minimax.io');
}


/**
 * MiniMax hardcoded models - no /v1/models API yet.
 * - Models: https://platform.minimax.io/docs/release-notes/models.md
 * - Pricing: https://platform.minimax.io/docs/guides/pricing-paygo.md
 * - Text generation: https://platform.minimax.io/docs/guides/text-generation.md
 * - Updated: 2026-04-04
 */
const _knownMiniMaxModels: ModelDescriptionSchema[] = [

  // M2.7 series
  {
    id: 'MiniMax-M2.7',
    label: 'MiniMax M2.7',
    description: 'Latest flagship with recursive self-improvement and agentic capabilities. 200K context, 131K max output. ~60 t/s.',
    contextWindow: 204800,
    maxCompletionTokens: 131072,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    chatPrice: { input: 0.30, output: 1.20, cache: { cType: 'oai-ac', read: 0.06 } },
  },
  {
    id: 'MiniMax-M2.7-highspeed',
    label: 'MiniMax M2.7 (Highspeed)',
    description: 'Faster M2.7 variant at ~100 t/s. 200K context, 131K max output.',
    contextWindow: 204800,
    maxCompletionTokens: 131072,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    chatPrice: { input: 0.60, output: 2.40, cache: { cType: 'oai-ac', read: 0.06 } },
  },

  // M2.5 series
  {
    id: 'MiniMax-M2.5',
    label: 'MiniMax M2.5',
    description: 'Strong coding and reasoning, best value. 200K context, 65K max output.',
    contextWindow: 204800,
    maxCompletionTokens: 65536,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    chatPrice: { input: 0.30, output: 1.20, cache: { cType: 'oai-ac', read: 0.03 } },
  },
  {
    id: 'MiniMax-M2.5-highspeed',
    label: 'MiniMax M2.5 (Highspeed)',
    description: 'Faster M2.5 variant at ~100 t/s. 200K context, 65K max output.',
    contextWindow: 204800,
    maxCompletionTokens: 65536,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    chatPrice: { input: 0.60, output: 2.40, cache: { cType: 'oai-ac', read: 0.03 } },
  },

  // M2.1 series (legacy)
  {
    id: 'MiniMax-M2.1',
    label: 'MiniMax M2.1',
    description: '230B params (10B active), multilingual coding. 200K context, 65K max output.',
    contextWindow: 204800,
    maxCompletionTokens: 65536,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    chatPrice: { input: 0.30, output: 1.20, cache: { cType: 'oai-ac', read: 0.03 } },
    hidden: true, // yield to newer
  },
  {
    id: 'MiniMax-M2.1-highspeed',
    label: 'MiniMax M2.1 (Highspeed)',
    description: 'Faster M2.1 variant. 200K context, 65K max output.',
    contextWindow: 204800,
    maxCompletionTokens: 65536,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    chatPrice: { input: 0.60, output: 2.40, cache: { cType: 'oai-ac', read: 0.03 } },
    hidden: true, // yield to newer
  },

  // M2
  {
    id: 'MiniMax-M2',
    label: 'MiniMax M2',
    description: '230B params (10B active), agentic and reasoning. 200K context, 128K max output.',
    contextWindow: 204800,
    maxCompletionTokens: 128000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    chatPrice: { input: 0.30, output: 1.20, cache: { cType: 'oai-ac', read: 0.03 } },
    hidden: true, // yield to newer
  },

  // M1 - 1M context
  {
    id: 'MiniMax-M1',
    label: 'MiniMax M1',
    description: '456B total / 45.9B active MoE with lightning attention. 1M context, 40K max output.',
    contextWindow: 1000000,
    maxCompletionTokens: 40000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.40, output: 2.20 },
    hidden: true, // yield to newer
  },

  // MiniMax-01 - legacy
  {
    id: 'MiniMax-01',
    label: 'MiniMax 01',
    description: 'Legacy flagship. 1M context.',
    contextWindow: 1000192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.20, output: 1.10 },
    hidden: true, // yield to newer
  },

];


export function minimaxHardcodedModelDescriptions(): ModelDescriptionSchema[] {
  return _knownMiniMaxModels;
}