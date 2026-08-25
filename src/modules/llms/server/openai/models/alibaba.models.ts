import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { fromManualMapping, llmsDefineManualMappings, llmsLabelUncurated } from '../../models.mappings';

// --- Alibaba Model ID inference (auto-derived from _knownAlibabaChatModels) ---
export type LlmsAlibabaModelId = typeof _knownAlibabaChatModels[number]['idPrefix'];

// Sources (verified 2026-08-24 against the live /v1/models list + docs):
// - Models:  https://www.alibabacloud.com/help/en/model-studio/models
// - Pricing: https://www.alibabacloud.com/help/en/model-studio/model-pricing (International/Singapore, USD per 1M tokens)
// - Per-model pages carry the authoritative caps + cache-hit price, e.g. https://www.alibabacloud.com/help/en/model-studio/qwen3-8-max
// - Cache:   https://www.alibabacloud.com/help/en/model-studio/context-cache (implicit hit = 20% of input; explicit create 125% / hit 10%; deepseek-v4-pro excepted)
// 2026-08-24 pass: two ids DashScope started serving after the 08-17 pass are curated - qwen3.8-27b (open weights Apache-2.0
//   2026-08-14, model page 08-19 + live probes) and kimi-k3 (Moonshot flagship, model page 08-24; effort ladder live-ablated
//   -> _PS_KimiEffort). No retirements and zero price drift on the Intl tables (which still predate the whole qwen3.8 line).
//   'ZHIPU/GLM-5.3' now appears on the list but 403s with 'The product is not activated', has no model page (404) and no price
//   row - left uncurated (hidden) pending activation.
// 2026-08-17 pass (Qwen): live list identical to the 08-14 triage (no new ids, no retirements, zero uncurated) and no price drift
//   on the Intl table; qwen3.8-* gain the real reasoning_effort ladder (_PS_Qwen38Effort, ablated) and qwen3.8-2.4t-a95b is
//   thinking-compulsory, so it drops the Off value; that model page is now published and confirms the caps/price we had taken
//   from OpenRouter. Qwen3.8-27B (open weights, Apache-2.0, 2026-08-14) is not served by DashScope - hosts only. ELOs refreshed.
// 2026-08-16 pass (GLM only): glm-5.3 (Z.ai release 2026-08-14) NOT on the intl list yet - re-probe before adding; the three GLM
//   ids re-verified live (no retirements, no price drift); glm-5.1 context 204800 -> 202745 (model page + probe); glm-5.2 gains
//   the reasoning_effort ladder (_PS_GlmEffort, ablated).
// 2026-08-14 triage: deny list added (retired 2025-era lines dropped from the list entirely) + short-form curation for every
//   other live chat id: qwen3.8-2.4t-a95b (open-weights flagship) and qwen3-coder-next visible; the qwen3.5/3.6 generations,
//   qwen3-max/-vl-flash/-coder-flash, and glm-5.1 hidden. Zero uncurated ('[?]') ids remain against the live list.
// 2026-08-14 pass (DeepSeek only): deepseek-v4-pro-0813 curated + made visible by exception (see below); deepseek-v4-flash-0731
//   curated but hidden; DeepSeek-V4 output cap 64K -> 128K house cap (both model pages state 393216). Qwen rows re-checked, unchanged.
// 2026-08-06 pass: qwen3.7-flash repriced to its real 3-tier rates - the 0.25/1.50 was qwen3.6-flash's, the model is still absent from the
//   Intl pricing page (tiers on its model page + Alibaba's own OpenRouter endpoint agree); qwen3.7-max output cap 64K -> 128K; DeepSeek-V4
//   context 1,048,576 -> 1,000,000 (what Alibaba serves); arena ELOs refreshed; qwen3.8-max caps/price re-confirmed on its model page.
// NOTES:
// - The live API returns only id/created/owned_by (no pricing/caps/context), so EVERYTHING here is editorial.
// - Alibaba uses tiered pricing keyed on the request's INPUT token count (both input and output prices step up).
// - Policy: curate the current best-per-tier lineup only; all uncatalogued models, dated snapshots
//   (-YYYY-MM-DD / -2507), and -preview/-latest aliases are hidden, UNLESS curated verbatim below - an exact
//   entry is an explicit editorial pick and carries its own `hidden` (see alibabaModelToModelDescription).
//   Retired lines are denied outright in alibabaModelFilter (_ALIBABA_DENY_LIST) and never listed.
// - Thinking control: thinking-capable models expose a 'Thinking' toggle (Off/On; unset = vendor default, usually on)
//   via _PS_Thinking, mapped to Qwen's `enable_thinking` in the 'alibaba' dialect (openai.chatCompletions.ts).
//   Verified live on qwen3.x + DashScope-hosted DeepSeek-V4 / GLM-5.2. Kimi K2.7 Code is always-on (reasoning flag, no toggle).

// 'Thinking' toggle backed by Qwen's binary enable_thinking - renders as Off ('none') / On ('high') / Default (unset).
const _PS_Thinking: ModelDescriptionSchema['parameterSpecs'] = [
  { paramId: 'llmVndMiscEffort', enumValues: ['none', 'high'] },
] as const;

