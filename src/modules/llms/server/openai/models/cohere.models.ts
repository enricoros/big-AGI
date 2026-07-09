import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { KnownModel, llmsDefineModels, fromManualMapping } from '../../models.mappings';

// --- Cohere Model ID inference (auto-derived from _knownCohereModels) ---
export type LlmsCohereModelId = typeof _knownCohereModels[number]['idPrefix'];


// Cohere is accessed via its OpenAI-compatible endpoint (https://api.cohere.ai/compatibility/v1).
// - Chat Completions + Models list are standard OpenAI shapes (verified 2026-07-08).
// - Reasoning models emit `reasoning_content` (parsed by the shared OpenAI adapter).
// - Context windows below are the real tokenizer limits reported by the native /v1/models API
//   (which can differ from the rounded marketing numbers, e.g. Command A = 288k not 256k).
const _IF_Chat = [LLM_IF_OAI_Chat];
const _IF_Chat_Vision = [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision];
const _IF_Tools = [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn];
const _IF_Tools_Reasoning = [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning];
const _IF_Tools_Vision_Reasoning = [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning];

// Reasoning (thinking) control - the compat endpoint accepts `reasoning_effort` but ONLY 'none' and 'high'
// (verified 2026-07-08: 'low'/'medium' return HTTP 422 "Use 'high' instead"). 'none' disables thinking,
// 'high' enables it; unset = model default. The generic OpenAI adapter sends reasoning_effort verbatim for
// the 'cohere' dialect (openai.chatCompletions.ts), so we constrain the enum here to the two valid values.
// FC note: these thinking-capable Command models support tools in auto mode, but reject a forced/explicit
// `tool_choice` with HTTP 400 "tool_choice is not supported for this model" (verified 2026-07-09) - so the
// /dev/llms probe shows FC(auto)+roundtrip OK but FC(required) ERR. FC is still correctly declared (auto works).
const _PS_Reasoning: ModelDescriptionSchema['parameterSpecs'] = [
  { paramId: 'llmVndMiscEffort', enumValues: ['none', 'high'] },
] as const;


// [Cohere] Known Models - Manual Mappings
// Also used for prefix-matching 0-day API-discovered models.
// pubDate is derived from the dated model ID where available (YYYYMMDD); omitted when unknown.
// chatPrice is set only where Cohere publishes per-token prices; newer/agentic models are
// "contact sales" or free-until-limits, so we leave chatPrice unset rather than invent numbers.
type _CohereModelDef = KnownModel;

