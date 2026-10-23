import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';
import { Release } from '~/common/app.release';

import type { ModelDescriptionSchema } from '../../llm.server.types';
import { llmDevCheckModels_DEV, llmsDefineModels, llmsLabelUncurated } from '../../models.mappings';

// --- MiniMax Model ID inference (auto-derived from _knownMiniMaxModels) ---
export type LlmsMiniMaxModelId = typeof _knownMiniMaxModels[number]['id'];


// [MiniMax] URL/host heuristic for OpenAI-compatible detection
export function minimaxHeuristic(urlOrHost: string | undefined): boolean {
  return !!urlOrHost && urlOrHost.includes('minimax.io');
}


/**
 * MiniMax curated models - /v1/models returns bare ids (no context/pricing/capabilities) and omits still-served ids, so this
 * table stays the catalog and the live list only adds 0-day arrivals (minimaxModelsToModelDescriptions).
 * - Models: https://platform.minimax.io/docs/release-notes/models.md
 * - Pricing: https://platform.minimax.io/docs/pricing/overview.md
 * - Text generation: https://platform.minimax.io/docs/guides/text-generation.md
 * - OpenAI-compatible reference (model enum, max_completion_tokens caps, thinking/service_tier): https://platform.minimax.io/docs/api-reference/text-chat-openai.md
 * - Updated: 2026-10-23
 */
type _MiniMaxModelDef = ModelDescriptionSchema & { pubDate: string };

const _knownMiniMaxModels = llmsDefineModels<_MiniMaxModelDef>()([

  // M3.1 Flash - efficient open-weight, natively multimodal, 1M context (2026-10-19). The retired 'MiniMax-M3.1-Flash-Preview' name is served as this model
  {
    id: 'MiniMax-M3.1-Flash',
    label: 'MiniMax M3.1 Flash',
    pubDate: '20261019',
    description: 'Efficient open-weight M-series model for agentic reasoning, tool use, coding and long-context tasks, natively multimodal (text, image, video input). 1M context, tunable thinking depth.',
    contextWindow: 1000000,
    maxCompletionTokens: 131072, // vendor-recommended; live ceiling is 524288 (512K)
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision],
    // [MiniMax, 2026-10-23] probed: always thinks (reasoning_effort 'none' and thinking.type 'disabled' 400), reasoning_effort allows low..max, vendor default 'max'
    parameterSpecs: [{ paramId: 'llmVndOaiEffort', enumValues: ['low', 'medium', 'high', 'xhigh', 'max'] }],
    chatPrice: { input: 0.15, output: 0.60, cache: { read: 0.015 } }, // flat; no service_tier
  },

  // M3 - flagship, natively multimodal, 1M context (2026-06-01)
  {
    id: 'MiniMax-M3',
    label: 'MiniMax M3',
    pubDate: '20260601',
    description: 'Flagship: frontier coding and agentic reasoning, natively multimodal (text, image, video input). 1M context, 131K max output.',
    contextWindow: 1000000,
    maxCompletionTokens: 131072, // vendor-recommended; live ceiling is 524288 (512K)
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision],
    // [MiniMax, 2026-08-24] no reasoning switch anymore: `reasoning_effort` is accepted-and-ignored (probed: 'none' still
    // emits a thinking block, an invalid value doesn't 400), so the none|high spec was inert and is gone. The documented
    // lever is `thinking: {type: 'disabled'|'adaptive'}` (probed, 0 reasoning tokens), which the 'openai' dialect won't send.
    // tiered PAYG pricing: boundary at 512K input tokens, >512K tier doubles. Priority tier (1.5x) not modeled.
    chatPrice: {
      input: [{ upTo: 512000, price: 0.30 }, { upTo: null, price: 0.60 }],
      output: [{ upTo: 512000, price: 1.20 }, { upTo: null, price: 2.40 }],
      cache: { read: [{ upTo: 512000, price: 0.06 }, { upTo: null, price: 0.12 }] },
    },
    benchmark: { cbaElo: 1444 }, // lmarena: minimax-m3
  },

  // M2.7 series - [MiniMax, 2026-10-19] closed to new users (probed: 404 'no longer available'), retires 2026-11-18. Kept hidden while
  // /v1/models still lists the M2.x ids: dropping them would resurface each as a '[?]' 0-day arrival.
  {
    id: 'MiniMax-M2.7',
    label: 'MiniMax M2.7',
    pubDate: '20260318',
    description: 'Recursive self-improvement and agentic capabilities. 200K context, 131K max output. ~60 t/s.',
    contextWindow: 204800,
    maxCompletionTokens: 131072,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    chatPrice: { input: 0.30, output: 1.20, cache: { read: 0.06 } },
    benchmark: { cbaElo: 1416 }, // lmarena: minimax-m2.7
    hidden: true, // retiring
  },
  {
    id: 'MiniMax-M2.7-highspeed',
    label: 'MiniMax M2.7 (Highspeed)',
    pubDate: '20260318',
    description: 'Faster M2.7 variant at ~100 t/s. 200K context, 131K max output.',
    contextWindow: 204800,
    maxCompletionTokens: 131072,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    chatPrice: { input: 0.60, output: 2.40, cache: { read: 0.06 } },
    benchmark: { cbaElo: 1416 }, // same weights as minimax-m2.7
    hidden: true, // retiring
  },

  // M2.5 series - same retirement as M2.7
  {
    id: 'MiniMax-M2.5',
    label: 'MiniMax M2.5',
    pubDate: '20260212',
    description: 'Strong coding and reasoning, best value. 200K context, 131K max output.',
    contextWindow: 204800,
    maxCompletionTokens: 131072,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    chatPrice: { input: 0.30, output: 1.20, cache: { read: 0.03 } },
    benchmark: { cbaElo: 1390 }, // lmarena: minimax-m2.5
    hidden: true, // retiring
  },
  {
    id: 'MiniMax-M2.5-highspeed',
    label: 'MiniMax M2.5 (Highspeed)',
    pubDate: '20260212',
    description: 'Faster M2.5 variant at ~100 t/s. 200K context, 131K max output.',
    contextWindow: 204800,
    maxCompletionTokens: 131072,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    chatPrice: { input: 0.60, output: 2.40, cache: { read: 0.03 } },
    benchmark: { cbaElo: 1390 }, // same weights as minimax-m2.5
    hidden: true, // retiring
  },

  // M2.1 series - retired (probed: 404 'no longer available'), still listed, kept hidden (see M2.7)
  {
    id: 'MiniMax-M2.1',
    label: 'MiniMax M2.1',
    pubDate: '20251222',
    description: '230B params (10B active), multilingual coding. 200K context, 131K max output.',
    contextWindow: 204800,
    maxCompletionTokens: 131072,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    chatPrice: { input: 0.30, output: 1.20, cache: { read: 0.03 } },
    hidden: true, // yield to newer
  },
  {
    id: 'MiniMax-M2.1-highspeed',
    label: 'MiniMax M2.1 (Highspeed)',
    pubDate: '20251222',
    description: 'Faster M2.1 variant. 200K context, 131K max output.',
    contextWindow: 204800,
    maxCompletionTokens: 131072,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    chatPrice: { input: 0.60, output: 2.40, cache: { read: 0.03 } },
    hidden: true, // yield to newer
  },

  // M2 - retired (probed: 404 'no longer available'), still listed, kept hidden (see M2.7)
  {
    id: 'MiniMax-M2',
    label: 'MiniMax M2',
    pubDate: '20251027',
    description: '230B params (10B active), agentic and reasoning. 200K context, 128K max output.',
    contextWindow: 204800,
    maxCompletionTokens: 128000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    chatPrice: { input: 0.30, output: 1.20, cache: { read: 0.03 } },
    hidden: true, // yield to newer
  },

  // M1 - 1M context. [MiniMax, 2026-08-17] dropped from the docs model table and the price list, still served (probed).
  {
    id: 'MiniMax-M1',
    label: 'MiniMax M1',
    pubDate: '20250616',
    description: '456B total / 45.9B active MoE with lightning attention. 1M context, 40K max output.',
    contextWindow: 1000000,
    maxCompletionTokens: 40000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    chatPrice: { input: 0.40, output: 2.20 },
    hidden: true, // yield to newer
  },

  // MiniMax-Text-01 - legacy. [MiniMax, 2026-08-17] dropped from the docs model table and the price list, still served (probed).
  {
    id: 'MiniMax-Text-01', // (!) not 'MiniMax-01', which is not served
    label: 'MiniMax Text 01',
    pubDate: '20250114',
    description: 'Legacy flagship. 1M context, 40K max output.',
    contextWindow: 1000192,
    maxCompletionTokens: 40000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.20, output: 1.10 },
    hidden: true, // yield to newer
  },

]);