// [DeepSeek, 2026-08-14] DashScope-hosted DeepSeek V4 additionally honors 'reasoning_effort' (live-probed: same 3 template
// tiers as DeepSeek-direct - low < high(=medium/xhigh) < max via the hidden-preamble fingerprint; flash-0731 collapses max
// onto high). The 'alibaba' dialect sends enable_thinking for the toggle and reasoning_effort only for low/max.
const _PS_DeepSeekEffort: ModelDescriptionSchema['parameterSpecs'] = [
  { paramId: 'llmVndMiscEffort', enumValues: ['none', 'low', 'high', 'max'] },
] as const;

// [GLM, 2026-08-16] DashScope-hosted GLM-5.2 also honors 'reasoning_effort' (live-ablated, n=15/arm, no prompt-token fingerprint
// here - tiers from reasoning_tokens): none/minimal = off | low = medium = high (~550-660 tokens, the reduced tier) | xhigh = max
// = default (~1.0-1.1K, ~1.85x) - Z.ai's documented native mapping. Through the 'alibaba' dialect (reasoning_effort sent only for
// low/max) this yields exactly one value per behavior: Off / Low (reduced) / Max (= Default). 'high' would emit only
// enable_thinking:true, i.e. a duplicate of Default, so it is left out.
const _PS_GlmEffort: ModelDescriptionSchema['parameterSpecs'] = [
  { paramId: 'llmVndMiscEffort', enumValues: ['none', 'low', 'max'] },
] as const;

// [Qwen, 2026-08-17] Qwen3.8 is the first Qwen generation with a real reasoning_effort ladder (model card: xhigh default /
// medium / low). DashScope validates it per model: qwen3.8-* accept none|minimal|low|medium|high|xhigh|max, qwen3.7-* the same
// minus 'max' but ignore it (live-ablated: no per-tier fingerprint on 3.7, only none/minimal turn thinking off - keep _PS_Thinking
// there). On qwen3.8 the hidden-preamble prompt-token fingerprint groups the values as: off {none} | {medium} | reduced
// {low, minimal} | top {high, xhigh, max, unset}. Through the 'alibaba' dialect (reasoning_effort sent only for low/max) that is
// Off / Low / Max (= Default); 'medium' is not expressible by llmVndMiscEffort and 'high' would duplicate Default.
const _PS_Qwen38Effort: ModelDescriptionSchema['parameterSpecs'] = [
  { paramId: 'llmVndMiscEffort', enumValues: ['none', 'low', 'max'] },
] as const;

// Same ladder minus Off: the open-weights id rejects enable_thinking:false ('the value of the enable_thinking parameter is
// restricted to True', live 2026-08-17), so offering it would 400.
const _PS_Qwen38EffortAlwaysOn: ModelDescriptionSchema['parameterSpecs'] = [
  { paramId: 'llmVndMiscEffort', enumValues: ['low', 'max'] },
] as const;

// [Kimi, 2026-08-24] DashScope-hosted Kimi K3 honors 'reasoning_effort' as well (live-ablated, n=2/arm; the hidden-preamble
// prompt-token fingerprint groups the values as: off {none, minimal} | reduced {low, medium, high} | top {xhigh, max, unset}).
// Through the 'alibaba' dialect (reasoning_effort sent only for low/max) that is Off / Low / Max (= Default).
const _PS_KimiEffort: ModelDescriptionSchema['parameterSpecs'] = [
  { paramId: 'llmVndMiscEffort', enumValues: ['none', 'low', 'max'] },
] as const;

