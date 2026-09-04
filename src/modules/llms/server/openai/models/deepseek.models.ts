import { LLM_IF_HOTFIX_StripImages, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { llmsDefineManualMappings, fromManualMapping, llmsLabelUncurated } from '../../models.mappings';

// --- Deepseek Model ID inference (auto-derived from _knownDeepseekChatModels) ---
export type LlmsDeepseekModelId = typeof _knownDeepseekChatModels[number]['idPrefix'];


const IF_4 = [LLM_IF_HOTFIX_StripImages, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn];

// [DeepSeek, 2026-08-31] Verification pass, all unchanged: /models now lists vision-exp too (three ids); release
// notes end at 08-21; pricing card + MODEL VERSION rows (0731/0813) unchanged; all three system_fingerprints match
// the baselines below (no in-place swaps); legacy aliases still answer.

// [DeepSeek, 2026-08-21] V4-Flash-Vision-Exp: first vision model - https://api-docs.deepseek.com/updates/
// - Probed 2026-08-24: image input works, with and without thinking; otherwise flash-identical (effort enum + 'low'
//   preamble skip, 384K ceiling, tool_choice-under-thinking 400, /responses + Anthropic base). Fingerprint
//   aa8d6caccae4a22492bb51091cfc8eab; flash/pro unchanged (no swaps); legacy aliases still answer.
// - Fixes opensource #1181: without an exact entry the id prefix-matched 'deepseek-v4-flash' ('super' resolution)
//   and inherited LLM_IF_HOTFIX_StripImages - the client itself stripped the images before sending.

// [DeepSeek, 2026-08-17] Peak/off-peak pricing landed - https://api-docs.deepseek.com/quick_start/pricing/
// - The flat card is gone as of 2026-08-16 16:00 UTC. Peak is 01:00-04:00 and 06:00-10:00 UTC, Mon-Fri (weekday
//   qualifier on the pricing page by 2026-08-24), off-peak is exactly half everywhere else. pro cache-hit/miss/output: peak 0.044/1.32/3.96, off-peak 0.022/0.66/1.98; flash:
//   peak 0.014/0.44/1.32, off-peak 0.007/0.22/0.66. The retired flat card was pro 0.435/0.87, flash 0.14/0.28.
// - chatPrice below carries the PEAK card: there is no time dimension in the pricing schema, so we take the upper
//   bound and never under-show cost (off-peak requests are over-shown 2x). Revisit if the schema ever gains one.
// - Re-probed today, all unchanged: /models serves only deepseek-v4-flash + deepseek-v4-pro; both answer on /responses
//   and on the Anthropic base; live reasoning_effort enum is still none|minimal|low|medium|high|xhigh|max; max_tokens
//   range [1, 393216]; forced tool_choice still 400s while thinking is on; image parts still rejected at the schema
//   level; both system_fingerprints unchanged; both legacy aliases still answer, routed to deepseek-v4-flash.

// [DeepSeek, 2026-08-13] V4-Pro 0813: GA release, swapped IN PLACE - https://api-docs.deepseek.com/updates/
// - Same 'deepseek-v4-pro' id ("simply set the model name to deepseek-v4-pro"); the pricing page MODEL VERSION row now
//   reads DeepSeek-V4-Pro-0813. Dated ids 400 ("The supported API model names are deepseek-v4-pro or deepseek-v4-flash"),
//   so it is unpinnable here; only aggregators (OpenRouter, DashScope, Fireworks) carry a dated id.
// - Preview architecture unchanged (1.6T/49B) plus a DSpark speculative-decoding module, re-post-trained for agentic
//   work; open weights MIT on HF (deepseek-ai/DeepSeek-V4-Pro-0813). Gains are agentic (DeepSWE 12.8 -> 62.7, Terminal
//   Bench 2.1 72.1 -> 87.9), raw knowledge barely moved (HLE no-tools 37.7 -> 42.7).
// - Pro's effort mapping now matches flash: 'low' is a real cheaper tier, skipping the ~79-token hidden agentic preamble
//   (8 vs 87 prompt tokens on the same request). /responses serves pro too now (was 400 'available starting early August 2026').
// - Baseline for spotting the NEXT in-place swap, as no other tell exists: system_fingerprint is stable per model,
//   a307abda487cd1b463329ccb945ce396 (pro) / a26a7955944dc5c60445bff77fac9c8e (flash). Self-report is worthless
//   (pro claims to be V3, or Claude, or Qwen, depending on the host).

// [DeepSeek, 2026-07-31] V4-Flash 0731: re-post-trained, swapped IN PLACE - https://api-docs.deepseek.com/updates/
// - Same 'deepseek-v4-flash' id, same arch/size/pricing, public beta. Reported agentic gains are vs V4-Pro-Preview on
//   an unreleased harness: direction, not ranking.
// - Unpinnable: swept id spellings, separators, /beta + /v1 bases, dated base paths, request fields and version headers
//   - all rejected or ignored. April weights survive only off-DeepSeek via the open weights; 0731 has its own HF repo
//   too (deepseek-ai/DeepSeek-V4-Flash-0731, created on release day).
// - The Anthropic-format base https://api.deepseek.com/anthropic serves both models.
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
    label: 'DeepSeek V4 Pro (0813)', // house-added tag: the API id is undated, so this is the only place the build shows
    // note: keeping the former pubdate even tho DeepSeek has rolled the model
    // - 0813 GA release, swapped in place behind the same model id
    // - 0424 preview launch and the time the benchmark scores were assessed
    pubDate: '20260424',
    description: 'Premium reasoning model with 1M context, released GA by DeepSeek on 2026-08-13 with much stronger agentic and tool-use behavior. Supports extended thinking modes, JSON output, and function calling.',
    contextWindow: 1_048_576, // 1M
    interfaces: [...IF_4, LLM_IF_OAI_Reasoning],
    parameterSpecs: [
      // 'low' keeps reasoning on yet skips the hidden agentic preamble (8 vs 87 prompt tokens), so it is cheaper per request
      { paramId: 'llmVndMiscEffort', enumValues: ['none', 'low', 'high', 'max'] },
    ],
    maxCompletionTokens: 131072, // house cap; live ceiling is 393216 (384K)
    chatPrice: { input: 1.32, output: 3.96, cache: { read: 0.044 } }, // peak card
    benchmark: { cbaElo: 1458 }, // lmarena: deepseek-v4-pro (preview-era votes, 54k since 0424; the only 0813 row, -max-20260813, is AutoEval-only at 1465, unranked)
  },
  {
    idPrefix: 'deepseek-v4-flash',
    label: 'DeepSeek V4 Flash (0731)', // house-added tag: the API id is undated, so this is the only place the build shows
    // note: keeping the former pubdate even tho DeepSeek has rolled the model
    // - 0731 re-post-trained revision, swapped in place behind the same model id
    // - 0424 initial launch and the time the benchmark scores were assessed
    pubDate: '20260424',
    description: 'Fast general-purpose model with 1M context, re-post-trained by DeepSeek on 2026-07-31 for agentic and coding tasks. Supports extended thinking modes, JSON output, and function calling.',
    contextWindow: 1_048_576, // 1M
    interfaces: [...IF_4, LLM_IF_OAI_Reasoning],
    parameterSpecs: [
      // 'low' keeps reasoning on yet skips the hidden agentic preamble (5 vs 84 prompt tokens), so it is cheaper per request
      { paramId: 'llmVndMiscEffort', enumValues: ['none', 'low', 'high', 'max'] },
    ],
    maxCompletionTokens: 131072, // house cap; live ceiling is 393216 (384K)
    chatPrice: { input: 0.44, output: 1.32, cache: { read: 0.014 } }, // peak card
    benchmark: { cbaElo: 1435 }, // lmarena: deepseek-v4-flash (distinct from the -high-preview entry, 1438)
  },
  {
    idPrefix: 'deepseek-v4-flash-vision-exp',
    label: 'DeepSeek V4 Flash Vision (Exp)',
    isPreview: true,
    pubDate: '20260821',
    description: 'Experimental vision variant of V4 Flash with 1M context, released by DeepSeek on 2026-08-21. Adds image understanding while matching V4 Flash text capabilities. Supports extended thinking modes, JSON output, and function calling.',
    contextWindow: 1_048_576, // 1M
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning],
    parameterSpecs: [
      // 'low' keeps reasoning on yet skips the hidden agentic preamble (6 vs 85 prompt tokens), so it is cheaper per request
      { paramId: 'llmVndMiscEffort', enumValues: ['none', 'low', 'high', 'max'] },
    ],
    maxCompletionTokens: 131072, // house cap; live ceiling is 393216 (384K)
    chatPrice: { input: 0.44, output: 1.32, cache: { read: 0.014 } }, // peak card, same as flash; images billed as input tokens by dimensions
    // no benchmark: not on lmarena yet (released 2026-08-21)
  },
  // Legacy aliases - API routes both to deepseek-v4-flash with thinking pre-set
  {
    idPrefix: 'deepseek-reasoner',
    label: 'DeepSeek Reasoner (legacy)',
    description: 'Legacy alias: routes to DeepSeek V4 Flash with thinking enabled. Past its announced 2026-07-24 retirement, still served.',
    contextWindow: 1_048_576,
    interfaces: [...IF_4, LLM_IF_OAI_Reasoning],
    maxCompletionTokens: 65536,
    chatPrice: { input: 0.44, output: 1.32, cache: { read: 0.014 } }, // peak card
    benchmark: { cbaElo: 1435 - 1 }, // lmarena: deepseek-v4-flash - 1 (yield)
    isLegacy: true,
  },
  {
    idPrefix: 'deepseek-chat',
    label: 'DeepSeek Chat (legacy)',
    description: 'Legacy alias: routes to DeepSeek V4 Flash with thinking disabled. Past its announced 2026-07-24 retirement, still served.',
    contextWindow: 1_048_576,
    interfaces: IF_4,
    maxCompletionTokens: 65536,
    chatPrice: { input: 0.44, output: 1.32, cache: { read: 0.014 } }, // peak card
    benchmark: { cbaElo: 1435 - 2 }, // lmarena: deepseek-v4-flash - 2 (yield)
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
    label: llmsLabelUncurated(deepseekModelId.replaceAll(/[_-]/g, ' ')),
    description: 'New DeepSeek arrival, not yet curated - capabilities and context window unverified.',
    contextWindow: null,
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
