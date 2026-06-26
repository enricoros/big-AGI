import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { fromManualMapping, llmsDefineManualMappings } from '../../models.mappings';

// --- Alibaba Model ID inference (auto-derived from _knownAlibabaChatModels) ---
export type LlmsAlibabaModelId = typeof _knownAlibabaChatModels[number]['idPrefix'];

// Sources (verified 2026-06-26 against the live /v1/models list + docs):
// - Models:  https://www.alibabacloud.com/help/en/model-studio/models
// - Pricing: https://www.alibabacloud.com/help/en/model-studio/model-pricing (International/Singapore, USD per 1M tokens)
// NOTES:
// - The live API returns only id/created/owned_by (no pricing/caps/context), so EVERYTHING here is editorial.
// - Alibaba uses tiered pricing keyed on the request's INPUT token count (both input and output prices step up).
// - Policy: curate the current best-per-tier lineup only; all uncatalogued models, dated snapshots
//   (-YYYY-MM-DD / -2507), and -preview/-latest aliases are hidden (see alibabaModelToModelDescription).
// - Thinking control: thinking-capable models expose a 'Thinking' toggle (Off/On; unset = vendor default, usually on)
//   via _PS_Thinking, mapped to Qwen's `enable_thinking` in the 'alibaba' dialect (openai.chatCompletions.ts).
//   Verified live on qwen3.x + DashScope-hosted DeepSeek-V4 / GLM-5.2. Kimi K2.7 Code is always-on (reasoning flag, no toggle).

// 'Thinking' toggle backed by Qwen's binary enable_thinking - renders as Off ('none') / On ('high') / Default (unset).
const _PS_Thinking: ModelDescriptionSchema['parameterSpecs'] = [
  { paramId: 'llmVndMiscEffort', enumValues: ['none', 'high'] },
] as const;

const _knownAlibabaChatModels = llmsDefineManualMappings([

  // --- Qwen flagship / current generation ---
  {
    idPrefix: 'qwen3.7-max',
    label: 'Qwen3.7 Max',
    parameterSpecs: _PS_Thinking,
    pubDate: '20260622',
    description: 'Flagship agent model with native extended thinking and 1M context. Text-only; strong at coding, productivity, and long-horizon autonomous tasks.',
    contextWindow: 1000000, // 1M
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning], // text-only (no vision)
    maxCompletionTokens: 65536, // ~66K
    chatPrice: { input: 2.50, output: 7.50, cache: { cType: 'oai-ac', read: 0.50 } }, // implicit cache hit 0.50 (explicit hit 0.25)
  },
  {
    idPrefix: 'qwen3.7-plus',
    label: 'Qwen3.7 Plus',
    parameterSpecs: _PS_Thinking,
    pubDate: '20260601',
    description: 'Multimodal agent model with 1M context, native thinking, and vision/video understanding. Lower cost than Max.',
    contextWindow: 1000000, // 1M
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning],
    maxCompletionTokens: 65536, // 64K
    chatPrice: {
      input: [{ upTo: 256000, price: 0.40 }, { upTo: null, price: 1.20 }],
      output: [{ upTo: 256000, price: 1.60 }, { upTo: null, price: 4.80 }],
    }, // implicit cache: 0.08 (<=256K) / 0.24 (>256K)
  },
  {
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
  {
    idPrefix: 'deepseek-v4-pro',
    label: 'DeepSeek V4 Pro (Alibaba)',
    parameterSpecs: _PS_Thinking,
    pubDate: '20260623',
    description: 'DeepSeek V4 Pro served via Alibaba Model Studio (Alibaba pricing, ~5x DeepSeek-direct). 1M context, thinking.',
    contextWindow: 1_048_576, // 1M
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    maxCompletionTokens: 65536,
    chatPrice: { input: 2.40, output: 4.80, cache: { cType: 'oai-ac', read: 0.20 } },
  },
  {
    idPrefix: 'deepseek-v4-flash',
    label: 'DeepSeek V4 Flash (Alibaba)',
    parameterSpecs: _PS_Thinking,
    pubDate: '20260622',
    description: 'DeepSeek V4 Flash served via Alibaba Model Studio. 1M context, thinking.',
    contextWindow: 1_048_576, // 1M
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    maxCompletionTokens: 65536,
    chatPrice: { input: 0.20, output: 0.40, cache: { cType: 'oai-ac', read: 0.04 } },
  },
  {
    idPrefix: 'glm-5.2',
    label: 'GLM-5.2 (Alibaba)',
    parameterSpecs: _PS_Thinking,
    pubDate: '20260626',
    description: 'Zhipu GLM-5.2 served via Alibaba Model Studio. 1M context, thinking. (Alibaba pricing not yet published.)',
    contextWindow: 1048576, // 1M
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    maxCompletionTokens: 131072, // 128K
    // chatPrice: not published on Alibaba Model Studio pricing page as of 2026-06-26
  },
  {
    idPrefix: 'kimi-k2.7-code',
    label: 'Kimi K2.7 Code (Alibaba)',
    pubDate: '20260626',
    description: 'Moonshot Kimi K2.7 Code served via Alibaba Model Studio. Multimodal, always-on thinking, 256K context. (Alibaba pricing not yet published.)',
    contextWindow: 262144, // 256K
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning],
    maxCompletionTokens: 32768,
    // chatPrice: not published on Alibaba Model Studio pricing page as of 2026-06-26
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

  // Re-hide dated snapshots / preview aliases (super-matches against a curated base get un-hidden by fromManualMapping)
  if (!md.hidden && (_ALIBABA_DATED_SNAPSHOT.test(alibabaModelId) || _ALIBABA_PREVIEW_ALIAS.test(alibabaModelId)))
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