const _knownAlibabaChatModels = llmsDefineManualMappings([

  // --- Qwen flagship / current generation ---
  {
    // GA 2026-08-03 (id live in /v1/models); pubDate keeps the 2026-07-19 `qwen3.8-max-preview` Token-Plan availability.
    // Caps live-probed 2026-08-04: input cap 991,808, vision/fn/thinking all OK, thinking on by default.
    idPrefix: 'qwen3.8-max',
    label: 'Qwen3.8 Max',
    parameterSpecs: _PS_Qwen38Effort,
    pubDate: '20260719',
    description: 'Flagship 2.4T-parameter sparse MoE multimodal model with 1M context, thinking, and vision/video understanding.',
    contextWindow: 1000000, // 1M (live-probed input cap: 991,808)
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning],
    maxCompletionTokens: 131072, // 128K (live-probed with thinking on; 64K with thinking off)
    chatPrice: { input: 2.00, output: 6.00, cache: { cType: 'oai-ac', read: 0.25 } }, // cache-hit input per the model page (not the 20% rule)
    benchmark: { cbaElo: 1491 }, // lmarena: qwen3.8-max
  },
  {
    // Open-weights release of the Qwen3.8 flagship (live 2026-08-13). Still absent from the Intl price table, but its model
    // page (published 2026-08-13) confirms what we had from Alibaba's OpenRouter endpoint: $2/$6, implicit cache-hit 0.25,
    // 991,808 max input / 1M context / 128K out, text-only. Thinking cannot be turned off (see _PS_Qwen38EffortAlwaysOn).
    idPrefix: 'qwen3.8-2.4t-a95b',
    label: 'Qwen3.8 2.4T-A95B',
    parameterSpecs: _PS_Qwen38EffortAlwaysOn,
    pubDate: '20260812',
    description: 'Open-weights release of the Qwen3.8 flagship: 2.4T sparse MoE, ~95B active. Text-only serving with 1M context and always-on thinking.',
    contextWindow: 1000000, // 1M
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    maxCompletionTokens: 131072, // 128K
    chatPrice: { input: 2.00, output: 6.00, cache: { cType: 'oai-ac', read: 0.25 } },
  },
  {
    // Open-weights dense VL model of the Qwen3.8 line (Apache-2.0, 2026-08-14); DashScope only started serving it after the
    // 08-17 pass. Model page (published 2026-08-19) + live probes agree: 991,808 max input (983,616 thinking) / 1M context /
    // 128K out / 256K max CoT, $0.5/$3 Singapore with the 20% implicit-cache rule. Still absent from the Intl price table.
    idPrefix: 'qwen3.8-27b',
    label: 'Qwen3.8 27B',
    parameterSpecs: _PS_Qwen38Effort, // full ladder + enable_thinking:false all accepted (live-ablated 2026-08-24, same buckets as qwen3.8-max)
    pubDate: '20260814',
    description: 'Open-weights 27B dense vision-language model of the Qwen3.8 line. 1M context, thinking, image/video input.',
    contextWindow: 1000000, // 1M
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning],
    maxCompletionTokens: 131072, // 128K (max_tokens range live-probed)
    chatPrice: { input: 0.50, output: 3.00, cache: { cType: 'oai-ac', read: 0.10 } },
  },
  {
    idPrefix: 'qwen3.7-max',
    label: 'Qwen3.7 Max',
    parameterSpecs: _PS_Thinking,
    pubDate: '20260622',
    description: 'Flagship agent model with native extended thinking and 1M context. Text-only; strong at coding, productivity, and long-horizon autonomous tasks.',
    contextWindow: 1000000, // 1M
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning], // text-only (no vision)
    maxCompletionTokens: 131072, // 128K (live-probed; docs still say 64K)
    chatPrice: { input: 2.50, output: 7.50, cache: { cType: 'oai-ac', read: 0.50 } }, // implicit cache hit 0.50 (explicit hit 0.25)
    benchmark: { cbaElo: 1474 }, // lmarena: qwen3.7-max-preview (same model, pre-GA id)
  },
  {
    idPrefix: 'qwen3.7-plus',
    label: 'Qwen3.7 Plus',
    parameterSpecs: _PS_Thinking,
    pubDate: '20260601',
    description: 'Multimodal agent model with 1M context, native thinking, and vision/video understanding. Lower cost than Max.',
    contextWindow: 1000000, // 1M
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning],
    maxCompletionTokens: 131072, // 128K (live-probed; docs still say 64K)
    chatPrice: {
      input: [{ upTo: 256000, price: 0.40 }, { upTo: null, price: 1.20 }],
      output: [{ upTo: 256000, price: 1.60 }, { upTo: null, price: 4.80 }],
    }, // implicit cache: 0.08 (<=256K) / 0.24 (>256K)
    benchmark: { cbaElo: 1458 }, // lmarena: qwen3.7-plus
  },
  {
    idPrefix: 'qwen3.7-flash',
    label: 'Qwen3.7 Flash',
    parameterSpecs: _PS_Thinking,
    pubDate: '20260715', // from the qwen3.7-flash-2026-07-15 snapshot id (API 2026-07-24)
    description: 'Latest fast multimodal model with 1M context, thinking (on by default), vision, and 128K output.',
    contextWindow: 1000000, // 1M (live-probed input cap: 983,616)
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning], // all live-probed 2026-07-24
    maxCompletionTokens: 131072, // 128K (max_tokens range live-probed; its model page and OpenRouter both say 64K)
    chatPrice: {
      input: [{ upTo: 32000, price: 0.03 }, { upTo: 256000, price: 0.10 }, { upTo: null, price: 0.20 }],
      output: [{ upTo: 32000, price: 0.13 }, { upTo: 256000, price: 0.40 }, { upTo: null, price: 0.80 }],
    }, // not on the Intl pricing page; tiers from the model page + Alibaba's own OpenRouter endpoint. implicit cache: 0.006 / 0.02 / 0.04
  },
  {
    // kept visible alongside qwen3.7-flash: still on Alibaba's recommended list 2026-08-06
    idPrefix: 'qwen3.6-flash',
    label: 'Qwen3.6 Flash',
    parameterSpecs: _PS_Thinking,
    pubDate: '20260622',
    description: 'Fast, cost-effective multimodal model with 1M context, near-flagship quality, vision/video, and built-in tools.',
    contextWindow: 1000000, // 1M
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning],
    maxCompletionTokens: 65536, // 64K
    chatPrice: {
      input: [{ upTo: 256000, price: 0.25 }, { upTo: null, price: 1.00 }],
      output: [{ upTo: 256000, price: 1.50 }, { upTo: null, price: 4.00 }],
    },
  },
  {
    idPrefix: 'qwen3-coder-plus',
    label: 'Qwen3 Coder Plus',
    pubDate: '20260514',
    description: 'Agentic coding model with very long context. Tiered pricing by input length (up to 1M).',
    contextWindow: 1000000, // 1M
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn], // coding/agentic; non-thinking
    maxCompletionTokens: 65536,
    chatPrice: {
      input: [{ upTo: 32000, price: 1.00 }, { upTo: 128000, price: 1.80 }, { upTo: 256000, price: 3.00 }, { upTo: null, price: 6.00 }],
      output: [{ upTo: 32000, price: 5.00 }, { upTo: 128000, price: 9.00 }, { upTo: 256000, price: 15.00 }, { upTo: null, price: 60.00 }],
    },
  },
  {
    idPrefix: 'qwen3-coder-next',
    label: 'Qwen3 Coder Next',
    pubDate: '20260204',
    description: 'Budget agentic coder on the Qwen3-Next architecture. 256K context, non-thinking, tiered pricing.',
    contextWindow: 262144, // 256K
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    maxCompletionTokens: 65536,
    chatPrice: {
      input: [{ upTo: 32000, price: 0.30 }, { upTo: 128000, price: 0.50 }, { upTo: null, price: 0.80 }],
      output: [{ upTo: 32000, price: 1.50 }, { upTo: 128000, price: 2.50 }, { upTo: null, price: 4.00 }],
    },
  },
  {
    idPrefix: 'qwen3-vl-plus',
    label: 'Qwen3 VL Plus',
    parameterSpecs: _PS_Thinking,
    pubDate: '20260430',
    description: 'Current vision-language model with strong visual reasoning and thinking. Tiered pricing by input length (up to 256K).',
    contextWindow: 262144, // 256K
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning],
    maxCompletionTokens: 32768,
    chatPrice: {
      input: [{ upTo: 32000, price: 0.20 }, { upTo: 128000, price: 0.30 }, { upTo: null, price: 0.60 }],
      output: [{ upTo: 32000, price: 1.60 }, { upTo: 128000, price: 2.40 }, { upTo: null, price: 4.80 }],
    },
  },

  // --- Superseded generations, short-form curation (2026-08-14 triage; all hidden) ---
  // Prices = Intl/Singapore list; contexts/output caps from OpenRouter's Alibaba endpoints (out = 64K unless noted).
  {
    idPrefix: 'qwen3.6-plus', label: 'Qwen3.6 Plus', pubDate: '20260402', hidden: true,
    description: 'Previous Plus tier, superseded by Qwen3.7 Plus. 1M context, thinking, vision.',
    parameterSpecs: _PS_Thinking,
    contextWindow: 1000000, maxCompletionTokens: 65536,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning],
    chatPrice: { input: [{ upTo: 256000, price: 0.50 }, { upTo: null, price: 2.00 }], output: [{ upTo: 256000, price: 3.00 }, { upTo: null, price: 6.00 }] },
  },
  {
    idPrefix: 'qwen3.6-max-preview', label: 'Qwen3.6 Max Preview', pubDate: '20260427', hidden: true,
    description: 'Qwen3.6 Max preview (never GA; superseded by Qwen3.7 Max). 256K context, thinking, text-only.',
    parameterSpecs: _PS_Thinking,
    contextWindow: 262144, maxCompletionTokens: 65536,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    chatPrice: { input: [{ upTo: 128000, price: 1.30 }, { upTo: null, price: 2.00 }], output: [{ upTo: 128000, price: 7.80 }, { upTo: null, price: 12.00 }] },
  },
  {
    idPrefix: 'qwen3.6-35b-a3b', label: 'Qwen3.6 35B-A3B', pubDate: '20260427', hidden: true,
    description: 'Open 35B-A3B MoE multimodal with thinking. 256K context.',
    parameterSpecs: _PS_Thinking,
    contextWindow: 262144, maxCompletionTokens: 65536,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning],
    chatPrice: { input: 0.375, output: 2.25 },
  },
  {
    idPrefix: 'qwen3.6-27b', label: 'Qwen3.6 27B', pubDate: '20260427', hidden: true,
    description: 'Open 27B dense multimodal with thinking. 256K context.',
    parameterSpecs: _PS_Thinking,
    contextWindow: 262144, maxCompletionTokens: 65536,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning],
    chatPrice: { input: 0.60, output: 3.60 },
  },
  {
    idPrefix: 'qwen3.5-plus', label: 'Qwen3.5 Plus', pubDate: '20260215', hidden: true,
    description: 'Former Plus tier, superseded by Qwen3.6/3.7 Plus. 1M context, thinking, vision.',
    parameterSpecs: _PS_Thinking,
    contextWindow: 1000000, maxCompletionTokens: 65536,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning],
    chatPrice: { input: [{ upTo: 256000, price: 0.40 }, { upTo: null, price: 0.50 }], output: [{ upTo: 256000, price: 2.40 }, { upTo: null, price: 3.00 }] },
  },
  {
    idPrefix: 'qwen3.5-flash', label: 'Qwen3.5 Flash', pubDate: '20260223', hidden: true,
    description: 'Former Flash tier, superseded by Qwen3.6/3.7 Flash. 1M context, thinking, vision.',
    parameterSpecs: _PS_Thinking,
    contextWindow: 1000000, maxCompletionTokens: 65536,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning],
    chatPrice: { input: 0.10, output: 0.40, cache: { cType: 'oai-ac', read: 0.02 } }, // 20% implicit-hit rule
  },
  {
    idPrefix: 'qwen3.5-397b-a17b', label: 'Qwen3.5 397B-A17B', pubDate: '20260216', hidden: true,
    description: 'Open 397B-A17B MoE multimodal with thinking. 256K context.',
    parameterSpecs: _PS_Thinking,
    contextWindow: 262144, maxCompletionTokens: 65536,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning],
    chatPrice: { input: 0.60, output: 3.60 },
  },
  {
    idPrefix: 'qwen3.5-122b-a10b', label: 'Qwen3.5 122B-A10B', pubDate: '20260225', hidden: true,
    description: 'Open 122B-A10B MoE multimodal with thinking. 256K context.',
    parameterSpecs: _PS_Thinking,
    contextWindow: 262144, maxCompletionTokens: 65536,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning],
    chatPrice: { input: 0.40, output: 3.20 },
  },
  {
    idPrefix: 'qwen3.5-35b-a3b', label: 'Qwen3.5 35B-A3B', pubDate: '20260225', hidden: true,
    description: 'Open 35B-A3B MoE multimodal with thinking. 256K context.',
    parameterSpecs: _PS_Thinking,
    contextWindow: 262144, maxCompletionTokens: 65536,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning],
    chatPrice: { input: 0.25, output: 2.00 },
  },
  {
    idPrefix: 'qwen3.5-27b', label: 'Qwen3.5 27B', pubDate: '20260225', hidden: true,
    description: 'Open 27B dense multimodal with thinking. 256K context.',
    parameterSpecs: _PS_Thinking,
    contextWindow: 262144, maxCompletionTokens: 65536,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning],
    chatPrice: { input: 0.30, output: 2.40 },
  },
  {
    idPrefix: 'qwen3-max', label: 'Qwen3 Max', pubDate: '20250923', hidden: true,
    description: 'Retired 2025 flagship, superseded by Qwen3.6+ Max. 256K context; the base id now serves the thinking-capable 2026-01-23 snapshot.',
    parameterSpecs: _PS_Thinking,
    contextWindow: 262144, maxCompletionTokens: 65536,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    chatPrice: { input: [{ upTo: 32000, price: 1.20 }, { upTo: 128000, price: 2.40 }, { upTo: null, price: 3.00 }], output: [{ upTo: 32000, price: 6.00 }, { upTo: 128000, price: 12.00 }, { upTo: null, price: 15.00 }] },
  },
  {
    idPrefix: 'qwen3-vl-flash', label: 'Qwen3 VL Flash', pubDate: '20251015', hidden: true,
    description: 'Budget VL tier below Qwen3 VL Plus. 256K context, thinking, vision.',
    parameterSpecs: _PS_Thinking,
    contextWindow: 262144, maxCompletionTokens: 32768, // out assumed = qwen3-vl-plus
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning],
    chatPrice: { input: [{ upTo: 32000, price: 0.05 }, { upTo: 128000, price: 0.075 }, { upTo: null, price: 0.12 }], output: [{ upTo: 32000, price: 0.40 }, { upTo: 128000, price: 0.60 }, { upTo: null, price: 0.96 }] },
  },
  {
    idPrefix: 'qwen3-coder-flash', label: 'Qwen3 Coder Flash', pubDate: '20250728', hidden: true,
    description: 'Former budget coder, superseded by Qwen3 Coder Next (which lacks its 1M context). Non-thinking.',
    contextWindow: 1000000, maxCompletionTokens: 65536,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: [{ upTo: 32000, price: 0.30 }, { upTo: 128000, price: 0.50 }, { upTo: 256000, price: 0.80 }, { upTo: null, price: 1.60 }], output: [{ upTo: 32000, price: 1.50 }, { upTo: 128000, price: 2.50 }, { upTo: 256000, price: 4.00 }, { upTo: null, price: 9.60 }] },
  },

  // --- Qwen stable commercial aliases (legacy naming; auto-point to the latest snapshot) ---
  // Hidden by default: superseded by the qwen3.x line above and no longer on Alibaba's "recommended" list. Still selectable from the admin list.
  {
    idPrefix: 'qwen-max',
    label: 'Qwen Max',
    description: 'Best quality of the stable commercial line. 32K context.',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    maxCompletionTokens: 8192,
    chatPrice: { input: 1.60, output: 6.40 },
    hidden: true, // legacy alias, superseded by qwen3.7-max
  },
  {
    idPrefix: 'qwen-plus',
    label: 'Qwen Plus',
    parameterSpecs: _PS_Thinking,
    description: 'Balanced quality, speed, and cost with hybrid thinking. 1M context.',
    contextWindow: 1000000, // 1M
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    maxCompletionTokens: 32768,
    chatPrice: {
      input: [{ upTo: 256000, price: 0.40 }, { upTo: null, price: 1.20 }],
      output: [{ upTo: 256000, price: 1.20 }, { upTo: null, price: 3.60 }],
    },
    hidden: true, // legacy alias, superseded by qwen3.x (note: still actively maintained by Alibaba if you want it visible)
  },
  {
    idPrefix: 'qwen-flash',
    label: 'Qwen Flash',
    parameterSpecs: _PS_Thinking,
    description: 'Fast and very low cost with hybrid thinking. 1M context.',
    contextWindow: 1000000, // 1M
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    maxCompletionTokens: 32768,
    chatPrice: {
      input: [{ upTo: 256000, price: 0.05 }, { upTo: null, price: 0.25 }],
      output: [{ upTo: 256000, price: 0.40 }, { upTo: null, price: 2.00 }],
    },
    hidden: true, // legacy alias, superseded by qwen3.6-flash
  },
  {
    idPrefix: 'qwen-turbo',
    label: 'Qwen Turbo',
    description: 'Fastest and cheapest for simple tasks. 1M context.',
    contextWindow: 1000000, // 1M
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    maxCompletionTokens: 8192,
    chatPrice: { input: 0.05, output: 0.20 },
    hidden: true, // legacy alias
  },

  // --- Third-party models resold by Alibaba Model Studio (Alibaba's own pricing; labeled to disambiguate from our native vendors) ---
  // DeepSeek on DashScope: dated snapshots are listed ALONGSIDE the undated ids (each with its own free-tier quota), unlike
  // api.deepseek.com, which only exposes undated ids and swaps checkpoints in place behind them. Alibaba does not print the
  // "Currently equivalent to <snapshot>" note it uses for Qwen on the DeepSeek rows, so which checkpoint the undated ids
  // serve is undocumented - hence the 0813 snapshot is curated visible, as the only pinnable GA route here.
  // Prices: no snapshot rows exist on the price table; snapshots bill at their mainline Singapore rate.
  {
    idPrefix: 'deepseek-v4-pro',
    label: 'DeepSeek V4 Pro (Alibaba)',
    hidden: true, // superseded by the 0813 GA entry below; this undated id is also free-tier-quota-bound here (403 AllocationQuota.FreeTierOnly on live probe, 2026-08-14) while 0813 bills normally
    parameterSpecs: _PS_DeepSeekEffort,
    pubDate: '20260424', // = deepseek.models.ts 'deepseek-v4-pro' (upstream launch, not the DashScope listing; which checkpoint this undated id serves is undocumented - see the note above)
    description: 'DeepSeek V4 Pro served via Alibaba Model Studio (Alibaba pricing, well above DeepSeek-direct). 1M context, thinking.',
    contextWindow: 1_000_000, // 1M (Alibaba serves a decimal 1M window, not DeepSeek-direct's 1,048,576)
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    maxCompletionTokens: 131072, // 128K house cap; the model page states 393216 (384K)
    chatPrice: { input: 2.40, output: 4.80, cache: { cType: 'oai-ac', read: 0.20 } },
    benchmark: { cbaElo: 1458 }, // lmarena: deepseek-v4-pro
  },
  {
    // GA release of V4 Pro (2026-08-13), superseding the April preview: same 1.6T/49B MoE, re-post-trained for agentic work
    // with a DSpark speculative-decoding module attached. Large agentic deltas vs the preview (DeepSWE 62.7 vs 12.8,
    // Terminal Bench 2.1 87.9 vs 72.1); raw-knowledge gains are small (HLE without tools 42.7 vs 37.7).
    idPrefix: 'deepseek-v4-pro-0813',
    label: 'DeepSeek V4 Pro 0813 (Alibaba)',
    parameterSpecs: _PS_DeepSeekEffort,
    pubDate: '20260813',
    description: 'DeepSeek V4 Pro GA (0813) served via Alibaba Model Studio. Much stronger agentic and tool use than the April preview. 1M context, thinking.',
    contextWindow: 1_000_000, // 1M (live-probed: 'Range of input length should be [1, 1000000]')
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning], // text-only (no vision); thinking on by default
    maxCompletionTokens: 131072, // 128K house cap; the model page states 393216 (384K)
    chatPrice: { input: 2.40, output: 4.80, cache: { cType: 'oai-ac', read: 0.20 } },
    benchmark: { cbaElo: 1458 }, // lmarena: deepseek-v4-pro (preview checkpoint; the board's 0813 row is AutoEval-only, not human votes)
  },
  {
    idPrefix: 'deepseek-v4-flash',
    label: 'DeepSeek V4 Flash (Alibaba)',
    parameterSpecs: _PS_DeepSeekEffort,
    pubDate: '20260424', // = deepseek.models.ts 'deepseek-v4-flash' (upstream launch, not the DashScope listing; undated id, checkpoint undocumented)
    description: 'DeepSeek V4 Flash served via Alibaba Model Studio. 1M context, thinking.',
    contextWindow: 1_000_000, // 1M (Alibaba serves a decimal 1M window)
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    maxCompletionTokens: 131072, // 128K house cap; the model page states 393216 (384K)
    chatPrice: { input: 0.20, output: 0.40, cache: { cType: 'oai-ac', read: 0.04 } },
    benchmark: { cbaElo: 1435 }, // lmarena: deepseek-v4-flash
  },
  {
    // pinnable 0731 revision (re-post-train, same arch/size/price); curated only so it lists with a clean label
    idPrefix: 'deepseek-v4-flash-0731',
    label: 'DeepSeek V4 Flash 0731 (Alibaba)',
    parameterSpecs: _PS_DeepSeekEffort,
    pubDate: '20260731',
    description: 'DeepSeek V4 Flash 0731 revision served via Alibaba Model Studio. 1M context, thinking.',
    contextWindow: 1_000_000, // 1M
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    maxCompletionTokens: 131072, // 128K house cap; the model page states 393216 (384K)
    chatPrice: { input: 0.20, output: 0.40, cache: { cType: 'oai-ac', read: 0.04 } },
    benchmark: { cbaElo: 1435 }, // lmarena: deepseek-v4-flash
    hidden: true, // dated snapshot; deepseek-v4-flash is the mainline entry for this tier
  },
  {
    idPrefix: 'glm-5.2',
    label: 'GLM-5.2 (Alibaba)',
    parameterSpecs: _PS_GlmEffort,
    pubDate: '20260616', // = zai.models.ts 'glm-5.2' (Z.ai release, not the DashScope listing)
    description: 'Zhipu GLM-5.2 served via Alibaba Model Studio. 1M context, thinking.',
    contextWindow: 1048576, // 1M
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    maxCompletionTokens: 131072, // 128K
    chatPrice: { input: 1.40, output: 4.40, cache: { cType: 'oai-ac', read: 0.35 } }, // repriced 2026-07-24 (was 1.10/3.851); implicit hit = 25% of input for GLM-5.2 (model page, identical in all 4 listed regions) and -fast (Beijing-only page); GLM-5.1 is the usual 20%
    benchmark: { cbaElo: 1471 }, // lmarena: glm-5.2-max
  },
  {
    idPrefix: 'glm-5.2-fast',
    label: 'GLM-5.2 Fast (Alibaba)',
    parameterSpecs: _PS_Thinking, // effort tiers unverified on the fast tier (free-quota-only on our key), binary toggle kept
    pubDate: '20260710',
    description: 'Zhipu GLM-5.2 fast-serving tier via Alibaba Model Studio (preview). Same model, lower latency, ~2x price.',
    contextWindow: 1048576, // 1M (model page https://www.alibabacloud.com/help/en/model-studio/glm-5-2-fast, verified 2026-08-16)
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    maxCompletionTokens: 131072, // 128K (live-probed 2026-07-24)
    chatPrice: { input: 2.80, output: 8.80, cache: { cType: 'oai-ac', read: 0.70 } }, // Intl/Singapore price-table rows; cache = 25% of input (the model page's Beijing row shows 0.55 on 2.2)
    hidden: true, // preview-only for now (live id: glm-5.2-fast-preview, still preview 2026-08-16); un-hide when GA
  },
  {
    idPrefix: 'glm-5.1', label: 'GLM-5.1 (Alibaba)', pubDate: '20260407', hidden: true,
    description: 'Zhipu GLM-5.1 served via Alibaba Model Studio, superseded by GLM-5.2. 200K context, thinking.',
    parameterSpecs: _PS_Thinking,
    contextWindow: 202745, maxCompletionTokens: 131072, // 202,745 in (model page + live 'Range of input length' probe 2026-08-16; 169,984 with thinking on) / 128K out
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    chatPrice: { input: 1.40, output: 4.40, cache: { cType: 'oai-ac', read: 0.28 } }, // cache = 20% implicit-hit rate per the model page (0.165 on 0.825, all regions)
  },
  {
    // Live on DashScope since the 08-17 pass; model page published 2026-08-24. Singapore $3/$15 with implicit cache 0.30
    // (10% of input here, not the usual Kimi 20%); no price-table row yet. Unlike K2.7 Code, thinking can be turned off.
    idPrefix: 'kimi-k3',
    label: 'Kimi K3 (Alibaba)',
    parameterSpecs: _PS_KimiEffort,
    pubDate: '20260716', // = moonshot.models.ts 'kimi-k3' (Moonshot release, not the DashScope listing)
    description: 'Moonshot Kimi K3 flagship served via Alibaba Model Studio. Multimodal, thinking on by default, 1M context.',
    contextWindow: 1048576, // 1M (live-probed: 'Range of input length should be [1, 1048576]')
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning],
    maxCompletionTokens: 131072, // house cap; live ceiling is 1,048,576 (= context window)
    chatPrice: { input: 3.00, output: 15.00, cache: { cType: 'oai-ac', read: 0.30 } },
  },
  {
    idPrefix: 'kimi-k2.7-code',
    label: 'Kimi K2.7 Code (Alibaba)',
    pubDate: '20260612', // = moonshot.models.ts 'kimi-k2.7-code' (Moonshot release, not the DashScope listing)
    description: 'Moonshot Kimi K2.7 Code served via Alibaba Model Studio. Multimodal, always-on thinking, 256K context.',
    contextWindow: 262144, // 256K
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning],
    maxCompletionTokens: 131072, // house cap; live ceiling is 262144 (256K, = context window)
    chatPrice: { input: 0.95, output: 4.00, cache: { cType: 'oai-ac', read: 0.19 } }, // repriced 2026-07-24 (was 0.8939/3.7131); cache = 20% implicit-hit rule (explicit: create 1.1875 / read 0.095)
  },
  {
    idPrefix: 'deepseek-v3.2',
    label: 'DeepSeek V3.2 (Alibaba)',
    parameterSpecs: _PS_Thinking,
    pubDate: '20260623',
    description: 'DeepSeek V3.2 served via Alibaba Model Studio (superseded by V4). Thinking.',
    contextWindow: 131072, // ~128K (approx)
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    maxCompletionTokens: 65536,
    chatPrice: { input: 0.57, output: 1.71 },
    benchmark: { cbaElo: 1425 }, // lmarena: deepseek-v3.2
    hidden: true, // available but superseded by V4
  },

]);