// Served but never listed by /v1/models (probed 2026-10-23): two still-answering legacy ids. Exempt from the stale-defs drift check.
const _minimaxUnlistedIds: string[] = ['MiniMax-M1', 'MiniMax-Text-01'] satisfies LlmsMiniMaxModelId[];

/**
 * The curated table as-is, plus each listed id the table lacks as a visible '[?]' 0-day arrival with no context window (the
 * NVIDIA NIM convention): the app shows it at once, and the registry sync records and announces it without publishing it.
 * An empty list (the dispatch tolerates a failed or refused /v1/models) yields exactly the curated table.
 */
export function minimaxModelsToModelDescriptions(maybeModels: { id?: unknown }[]): ModelDescriptionSchema[] {
  const apiIds = maybeModels.map(m => m.id).filter((id): id is string => typeof id === 'string');
  const knownIds = new Set<string>(_knownMiniMaxModels.map(m => m.id));

  // [DEV] drift: stale curated entries and unknown arrivals (skipped on an empty list, which is a failed fetch, not a delisting)
  if (Release.IsNodeDevBuild && apiIds.length)
    llmDevCheckModels_DEV('MiniMax', apiIds, [...knownIds], { ignoreStale: _minimaxUnlistedIds });

  const arrivals = apiIds
    .filter(id => !knownIds.has(id))
    .map((id): ModelDescriptionSchema => ({
      id,
      label: llmsLabelUncurated(id),
      description: `New MiniMax arrival '${id}', not yet curated - capabilities and context window unverified.`,
      contextWindow: null,
      interfaces: [LLM_IF_OAI_Chat],
    }));

  // table order is the display order; 0-day arrivals sort last
  return [..._knownMiniMaxModels, ...arrivals];
}