const _knownCohereModels = llmsDefineModels<_CohereModelDef>()([

  // Command A Plus - current flagship (reasoning + vision + agents)
  {
    idPrefix: 'command-a-plus-05-2026',
    label: 'Command A Plus',
    pubDate: '20260501',
    description: 'Cohere flagship. Agentic reasoning with vision, tool use, and long-context RAG. 436K context, 64K output. Thinking enabled by default.',
    contextWindow: 436000,
    interfaces: _IF_Tools_Vision_Reasoning,
    maxCompletionTokens: 64000, // API-enforced ceiling (verified 2026-07-08)
    parameterSpecs: _PS_Reasoning,
    initialTemperature: 0.6, // Cohere sampling default for command-a-plus
    // chatPrice: contact sales / not publicly published
  },

  // Command A Reasoning
  {
    idPrefix: 'command-a-reasoning-08-2025',
    label: 'Command A Reasoning',
    pubDate: '20250801',
    description: 'Reasoning-tuned Command A for multi-step agents and hard problem solving across 23 languages. 288K context, 32K output.',
    contextWindow: 288768,
    interfaces: _IF_Tools_Reasoning,
    maxCompletionTokens: 32768,
    parameterSpecs: _PS_Reasoning,
    chatPrice: { input: 2.5, output: 10 },
    initialTemperature: 0.6, // Cohere sampling default for command-a-reasoning
  },

  // Command A - flagship text (Mar 2025)
  {
    idPrefix: 'command-a-03-2025',
    label: 'Command A',
    pubDate: '20250313',
    description: 'Cohere\'s efficient 111B enterprise model for agents, tool use, and multilingual RAG. Strong performance on 2 GPUs. 288K context.',
    contextWindow: 288000,
    interfaces: _IF_Tools,
    maxCompletionTokens: 8192,
    chatPrice: { input: 2.5, output: 10 },
    initialTemperature: 0.3,
  },

  // Command A Vision
  {
    idPrefix: 'command-a-vision-07-2025',
    label: 'Command A Vision',
    pubDate: '20250701',
    description: 'Multimodal Command A for charts, graphs, diagrams, OCR, and document understanding across 6 languages. 128K context. No tool use.',
    contextWindow: 128000,
    interfaces: _IF_Chat_Vision, // API rejects tool use on this model ("tool use is not supported", verified 2026-07-08)
    maxCompletionTokens: 8192,
    initialTemperature: 0.3,
    // chatPrice: free until rate limits / contact sales for production
  },

  // North Mini Code - agentic coding (North platform)
  {
    idPrefix: 'north-mini-code-1-0',
    label: 'North Mini Code',
    description: 'Compact agentic coding model from Cohere\'s North platform. Reasoning and tool use over very long context (436K).',
    contextWindow: 436000,
    interfaces: _IF_Tools_Reasoning,
    maxCompletionTokens: 64000, // API-enforced ceiling (verified 2026-07-08)
    parameterSpecs: _PS_Reasoning,
    initialTemperature: 0.6, // Cohere sampling default for north-mini-code
    // chatPrice: North platform / not publicly published
  },

  // Command R+ (Aug 2024) - prior-gen flagship
  {
    idPrefix: 'command-r-plus-08-2024',
    label: 'Command R+ (08-2024)',
    pubDate: '20240801',
    description: 'Prior-generation flagship for RAG, tool use, and multi-step agents. 128K context. Superseded by Command A.',
    contextWindow: 128000,
    interfaces: _IF_Tools,
    maxCompletionTokens: 4096,
    chatPrice: { input: 2.5, output: 10 },
    initialTemperature: 0.3,
    isLegacy: true,
  },

  // Command R (Aug 2024)
  {
    idPrefix: 'command-r-08-2024',
    label: 'Command R (08-2024)',
    pubDate: '20240801',
    description: 'Cost-efficient model for RAG, tool use, and agents. 128K context. Superseded by Command A.',
    contextWindow: 128000,
    interfaces: _IF_Tools,
    maxCompletionTokens: 4096,
    chatPrice: { input: 0.15, output: 0.6 },
    initialTemperature: 0.3,
    isLegacy: true,
  },

  // Command R7B (Dec 2024) - smallest R-series
  {
    idPrefix: 'command-r7b-12-2024',
    label: 'Command R7B',
    pubDate: '20241201',
    description: 'Smallest, fastest R-series model. Efficient RAG, tool use, and on-device workloads. 132K context.',
    contextWindow: 132000,
    interfaces: _IF_Tools,
    maxCompletionTokens: 4096,
    chatPrice: { input: 0.0375, output: 0.15 },
    initialTemperature: 0.3,
  },

  // Command R7B Arabic - language-specialized variant (hidden by default)
  {
    idPrefix: 'command-r7b-arabic-02-2025',
    label: 'Command R7B Arabic',
    pubDate: '20250201',
    description: 'Command R7B tuned for Modern Standard Arabic and English enterprise use cases. 128K context.',
    contextWindow: 128000,
    interfaces: _IF_Tools,
    maxCompletionTokens: 4096,
    chatPrice: { input: 0.0375, output: 0.15 },
    initialTemperature: 0.3,
    hidden: true,
  },

  // Command A Translate - specialized translation (hidden by default)
  {
    idPrefix: 'command-a-translate-08-2025',
    label: 'Command A Translate',
    pubDate: '20250801',
    description: 'Specialized machine translation across 23 languages, with tool use and JSON output. 8K context.',
    contextWindow: 8992,
    interfaces: _IF_Tools,
    maxCompletionTokens: 8000, // API-enforced ceiling (verified 2026-07-08)
    initialTemperature: 0.3,
    hidden: true,
  },

  // Aya Expanse 32B - multilingual research
  {
    idPrefix: 'c4ai-aya-expanse-32b',
    label: 'Aya Expanse 32B',
    pubDate: '20241001',
    description: 'Open-weights multilingual research model covering 23 languages. 128K context. Text only.',
    contextWindow: 128000,
    interfaces: _IF_Chat,
    maxCompletionTokens: 4096,
    chatPrice: { input: 0.5, output: 1.5 },
    initialTemperature: 0.3,
  },

  // Aya Vision 32B - multilingual vision research
  {
    idPrefix: 'c4ai-aya-vision-32b',
    label: 'Aya Vision 32B',
    description: 'Open-weights multilingual vision research model (23 languages) with image understanding. 16K context.',
    contextWindow: 16384,
    interfaces: _IF_Chat_Vision,
    maxCompletionTokens: 4096,
    chatPrice: { input: 0.5, output: 1.5 },
    initialTemperature: 0.3,
  },

  // Tiny Aya - research minis (hidden by default)
  {
    idPrefix: 'tiny-aya-global',
    label: 'Tiny Aya Global',
    description: 'Tiny multilingual research model. 8K context. Text only.',
    contextWindow: 8192,
    interfaces: _IF_Chat, // native 'tools' feature is advertised but FC does not fire (returns text) - verified 2026-07-09
    maxCompletionTokens: 8192,
    initialTemperature: 0.3,
    hidden: true,
  },

]);


/// Denylist prefixes: non-chat endpoints returned by the compat /v1/models list
/// (embeddings, rerankers, transcription) - never surface these as chat models.
const _cohereNonChatPrefixes: string[] = ['embed-', 'rerank-', 'cohere-transcribe'];

/** Keep only chat-capable models from the compat /v1/models list (drops embed/rerank/transcribe). */
export function cohereModelFilter(cohereModelId: string): boolean {
  return !_cohereNonChatPrefixes.some(prefix => cohereModelId.startsWith(prefix));
}

/** Map an API model id to a description via manual mappings (rich caps/pricing/params), with a hidden fallback for 0-day models. */
export function cohereModelToModelDescription(cohereModelId: string): ModelDescriptionSchema {
  return fromManualMapping(_knownCohereModels, cohereModelId, undefined, undefined, {
    idPrefix: cohereModelId,
    label: cohereModelId.replaceAll(/[_-]/g, ' '),
    description: 'New Cohere Model',
    contextWindow: 128000,
    maxCompletionTokens: 4096,
    interfaces: [LLM_IF_OAI_Chat],
    hidden: true,
  });
}

export function cohereModelSort(a: ModelDescriptionSchema, b: ModelDescriptionSchema) {
  // sort by the order in the known models list
  const aIndex = _knownCohereModels.findIndex(m => a.id.startsWith(m.idPrefix));
  const bIndex = _knownCohereModels.findIndex(m => b.id.startsWith(m.idPrefix));
  if (aIndex !== -1 && bIndex !== -1)
    return aIndex - bIndex;
  // known models before unknown
  if (aIndex !== -1) return -1;
  if (bIndex !== -1) return 1;
  return a.id.localeCompare(b.id);
}