// Hide dated snapshots (-YYYY-MM-DD or -2507) and -preview/-latest aliases, even when they prefix-match a curated model
const _ALIBABA_DATED_SNAPSHOT = /(?:-\d{4}-\d{2}-\d{2}|-\d{4})$/;
const _ALIBABA_PREVIEW_ALIAS = /-(?:preview|latest)$/;

// Editorial deny list: retired 2025-era chat lines dropped from the list entirely (matched by exact id or 'id-' prefix)
const _ALIBABA_DENY_LIST = [
  'qwq-plus', 'qvq-max',            // QwQ/QVQ reasoning-era lines
  'qwen-coder-plus',                // pre-qwen3 commercial coder (no Intl price row left)
  'qwen-vl-max', 'qwen-vl-plus',    // qwen2.5-era VL line (qwen3-vl-* replaces)
  'qwen3-8b', 'qwen3-14b', 'qwen3-32b', // 2025 open dense models
  'qwen3-30b-a3b', 'qwen3-235b-a22b',   // 2025 open MoE (+ their -instruct/-thinking-2507 snapshots)
  'qwen3-coder-480b-a35b-instruct', // 2025 open coder (qwen3-coder-next replaces)
  'qwen3-next-80b-a3b',             // 2025 Next-arch preview pair
  'qwen3-vl-235b-a22b',             // 2025 open VL pair
];

