import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';
import { llmsDefineModels } from '../../models.mappings';

// --- MiniMax Model ID inference (auto-derived from _knownMiniMaxModels) ---
export type LlmsMiniMaxModelId = typeof _knownMiniMaxModels[number]['id'];


// [MiniMax] URL/host heuristic for OpenAI-compatible detection
export function minimaxHeuristic(urlOrHost: string | undefined): boolean {
  return !!urlOrHost && urlOrHost.includes('minimax.io');
}


/**
 * MiniMax hardcoded models - no /v1/models API yet.
 * - Models: https://platform.minimax.io/docs/release-notes/models.md
 * - Pricing: https://platform.minimax.io/docs/guides/pricing-paygo.md
 * - Text generation: https://platform.minimax.io/docs/guides/text-generation.md
 * - Updated: 2026-06-01
 */
const _knownMiniMaxModels = llmsDefineModels<ModelDescriptionSchema>()([

  // M3 - flagship, natively multimodal, 1M context (2026-05-31)
  {
    id: 'MiniMax-M3',
    label: 'MiniMax M3',
    pubDate: '20260531',
    description: 'Flagship: frontier coding and agentic reasoning, natively multimodal (text, image, video input). 1M context, 131K max output.',
    contextWindow: 1000000,
    maxCompletionTokens: 131072,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision],
    // standard PAYG pricing; 7-day launch promo (until ~2026-06-07) halves these to 0.30 / 1.20 / read 0.06
    chatPrice: { input: 0.60, output: 2.40, cache: { cType: 'oai-ac', read: 0.12 } },
  },

  // M2.7 series
  {
    id: 'MiniMax-M2.7',
    label: 'MiniMax M2.7',
    pubDate: '20260318',
    description: 'Recursive self-improvement and agentic capabilities. 200K context, 131K max output. ~60 t/s.',
    contextWindow: 204800,
    maxCompletionTokens: 131072,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    chatPrice: { input: 0.30, output: 1.20, cache: { cType: 'oai-ac', read: 0.06 } },
  },
  {
    id: 'MiniMax-M2.7-highspeed',
    label: 'MiniMax M2.7 (Highspeed)',
    pubDate: '20260318',
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
    pubDate: '20260212',
    description: 'Strong coding and reasoning, best value. 200K context, 65K max output.',
    contextWindow: 204800,
    maxCompletionTokens: 65536,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    chatPrice: { input: 0.30, output: 1.20, cache: { cType: 'oai-ac', read: 0.03 } },
  },
  {
    id: 'MiniMax-M2.5-highspeed',
    label: 'MiniMax M2.5 (Highspeed)',
    pubDate: '20260212',
    description: 'Faster M2.5 variant at ~100 t/s. 200K context, 65K max output.',
    contextWindow: 204800,
    maxCompletionTokens: 65536,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    chatPrice: { input: 0.60, output: 2.40, cache: { cType: 'oai-ac', read: 0.03 } },
  },

  // M2-her - dialogue-first, roleplay and character-driven chat (Jan 2026)
  {
    id: 'MiniMax-M2-her',
    label: 'MiniMax M2-her',
    pubDate: '20260127',
    description: 'Dialogue-first model for immersive roleplay, character-driven chat, and expressive multi-turn conversations. 64K context.',
    contextWindow: 65536,
    maxCompletionTokens: 2048,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.30, output: 1.20 },
  },

  // M2.1 series (legacy)
  {
    id: 'MiniMax-M2.1',
    label: 'MiniMax M2.1',
    pubDate: '20251223',
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
    pubDate: '20251223',
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
    pubDate: '20251027',
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
    pubDate: '20250616',
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
    pubDate: '20250114',
    description: 'Legacy flagship. 1M context.',
    contextWindow: 1000192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.20, output: 1.10 },
    hidden: true, // yield to newer
  },

]);


export function minimaxHardcodedModelDescriptions(): ReadonlyArray<ModelDescriptionSchema> {
  return _knownMiniMaxModels;
}