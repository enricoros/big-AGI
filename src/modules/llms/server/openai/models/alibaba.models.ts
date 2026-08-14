import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { fromManualMapping, llmsDefineManualMappings } from '../../models.mappings';

// --- Alibaba Model ID inference (auto-derived from _knownAlibabaChatModels) ---
export type LlmsAlibabaModelId = typeof _knownAlibabaChatModels[number]['idPrefix'];

// Sources (verified 2026-08-14 against the live /v1/models list + docs):
// - Models:  https://www.alibabacloud.com/help/en/model-studio/models
// - Pricing: https://www.alibabacloud.com/help/en/model-studio/model-pricing (International/Singapore, USD per 1M tokens)
// - Per-model pages carry the authoritative caps + cache-hit price, e.g. https://www.alibabacloud.com/help/en/model-studio/qwen3-8-max
// - Cache:   https://www.alibabacloud.com/help/en/model-studio/context-cache (implicit hit = 20% of input; explicit create 125% / hit 10%; deepseek-v4-pro excepted)
// 2026-08-14 pass (DeepSeek only): deepseek-v4-pro-0813 curated + made visible by exception (see below); deepseek-v4-flash-0731
//   curated but hidden; DeepSeek-V4 output cap 64K -> 128K house cap (both model pages state 393216). Qwen rows re-checked, unchanged.
// 2026-08-06 pass: qwen3.7-flash repriced to its real 3-tier rates - the 0.25/1.50 was qwen3.6-flash's, the model is still absent from the
//   Intl pricing page (tiers on its model page + Alibaba's own OpenRouter endpoint agree); qwen3.7-max output cap 64K -> 128K; DeepSeek-V4
//   context 1,048,576 -> 1,000,000 (what Alibaba serves); arena ELOs refreshed; qwen3.8-max caps/price re-confirmed on its model page;
//   still uncurated by policy: qwen3.5-122b-a10b (open 122B MoE, $0.4/$3.2), qwen3.6-27b, qwen3.6-plus, qwen3.5-plus, qwen3.5-flash,
//   qwen3-vl-flash, qwen3-coder-next/-flash, glm-5.1 (fallback-hidden).
// NOTES:
// - The live API returns only id/created/owned_by (no pricing/caps/context), so EVERYTHING here is editorial.
// - Alibaba uses tiered pricing keyed on the request's INPUT token count (both input and output prices step up).
// - Policy: curate the current best-per-tier lineup only; all uncatalogued models, dated snapshots
//   (-YYYY-MM-DD / -2507), and -preview/-latest aliases are hidden, UNLESS curated verbatim below - an exact
//   entry is an explicit editorial pick and carries its own `hidden` (see alibabaModelToModelDescription).
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

const _knownAlibabaChatModels = llmsDefineManualMappings([

  // --- Qwen flagship / current generation ---
  {
    // GA 2026-08-03 (id live in /v1/models); pubDate keeps the 2026-07-19 `qwen3.8-max-preview` Token-Plan availability.
    // Caps live-probed 2026-08-04: input cap 991,808, vision/fn/thinking all OK, thinking on by default.
    idPrefix: 'qwen3.8-max',
    label: 'Qwen3.8 Max',
    parameterSpecs: _PS_Thinking,
    pubDate: '20260719',
    description: 'Flagship 2.4T-parameter sparse MoE multimodal model with 1M context, thinking, and vision/video understanding.',
    contextWindow: 1000000, // 1M (live-probed input cap: 991,808)
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning],
    maxCompletionTokens: 131072, // 128K (live-probed with thinking on; 64K with thinking off)
    chatPrice: { input: 2.00, output: 6.00, cache: { cType: 'oai-ac', read: 0.25 } }, // cache-hit input per the model page (not the 20% rule)
    benchmark: { cbaElo: 1497 }, // lmarena: qwen3.8-max
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
    benchmark: { cbaElo: 1475 }, // lmarena: qwen3.7-max-preview (same model, pre-GA id)
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
    pubDate: '20260623',
    description: 'DeepSeek V4 Pro served via Alibaba Model Studio (Alibaba pricing, well above DeepSeek-direct). 1M context, thinking.',
    contextWindow: 1_000_000, // 1M (Alibaba serves a decimal 1M window, not DeepSeek-direct's 1,048,576)
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    maxCompletionTokens: 131072, // 128K house cap; the model page states 393216 (384K)
    chatPrice: { input: 2.40, output: 4.80, cache: { cType: 'oai-ac', read: 0.20 } },
    benchmark: { cbaElo: 1457 }, // lmarena: deepseek-v4-pro
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
    benchmark: { cbaElo: 1457 }, // lmarena: deepseek-v4-pro (scored on the preview checkpoint; no 0813 human-vote entry yet)
  },
  {
    idPrefix: 'deepseek-v4-flash',
    label: 'DeepSeek V4 Flash (Alibaba)',
    parameterSpecs: _PS_DeepSeekEffort,
    pubDate: '20260622',
    description: 'DeepSeek V4 Flash served via Alibaba Model Studio. 1M context, thinking.',
    contextWindow: 1_000_000, // 1M (Alibaba serves a decimal 1M window)
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    maxCompletionTokens: 131072, // 128K house cap; the model page states 393216 (384K)
    chatPrice: { input: 0.20, output: 0.40, cache: { cType: 'oai-ac', read: 0.04 } },
    benchmark: { cbaElo: 1436 }, // lmarena: deepseek-v4-flash
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
    benchmark: { cbaElo: 1436 }, // lmarena: deepseek-v4-flash
    hidden: true, // dated snapshot; deepseek-v4-flash is the mainline entry for this tier
  },
  {
    idPrefix: 'glm-5.2',
    label: 'GLM-5.2 (Alibaba)',
    parameterSpecs: _PS_Thinking,
    pubDate: '20260626',
    description: 'Zhipu GLM-5.2 served via Alibaba Model Studio. 1M context, thinking.',
    contextWindow: 1048576, // 1M
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    maxCompletionTokens: 131072, // 128K
    chatPrice: { input: 1.40, output: 4.40, cache: { cType: 'oai-ac', read: 0.35 } }, // repriced 2026-07-24 (was 1.10/3.851); implicit hit = 25% of input for GLM (model page, identical in all 4 listed regions), not the usual 20%
    benchmark: { cbaElo: 1471 }, // lmarena: glm-5.2-max
  },
  {
    idPrefix: 'glm-5.2-fast',
    label: 'GLM-5.2 Fast (Alibaba)',
    parameterSpecs: _PS_Thinking,
    pubDate: '20260710',
    description: 'Zhipu GLM-5.2 fast-serving tier via Alibaba Model Studio (preview). Same model, lower latency, ~2x price.',
    contextWindow: 1048576, // 1M (assumed = glm-5.2)
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    maxCompletionTokens: 131072, // 128K (live-probed 2026-07-24)
    chatPrice: { input: 2.80, output: 8.80, cache: { cType: 'oai-ac', read: 0.70 } }, // cache = the 25% GLM implicit-hit rate (no model page of its own)
    hidden: true, // preview-only for now (live id: glm-5.2-fast-preview); un-hide when GA
  },
  {
    idPrefix: 'kimi-k2.7-code',
    label: 'Kimi K2.7 Code (Alibaba)',
    pubDate: '20260626',
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

export function alibabaModelFilter(modelId: string): boolean {
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
    label: _alibabaFormatNewLabel(alibabaModelId),
    description: 'Alibaba model (not yet curated).',
    contextWindow: 131072,
    maxCompletionTokens: 8192,
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