export function alibabaModelFilter(modelId: string): boolean {
  // drop denied ids outright
  if (_ALIBABA_DENY_LIST.some(deny => modelId === deny || modelId.startsWith(deny + '-')))
    return false;
  // Keep only chat/text-generation models; exclude image/audio/video/translation/embedding/agent services.
  const excludePatterns = [
    'text-embedding', // embeddings
    'image',          // image gen/edit: qwen-image*, wan2.7-image*, z-image-*
    'wan',            // Wan video/image models
    'omni',           // omni (audio/video) models: qwen3-omni*, qwen3.5-omni*, qwen-omni-turbo
    'qwen3-tts',      // text-to-speech
    'tts',            // any TTS variant
    'asr',            // speech recognition: qwen3-asr*
    'qwen3-s2s',      // speech-to-speech
    's2s',            // any speech-to-speech variant
    'livetranslate',  // live (audio) translation: qwen3-livetranslate*, qwen3.5-livetranslate*
    'qwen-mt-',       // text translation models (use regular chat models instead)
    'ocr',            // OCR: qwen-vl-ocr*
    'captioner',      // image captioning
    'character',      // roleplay character variants: qwen-*-character
    'cosyvoice',      // voice
    '-vc-',           // voice cloning
    '-vd-',           // voice design
    'ccai',           // contact-center AI service
    'tingwu',         // transcription service (tongyi-tingwu*)
    '-slp',           // speech service
    'qwen2-7b',       // legacy small open model
  ];
  return !excludePatterns.some(pattern => modelId.includes(pattern));
}

