import { LLM_IF_HOTFIX_StripImages, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { llmsDefineManualMappings, fromManualMapping } from '../../models.mappings';

// --- Deepseek Model ID inference (auto-derived from _knownDeepseekChatModels) ---
export type LlmsDeepseekModelId = typeof _knownDeepseekChatModels[number]['idPrefix'];


const IF_4 = [LLM_IF_HOTFIX_StripImages, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn];

// [DeepSeek, 2026-07-31] V4-Flash 0731: re-post-trained, swapped IN PLACE - https://api-docs.deepseek.com/updates/
// - Same 'deepseek-v4-flash' id, same arch/size/pricing, public beta. Reported agentic gains are vs V4-Pro-Preview on
//   an unreleased harness: direction, not ranking. V4-Pro untouched: official release still pending, effort mapping
//   as documented (rechecked 2026-08-06).
// - Unpinnable: swept id spellings, separators, /beta + /v1 bases, dated base paths, request fields and version headers
//   - all rejected or ignored. April weights survive only off-DeepSeek via the open weights; 0731 has no HF repo.
// - Responses API (/responses) is flash-only: pro 400s with 'available starting early August 2026'. The Anthropic-format
//   base https://api.deepseek.com/anthropic serves both models.
// - Undated: 2x peak-hour pricing (Beijing 09-12, 14-18) is announced but NOT live - the rate card is still flat as of
//   2026-08-06, and now warns of a significant overall rise. chatPrice below is that flat rate; we have no time dimension.
// - Docs need a TRAILING SLASH, else Docusaurus serves a shell.

// [DeepSeek, 2026-04-24] V4 release - https://api-docs.deepseek.com/news/news260424
// - V4-Pro: 1.6T total / 49B active params; V4-Flash: 284B total / 13B active params (Novel Attention: token-wise compression + DSA)
// - Model IDs listed by /models: deepseek-v4-flash, deepseek-v4-pro
// - 1M context is the default across services; text-only (image parts rejected at the schema level)
// - Legacy aliases: announced for retirement 2026-07-24 but still answering (on 0731 weights); absent from /models, so
//   the entries below are documentation only. May die without notice.
// - Reasoning: two SEPARATE top-level fields, `thinking: { type: 'enabled'|'disabled' }` and `reasoning_effort`
//   (nesting the effort inside `thinking` is silently ignored). Live enum none|minimal|low|medium|high|xhigh|max;
//   we expose the documented low/high/max, as 'xhigh' is byte-identical to 'high' on flash
//   (the live API also accepts type: 'adaptive', but it is undocumented and empirically behaves the same as 'enabled'
//    on current builds -- deliberately not exposed here; add it once docs + semantics stabilize)
// - Forced tool calls 400 while thinking is on ("Thinking mode does not support this tool_choice"), on both v4 models;
//   only 'auto'/'none' work. Worked around in openai.chatCompletions.ts
// - V3.2 endpoints no longer accessible via direct model ID (API returns only v4-flash/v4-pro)
const _knownDeepseekChatModels = llmsDefineManualMappings([
  {
    idPrefix: 'deepseek-v4-pro',
    label: 'DeepSeek V4 Pro',
    pubDate: '20260424',
    description: 'Premium reasoning model with 1M context. Supports extended thinking modes, JSON output, and function calling.',
    contextWindow: 1_048_576, // 1M
    interfaces: [...IF_4, LLM_IF_OAI_Reasoning],
    parameterSpecs: [
      // 'low' is wire-valid here too, but docs map it onto 'high' (still identical on 2026-08-06); revisit at pro's official release
      { paramId: 'llmVndMiscEffort', enumValues: ['none', 'high', 'max'] },
    ],
    maxCompletionTokens: 131072, // house cap; live ceiling is 393216 (384K)
    chatPrice: { input: 0.435, output: 0.87, cache: { cType: 'oai-ac', read: 0.003625 } },
    benchmark: { cbaElo: 1457 }, // lmarena: deepseek-v4-pro
  },
  {
    idPrefix: 'deepseek-v4-flash',
    label: 'DeepSeek V4 Flash (0731)', // house-added tag: the API id is undated, so this is the only place the build shows
    // note: keeping the former pubdate even tho DeepSeek has rolled the model
    // - 0731 re-post-trained revision, swapped in place behind the same model id
    // - 0424 initial launch and the time the benchamrk scores were assessed
    pubDate: '20260424',
    description: 'Fast general-purpose model with 1M context, re-post-trained by DeepSeek on 2026-07-31 for agentic and coding tasks. Supports extended thinking modes, JSON output, and function calling.',
    contextWindow: 1_048_576, // 1M
    interfaces: [...IF_4, LLM_IF_OAI_Reasoning],
    parameterSpecs: [
      // 'low' keeps reasoning on yet skips the hidden agentic preamble (5 vs 84 prompt tokens), so it is cheaper per request
      { paramId: 'llmVndMiscEffort', enumValues: ['none', 'low', 'high', 'max'] },
    ],
    maxCompletionTokens: 131072, // house cap; live ceiling is 393216 (384K)
    chatPrice: { input: 0.14, output: 0.28, cache: { cType: 'oai-ac', read: 0.0028 } },
    benchmark: { cbaElo: 1436 }, // lmarena: deepseek-v4-flash (distinct from the -high-preview entry, 1438)
  },
  // Legacy aliases - API routes both to deepseek-v4-flash with thinking pre-set
  {
    idPrefix: 'deepseek-reasoner',
    label: 'DeepSeek Reasoner (legacy)',
    description: 'Legacy alias: routes to DeepSeek V4 Flash with thinking enabled. Past its announced 2026-07-24 retirement, still served.',
    contextWindow: 1_048_576,
    interfaces: [...IF_4, LLM_IF_OAI_Reasoning],
    maxCompletionTokens: 65536,
    chatPrice: { input: 0.14, output: 0.28, cache: { cType: 'oai-ac', read: 0.0028 } },
    benchmark: { cbaElo: 1436 - 1 }, // lmarena: deepseek-v4-flash - 1 (yield)
    isLegacy: true,
  },
  {
    idPrefix: 'deepseek-chat',
    label: 'DeepSeek Chat (legacy)',
    description: 'Legacy alias: routes to DeepSeek V4 Flash with thinking disabled. Past its announced 2026-07-24 retirement, still served.',
    contextWindow: 1_048_576,
    interfaces: IF_4,
    maxCompletionTokens: 65536,
    chatPrice: { input: 0.14, output: 0.28, cache: { cType: 'oai-ac', read: 0.0028 } },
    benchmark: { cbaElo: 1436 - 2 }, // lmarena: deepseek-v4-flash - 2 (yield)
    isLegacy: true,
  },
]);

const _unsupportedModelIds = [
  'deepseek-coder',
];

export function deepseekModelFilter(deepseekModelId: string) {
  return !_unsupportedModelIds.includes(deepseekModelId);
}

export function deepseekModelToModelDescription(deepseekModelId: string): ModelDescriptionSchema {
  return fromManualMapping(_knownDeepseekChatModels, deepseekModelId, undefined, undefined, {
    idPrefix: deepseekModelId,
    label: deepseekModelId.replaceAll(/[_-]/g, ' '),
    description: 'New Deepseek Model',
    contextWindow: 128000,
    maxCompletionTokens: 4096,
    interfaces: [LLM_IF_OAI_Chat],
    hidden: true,
  });
}

export function deepseekModelSort(a: ModelDescriptionSchema, b: ModelDescriptionSchema) {
  // sort by the order in the known models list
  const aIndex = _knownDeepseekChatModels.findIndex(m => a.id.startsWith(m.idPrefix));
  const bIndex = _knownDeepseekChatModels.findIndex(m => b.id.startsWith(m.idPrefix));
  if (aIndex !== -1 && bIndex !== -1)
    return aIndex - bIndex;
  return a.id.localeCompare(b.id);
}


// [DeepSeek, 2025-12-15] V3.2-Speciale endpoint has expired and been removed
// The temporary endpoint (v3.2_speciale_expires_on_20251215) was decommissioned on Dec 15, 2025 15:59 UTC
// To re-enable variants, use createVariantInjector() from llm.server.variants.ts