export function alibabaModelToModelDescription(alibabaModelId: string, created?: number): ModelDescriptionSchema {
  const md = fromManualMapping(_knownAlibabaChatModels, alibabaModelId, created, undefined, {
    idPrefix: alibabaModelId,
    label: llmsLabelUncurated(_alibabaFormatNewLabel(alibabaModelId)),
    description: 'Alibaba model (not yet curated).',
    contextWindow: null, // the list API returns ids only - no context to trust
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    hidden: true, // editorial policy: hide uncatalogued models by default (title-cased label only if ever shown)
  });

  // Re-hide dated snapshots / preview aliases (super-matches against a curated base get un-hidden by fromManualMapping).
  // Exception: an id curated verbatim (e.g. deepseek-v4-pro-0813) is an explicit editorial pick and keeps its own `hidden`.
  const curatedVerbatim = _knownAlibabaChatModels.some(m => m.idPrefix === alibabaModelId);
  if (!md.hidden && !curatedVerbatim && (_ALIBABA_DATED_SNAPSHOT.test(alibabaModelId) || _ALIBABA_PREVIEW_ALIAS.test(alibabaModelId)))
    md.hidden = true;

  return md;
}

// Title-case an uncurated id for a cleaner fallback label, e.g. 'qwen3-coder-flash' -> 'Qwen3 Coder Flash'
function _alibabaFormatNewLabel(modelId: string): string {
  return modelId.replaceAll(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function alibabaModelSort(a: ModelDescriptionSchema, b: ModelDescriptionSchema): number {
  // brings variants of the base model with it (startsWith)
  const aIndex = _knownAlibabaChatModels.findIndex(m => a.id.startsWith(m.idPrefix));
  const bIndex = _knownAlibabaChatModels.findIndex(m => b.id.startsWith(m.idPrefix));

  // 1. curated models before unknown
  if (aIndex !== -1 && bIndex === -1) return -1;
  if (aIndex === -1 && bIndex !== -1) return 1;

  if (aIndex !== -1 && bIndex !== -1) {
    // 2. different curated families: editorial order
    if (aIndex !== bIndex) return aIndex - bIndex;
    // 3. same family: the exact base first, then its dated/variant snapshots newest-first (ids embed the date)
    const aBase = a.id === _knownAlibabaChatModels[aIndex].idPrefix;
    const bBase = b.id === _knownAlibabaChatModels[bIndex].idPrefix;
    if (aBase !== bBase) return aBase ? -1 : 1;
    return b.id.localeCompare(a.id);
  }

  // 4. both unknown: newest editorial pubDate first, then id descending (API 'created' is unreliable for Alibaba)
  const aPub = a.pubDate || '', bPub = b.pubDate || '';
  if (aPub !== bPub) return bPub.localeCompare(aPub);
  return b.id.localeCompare(a.id);
}
