import type { OpenAIWire_API_Models_List } from '~/modules/aix/server/dispatch/wiretypes/openai.wiretypes';

import type { DModelParameterId } from '~/common/stores/llms/llms.parameters';
import { DModelInterfaceV1, LLM_IF_HOTFIX_NoTemperature, LLM_IF_HOTFIX_StripImages, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_PromptCaching, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Responses, LLM_IF_OAI_Vision, LLM_IF_Outputs_Audio } from '~/common/stores/llms/llms.types';
import { Release } from '~/common/app.release';

import type { ModelDescriptionSchema, OrtVendorLookupResult } from '../../llm.server.types';
import { createVariantInjector, ModelVariantMap } from '../../llm.server.variants';
import { formatPubDate, fromManualMapping, type KnownLink, type KnownModel, llmDevCheckModels_DEV, llmsDefineModels } from '../../models.mappings';

// --- OpenAI Model ID inference (auto-derived from _knownOpenAIChatModels) ---
export type LlmsOpenAIModelId = typeof _knownOpenAIChatModels[number]['idPrefix'];


// OpenAI Model Variants
export const hardcodedOpenAIVariants: ModelVariantMap = {

  // GPT-6 Astra: Pro reasoning mode, carried over from 5.6 (not yet probed on Astra; Sol Pro: whole answers, ~1.7K token scaffold)
  'gpt-6-astra': {
    idVariant: '::pro',
    label: 'GPT-6 Astra Pro',
    description: 'GPT-6 Astra with Pro reasoning mode: performs additional model work for the hardest problems. Answers arrive whole (no incremental streaming), billed at standard GPT-6 Astra rates.',
    parameterSpecs: [
      { paramId: 'llmVndOaiReasoningMode', initialValue: 'pro', hidden: true }, // factory 'pro', not changeable
      { paramId: 'llmVndOaiEffort', enumValues: ['low', 'medium', 'high', 'xhigh', 'max'], initialValue: 'medium' },
      { paramId: 'llmVndOaiWebSearchContext' },
      { paramId: 'llmVndOaiVerbosity' },
      { paramId: 'llmVndOaiImageGeneration' },
      { paramId: 'llmVndOaiCodeInterpreter' },
      { paramId: 'llmForceNoStream' },
    ],
  },

  // GPT-5.6 Sol: Pro reasoning mode (successor to the standalone '-pro' models - gpt-5.6-pro does not exist),
  // and reasoning disabled (non-thinking) - both verified live 2026-07-10
  'gpt-5.6-sol': [
    {
      idVariant: '::pro',
      label: 'GPT-5.6 Sol Pro',
      // Empirical (2026-07-10): answers arrive whole (single terminal SSE delta, like 5.5 Pro, but much faster - ~5s vs ~34s
      // on a trivial prompt); each request adds ~1.7K billed input tokens of orchestration scaffold; background mode supported.
      description: 'GPT-5.6 Sol with Pro reasoning mode: performs additional model work for the hardest problems. Answers arrive whole (no incremental streaming) and requests carry a ~1.7K input token overhead, billed at standard GPT-5.6 Sol rates.',
      parameterSpecs: [
        { paramId: 'llmVndOaiReasoningMode', initialValue: 'pro', hidden: true }, // factory 'pro', not changeable
        { paramId: 'llmVndOaiEffort', enumValues: ['none', 'low', 'medium', 'high', 'xhigh', 'max'], initialValue: 'medium' },
        { paramId: 'llmVndOaiWebSearchContext' },
        { paramId: 'llmVndOaiVerbosity' },
        { paramId: 'llmVndOaiImageGeneration' },
        { paramId: 'llmVndOaiCodeInterpreter' },
        { paramId: 'llmForceNoStream' },
      ],
    },
    {
      idVariant: '::thinking-none',
      label: 'GPT-5.6 Sol (No-thinking)',
      hidden: true, // hidden by default as redundant, user can unhide in settings
      description: 'Supports temperature control for creative applications. GPT-5.6 Sol with reasoning disabled (reasoning_effort=none).',
      interfaces: [LLM_IF_OAI_Responses, LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_PromptCaching], // NO LLM_IF_OAI_Reasoning, NO LLM_IF_HOTFIX_NoTemperature
      parameterSpecs: [
        { paramId: 'llmVndOaiEffort', enumValues: ['none', 'low', 'medium', 'high', 'xhigh', 'max'], initialValue: 'none', hidden: true }, // factory 'none', not changeable
        { paramId: 'llmVndOaiWebSearchContext' },
        { paramId: 'llmVndOaiVerbosity' },
        { paramId: 'llmVndOaiImageGeneration' },
        { paramId: 'llmVndOaiCodeInterpreter' },
        { paramId: 'llmForceNoStream' },
      ],
    },
  ],

  // NOTE: temperature-at-effort-none is probe-verified on Terra/Luna too, but per the flagship-only precedent
  // (5.2/5.4/5.5 minis never got one) only Sol gets a No-thinking variant.

  // GPT-5.5 with reasoning disabled (non-thinking) - supports temperature control
  'gpt-5.5-2026-04-23': {
    idVariant: '::thinking-none',
    label: 'GPT-5.5 (No-thinking)',
    hidden: true, // hidden by default as redundant, user can unhide in settings
    description: 'Supports temperature control for creative applications. GPT-5.5 with reasoning disabled (reasoning_effort=none).',
    interfaces: [LLM_IF_OAI_Responses, LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_PromptCaching], // NO LLM_IF_OAI_Reasoning, NO LLM_IF_HOTFIX_NoTemperature
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['none', 'low', 'medium', 'high', 'xhigh'], initialValue: 'none', hidden: true }, // factory 'none', not changeable
      { paramId: 'llmVndOaiWebSearchContext' },
      { paramId: 'llmVndOaiVerbosity' },
      { paramId: 'llmVndOaiImageGeneration' },
      { paramId: 'llmVndOaiCodeInterpreter' },
      { paramId: 'llmForceNoStream' },
    ],
  },

  // GPT-5.4 with reasoning disabled (non-thinking) - supports temperature control
  'gpt-5.4-2026-03-05': {
    idVariant: '::thinking-none',
    label: 'GPT-5.4 (No-thinking)',
    hidden: true, // hidden by default as redundant, user can unhide in settings
    description: 'Supports temperature control for creative applications. GPT-5.4 with reasoning disabled (reasoning_effort=none).',
    interfaces: [LLM_IF_OAI_Responses, LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_PromptCaching], // NO LLM_IF_OAI_Reasoning, NO LLM_IF_HOTFIX_NoTemperature
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['none', 'low', 'medium', 'high', 'xhigh'], initialValue: 'none', hidden: true }, // factory 'none', not changeable
      { paramId: 'llmVndOaiWebSearchContext' },
      { paramId: 'llmVndOaiVerbosity' },
      { paramId: 'llmVndOaiImageGeneration' },
      { paramId: 'llmVndOaiCodeInterpreter' },
      { paramId: 'llmForceNoStream' },
    ],
  },

  // GPT-5.2 with reasoning disabled (non-thinking) - supports temperature control
  // Per https://platform.openai.com/docs/guides/latest-model#gpt-5-2-parameter-compatibility
  // temperature, top_p, logprobs are only supported when reasoning_effort=none
  'gpt-5.2-2025-12-11': {
    idVariant: '::thinking-none',
    label: 'GPT-5.2 (No-thinking)',
    hidden: true, // hidden by default as redundant, user can unhide in settings
    description: 'Supports temperature control for creative applications. GPT-5.2 with reasoning disabled (reasoning_effort=none).',
    interfaces: [LLM_IF_OAI_Responses, LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_PromptCaching], // NO LLM_IF_OAI_Reasoning, NO LLM_IF_HOTFIX_NoTemperature
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['none', 'low', 'medium', 'high', 'xhigh'], initialValue: 'none', hidden: true }, // factory 'none', not changeable
      { paramId: 'llmVndOaiWebSearchContext' },
      { paramId: 'llmVndOaiVerbosity' },
      { paramId: 'llmVndOaiImageGeneration' },
      { paramId: 'llmVndOaiCodeInterpreter' },
      { paramId: 'llmForceNoStream' },
    ],
  },

  // GPT-5 with web search enabled by default
  // 'gpt-5-2025-08-07': {
  //   idVariant: 'search',
  //   label: 'GPT-5 + Search',
  //   description: 'GPT-5 with web search enabled by default for up-to-date information and research.',
  //   parameterSpecs: [
  //     // customize this param
  //     { paramId: 'llmVndOaiWebSearchContext', initialValue: 'medium', hidden: true }, // Search enabled by default
  //     // copy other params
  //     { paramId: 'llmVndOaiEffort', enumValues: ['minimal', 'low', 'medium', 'high'] },
  //     { paramId: 'llmVndOaiRestoreMarkdown' },
  //     { paramId: 'llmVndOaiVerbosity' },
  //     { paramId: 'llmVndOaiImageGeneration' },
  //   ],
  //   benchmark: { cbaElo: 1442 + 1 }, // +1 from base GPT-5
  // },

} as const;


// configuration
const DEV_DEBUG_OPENAI_MODELS = Release.IsNodeDevBuild; // not in staging to reduce noise


// per-family interfaces
const IFS_GPT_AUDIO: DModelInterfaceV1[] = [LLM_IF_OAI_Chat, LLM_IF_Outputs_Audio] as const;
const IFS_CHAT_MIN: DModelInterfaceV1[] = [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn] as const;
const IFS_CHAT_CACHE: DModelInterfaceV1[] = [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_PromptCaching] as const;
const IFS_CHAT_CACHE_REASON: DModelInterfaceV1[] = [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_PromptCaching, LLM_IF_OAI_Reasoning] as const;
// NOTE: LLM_IF_Tools_WebSearch and LLM_IF_Outputs_Image are auto-implied by llmsAutoImplyInterfaces() from parameterSpecs - no need to add them manually


// [OpenAI] Known Chat Models
// https://platform.openai.com/docs/models
// https://platform.openai.com/docs/pricing
// pubDate is REQUIRED on every real model entry (same pattern as _ZaiModelDef in zai.models.ts).
type _OpenAIModelDef = (KnownModel & { pubDate: string }) | KnownLink;

export const _knownOpenAIChatModels = llmsDefineModels<_OpenAIModelDef>()([

  /// GPT-6 series - released September 3, 2026 (Trusted Access enterprises first; API and ChatGPT plans "in the coming days")
  // Single tier so far; the id is the stable pointer (no dated snapshot, no bare 'gpt-6' alias in the docs).
  // From the official model page + guide (2026-09-03), not yet live-probed:
  // - 1,050,000 context (922,000 max input) / 128,000 max output / knowledge cutoff Apr 30, 2026; text+image in, text out
  // - reasoning.effort: low|medium|high|xhigh|max - 'none' and 'minimal' rejected, so no No-thinking variant; reasoning.mode 'pro' works
  // - no temperature/top_p/logprobs; tool calling requires the Responses API (Chat Completions: text only)
  // - tools: web_search, file_search, image_generation, code_interpreter, hosted_shell, apply_patch, skills, computer_use, mcp, tool_search
  // - not modeled in chatPrice: cache WRITE $12.50 (1.25x input, see the 5.6 FIXME below), Batch/Flex 50%, Fast 2x
  // Shipped alongside, not adopted: async tool calling (`async: true` on tools), mid-turn steering over WebSockets,
  // `configuration_update` input items (change effort mid-conversation, cache prefix intact), `prompt_cache_options.ttl: '30m'`
  // replacing `prompt_cache_retention`, asynchronous misalignment monitoring (can stop a conversation for review).

  // GPT-6 Astra - flagship
  {
    idPrefix: 'gpt-6-astra',
    label: 'GPT-6 Astra',
    pubDate: '20260903',
    description: 'Most capable OpenAI model, built for the hardest end-to-end work: reasoning, coding, computer use, research, and document creation. Fewer output tokens per task than GPT-5.6 Sol. 1M token context.',
    contextWindow: 1050000,
    maxCompletionTokens: 128000,
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_CACHE_REASON, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['low', 'medium', 'high', 'xhigh', 'max'], initialValue: 'medium' },
      { paramId: 'llmVndOaiReasoningMode' },
      { paramId: 'llmVndOaiWebSearchContext' },
      { paramId: 'llmVndOaiVerbosity' },
      { paramId: 'llmVndOaiImageGeneration' },
      { paramId: 'llmVndOaiCodeInterpreter' },
      { paramId: 'llmForceNoStream' },
    ],
    chatPrice: { // >272K input tokens: the full request bills at 2x input/cache, 1.5x output
      input: [{ upTo: 272000, price: 10 }, { upTo: null, price: 20 }],
      output: [{ upTo: 272000, price: 50 }, { upTo: null, price: 75 }],
      cache: { cType: 'oai-ac', read: [{ upTo: 272000, price: 1 }, { upTo: null, price: 2 }] },
    },
    // benchmark: no arena data yet
  },


  /// GPT-5.6 series - Announced June 26, 2026 (limited preview); GA on the API July 9, 2026 (tier pointers listed on /v1/models)
  // New naming: the number is the generation; Sol/Terra/Luna are durable capability tiers (intelligence/balance/cost).
  // Model IDs are the stable tier pointers - no dated snapshots (OpenAI: tiers "advance on their own cadence"); the
  // 'gpt-5.6' alias routes to Sol (docs-official; not yet listed - the symLink below activates if/when it appears).
  // Verified live 2026-07-10 (API probes + official model pages), identical across all three tiers:
  // - 1,050,000 context window / 128,000 max output tokens / knowledge cutoff Feb 16, 2026
  // - reasoning.effort: none|low|medium|high|xhigh|max ('max' is new, #1159; 'minimal' rejected; no 'ultra' - earlier preview note was wrong)
  // - reasoning.mode: standard|pro (#1158) - 'pro' replaces the standalone '-pro' models (gpt-5.6-pro does not exist);
  //   orthogonal to effort (works with none..max), streams, takes summary=detailed; billed at standard token rates
  // - temperature/top_p only with effort=none; verbosity low|medium|high; web_search/code_interpreter/image_generation all work
  // ADOPTED 2026-07-30: retained reasoning - the adapter hardwires reasoning.context 'all_turns' on gpt-5.4+
  // (no user parameter; the lever is the chat 'Reasoning traces' policy). API-verified: 5.4+ incl. mini/nano/pro
  // accept it, 5.3-codex and older 400 on it; only consumed reasoning items are billed, and old/foreign items
  // are ignored for free, so replaying full reasoning history is always safe. Also adopted: assistant message
  // 'phase' (commentary|final_answer), captured/replayed via _vnd.openai.phase on text fragments.
  // NOT yet adopted (shipped Jul 9 alongside 5.6, per API changelog): programmatic tool calling, explicit
  // prompt-cache controls, image detail 'original'.
  // FIXME: PRICING NOTE: 5.6 bills prompt-cache WRITES at 1.25x the input rate - the 'oai-ac' chatPrice shape has no
  //        write field (it assumes writes cost the same as input), so the cache-write surcharge is not modeled.

  // GPT-5.6 Sol - flagship
  {
    idPrefix: 'gpt-5.6-sol',
    label: 'GPT-5.6 Sol',
    pubDate: '20260709', // API GA (Jun 26 was the limited partner preview)
    description: 'Flagship next-generation model. Strongest yet for agentic coding, science, and cybersecurity, with the most robust safety stack to date. 1M token context.',
    contextWindow: 1050000,
    maxCompletionTokens: 128000,
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_CACHE_REASON, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['none', 'low', 'medium', 'high', 'xhigh', 'max'], initialValue: 'medium' },
      { paramId: 'llmVndOaiReasoningMode' },
      { paramId: 'llmVndOaiWebSearchContext' },
      { paramId: 'llmVndOaiVerbosity' },
      { paramId: 'llmVndOaiImageGeneration' },
      { paramId: 'llmVndOaiCodeInterpreter' },
      { paramId: 'llmForceNoStream' },
    ],
    chatPrice: { input: 4, cache: { cType: 'oai-ac', read: 0.4 }, output: 20 }, // cache read = 90% discount; 2026-08-21: -20% input, -33% output (promo through at least 2026-11-21)
    benchmark: { cbaElo: 1481 }, // gpt-5.6-sol-xhigh
  },

  // GPT-5.6 Terra - balanced
  {
    idPrefix: 'gpt-5.6-terra',
    label: 'GPT-5.6 Terra',
    pubDate: '20260709', // API GA (Jun 26 was the limited partner preview)
    description: 'Balanced model for efficient, high-volume everyday work. Competitive with GPT-5.5 at a fraction of the cost. 1M token context.',
    contextWindow: 1050000,
    maxCompletionTokens: 128000,
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_CACHE_REASON, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['none', 'low', 'medium', 'high', 'xhigh', 'max'], initialValue: 'medium' },
      { paramId: 'llmVndOaiReasoningMode' },
      { paramId: 'llmVndOaiWebSearchContext' },
      { paramId: 'llmVndOaiVerbosity' },
      { paramId: 'llmVndOaiImageGeneration' },
      { paramId: 'llmVndOaiCodeInterpreter' },
      { paramId: 'llmForceNoStream' },
    ],
    chatPrice: { input: 2, cache: { cType: 'oai-ac', read: 0.2 }, output: 12 }, // cache read = 90% discount; 2026-07-30: -20%
    benchmark: { cbaElo: 1464 }, // gpt-5.6-terra-xhigh
  },

  // GPT-5.6 Luna - fast & affordable
  {
    idPrefix: 'gpt-5.6-luna',
    label: 'GPT-5.6 Luna',
    pubDate: '20260709', // API GA (Jun 26 was the limited partner preview)
    description: 'Fastest, most affordable GPT-5.6 model for high-volume work. Strong capability at the lowest cost in the family. 1M token context.',
    contextWindow: 1050000, // official model page - same 1M-class as Sol/Terra (earlier 400K assumption was wrong)
    maxCompletionTokens: 128000,
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_CACHE_REASON, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['none', 'low', 'medium', 'high', 'xhigh', 'max'], initialValue: 'medium' },
      { paramId: 'llmVndOaiReasoningMode' },
      { paramId: 'llmVndOaiWebSearchContext' },
      { paramId: 'llmVndOaiVerbosity' },
      { paramId: 'llmVndOaiImageGeneration' },
      { paramId: 'llmVndOaiCodeInterpreter' },
      { paramId: 'llmForceNoStream' },
    ],
    chatPrice: { input: 0.2, cache: { cType: 'oai-ac', read: 0.02 }, output: 1.2 }, // cache read = 90% discount; 2026-07-30: -80%
    benchmark: { cbaElo: 1450 }, // gpt-5.6-luna-xhigh
  },
  {
    idPrefix: 'gpt-5.6',
    label: 'GPT-5.6',
    symLink: 'gpt-5.6-sol', // official alias: "gpt-5.6 routes requests to GPT-5.6 Sol" - generation works (probed 2026-08-17) but still absent from /v1/models, so this stays dormant
  },


  /// ChatGPT Instant - version-less rolling pointer to the Instant model currently served in ChatGPT.
  // No snapshots: OpenAI re-points it in place without notice (last moved 2026-08-06). Replaces the per-generation
  // 'gpt-5.x-chat-latest' ids, which are all shut down. Priced at $5 in / $30 out per 1M.
  {
    idPrefix: 'chat-latest',
    label: 'ChatGPT Instant',
    pubDate: '20260505', // API changelog 2026-05-05: "Released `chat-latest` snapshot which points to the latest Instant model currently used in ChatGPT"
    description: 'Points to the Instant model currently used in ChatGPT. Updated in place without notice - OpenAI recommends GPT-5.6 Sol for production.',
    contextWindow: 400000,
    maxCompletionTokens: 128000,
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_CACHE, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [
      // no effort/verbosity: both accept only 'medium', and responses carry 0 reasoning tokens (probed 2026-08-17)
      { paramId: 'llmVndOaiWebSearchContext' },
      { paramId: 'llmVndOaiImageGeneration' },
      { paramId: 'llmVndOaiCodeInterpreter' },
    ],
    chatPrice: { input: 5, cache: { cType: 'oai-ac', read: 0.5 }, output: 30 },
    // benchmark: not measurable - the pointer moves under a stable id
  },


  /// GPT-5.5 series - Released April 23, 2026

  // GPT-5.5
  {
    idPrefix: 'gpt-5.5-2026-04-23',
    label: 'GPT-5.5',
    pubDate: '20260423',
    description: 'New baseline for complex production workflows. Stronger task execution, more precise tool use, more efficient reasoning with fewer tokens. 1M token context.',
    contextWindow: 1050000,
    maxCompletionTokens: 128000,
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_CACHE_REASON, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['none', 'low', 'medium', 'high', 'xhigh'], initialValue: 'medium' }, // medium is the new default for 5.5
      { paramId: 'llmVndOaiWebSearchContext' },
      { paramId: 'llmVndOaiVerbosity' },
      { paramId: 'llmVndOaiImageGeneration' },
      { paramId: 'llmVndOaiCodeInterpreter' },
      { paramId: 'llmForceNoStream' },
    ],
    chatPrice: { input: 5, cache: { cType: 'oai-ac', read: 0.5 }, output: 30 },
    benchmark: { cbaElo: 1482 }, // gpt-5.5-high
  },
  {
    idPrefix: 'gpt-5.5',
    label: 'GPT-5.5',
    symLink: 'gpt-5.5-2026-04-23',
  },

  // GPT-5.5 Pro
  {
    idPrefix: 'gpt-5.5-pro-2026-04-23',
    label: 'GPT-5.5 Pro',
    pubDate: '20260423',
    description: 'Most capable model for complex tasks. Uses more compute for smarter, more precise responses on the hardest problems.',
    contextWindow: 1050000,
    maxCompletionTokens: 128000, // official docs: 128K max output (272K is the long-context pricing threshold, not output limit)
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_MIN, LLM_IF_OAI_Reasoning, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['medium', 'high', 'xhigh'] }, // Pro: no low/none
      { paramId: 'llmVndOaiWebSearchContext' },
      { paramId: 'llmVndOaiVerbosity' },
      { paramId: 'llmVndOaiImageGeneration' },
      { paramId: 'llmForceNoStream' },
    ],
    chatPrice: { input: 30, output: 180 },
    // benchmark: TBD
  },
  {
    idPrefix: 'gpt-5.5-pro',
    label: 'GPT-5.5 Pro',
    symLink: 'gpt-5.5-pro-2026-04-23',
  },


  /// GPT-5.4 series - Released March 5, 2026

  // GPT-5.4
  {
    idPrefix: 'gpt-5.4-2026-03-05',
    label: 'GPT-5.4',
    pubDate: '20260305',
    description: 'Most capable and efficient frontier model for professional work. Native computer use, improved reasoning, coding, and agentic workflows with 1M token context.',
    contextWindow: 1050000,
    maxCompletionTokens: 128000,
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_CACHE_REASON, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['none', 'low', 'medium', 'high', 'xhigh'], initialValue: 'medium' },
      { paramId: 'llmVndOaiWebSearchContext' },
      { paramId: 'llmVndOaiVerbosity' },
      { paramId: 'llmVndOaiImageGeneration' },
      { paramId: 'llmVndOaiCodeInterpreter' },
      { paramId: 'llmForceNoStream' },
    ],
    chatPrice: { input: 2.5, cache: { cType: 'oai-ac', read: 0.25 }, output: 15 },
    benchmark: { cbaElo: 1476 }, // gpt-5.4-high
  },
  {
    idPrefix: 'gpt-5.4',
    label: 'GPT-5.4',
    symLink: 'gpt-5.4-2026-03-05',
  },

  // GPT-5.4 Pro
  {
    idPrefix: 'gpt-5.4-pro-2026-03-05',
    label: 'GPT-5.4 Pro',
    pubDate: '20260305',
    description: 'Most capable model for complex tasks. Uses more compute for smarter, more precise responses on difficult problems.',
    contextWindow: 1050000,
    maxCompletionTokens: 128000, // official docs: 128K max output (272K is the long-context pricing threshold, not output limit)
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_MIN, LLM_IF_OAI_Reasoning, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['medium', 'high', 'xhigh'] },
      { paramId: 'llmVndOaiWebSearchContext' },
      { paramId: 'llmVndOaiVerbosity' },
      { paramId: 'llmVndOaiImageGeneration' },
      { paramId: 'llmForceNoStream' },
    ],
    chatPrice: { input: 30, output: 180 },
    // benchmark: TBD
  },
  {
    idPrefix: 'gpt-5.4-pro',
    label: 'GPT-5.4 Pro',
    symLink: 'gpt-5.4-pro-2026-03-05',
  },

  // GPT-5.4 Mini - Released March 17, 2026
  {
    idPrefix: 'gpt-5.4-mini-2026-03-17',
    label: 'GPT-5.4 Mini',
    pubDate: '20260317',
    description: 'Strongest mini model for coding, computer use, and subagents. GPT-5.4-class intelligence at lower cost and latency.',
    contextWindow: 400000,
    maxCompletionTokens: 128000,
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_CACHE_REASON, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['none', 'low', 'medium', 'high', 'xhigh'], initialValue: 'medium' },
      { paramId: 'llmVndOaiWebSearchContext' },
      { paramId: 'llmVndOaiVerbosity' },
      { paramId: 'llmVndOaiImageGeneration' },
      { paramId: 'llmVndOaiCodeInterpreter' },
      { paramId: 'llmForceNoStream' },
    ],
    chatPrice: { input: 0.75, cache: { cType: 'oai-ac', read: 0.075 }, output: 4.5 },
    benchmark: { cbaElo: 1448 }, // gpt-5.4-mini-high
  },
  {
    idPrefix: 'gpt-5.4-mini',
    label: 'GPT-5.4 Mini',
    symLink: 'gpt-5.4-mini-2026-03-17',
  },

  // GPT-5.4 Nano - Released March 17, 2026
  {
    idPrefix: 'gpt-5.4-nano-2026-03-17',
    label: 'GPT-5.4 Nano',
    pubDate: '20260317',
    description: 'Cheapest GPT-5.4-class model for simple high-volume tasks like classification and data extraction.',
    contextWindow: 400000,
    maxCompletionTokens: 128000,
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_CACHE_REASON, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['none', 'low', 'medium', 'high', 'xhigh'], initialValue: 'medium' },
      { paramId: 'llmVndOaiWebSearchContext' },
      { paramId: 'llmVndOaiVerbosity' },
      { paramId: 'llmVndOaiImageGeneration' },
      { paramId: 'llmVndOaiCodeInterpreter' },
      { paramId: 'llmForceNoStream' },
    ],
    chatPrice: { input: 0.2, cache: { cType: 'oai-ac', read: 0.02 }, output: 1.25 },
    benchmark: { cbaElo: 1402 }, // gpt-5.4-nano-high
  },
  {
    idPrefix: 'gpt-5.4-nano',
    label: 'GPT-5.4 Nano',
    symLink: 'gpt-5.4-nano-2026-03-17',
  },


  /// GPT-5.3 series

  // GPT-5.3 Codex - Released February 5, 2026
  {
    idPrefix: 'gpt-5.3-codex',
    label: 'GPT-5.3 Codex',
    pubDate: '20260205',
    description: 'Most capable agentic coding model. Combines frontier coding performance of GPT-5.2-Codex with reasoning and professional knowledge of GPT-5.2. ~25% faster.',
    contextWindow: 400000,
    maxCompletionTokens: 128000,
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_CACHE_REASON, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['none', 'low', 'medium', 'high', 'xhigh'] },
      { paramId: 'llmVndOaiWebSearchContext' },
      { paramId: 'llmVndOaiVerbosity' },
      { paramId: 'llmVndOaiImageGeneration' },
      { paramId: 'llmForceNoStream' },
    ],
    chatPrice: { input: 1.75, cache: { cType: 'oai-ac', read: 0.175 }, output: 14 },
    // benchmark: TBD
  },

  // GPT-5.3 Codex Spark: removed, no longer returned by API (was ChatGPT Pro / design-partner only)

  // GPT-5.3 Chat Latest: removed, shut down August 10, 2026 (404 deprecated on OpenAI, 'No endpoints found' on OpenRouter - probed 2026-08-17)


  /// GPT-5.2 series - Released December 11, 2025

  // GPT-5.2
  {
    hidden: true, // superseded by GPT-5.4/5.5
    idPrefix: 'gpt-5.2-2025-12-11',
    label: 'GPT-5.2',
    pubDate: '20251211',
    description: 'Most capable model for professional work and long-running agents. Improvements in general intelligence, long-context, agentic tool-calling, and vision.',
    contextWindow: 400000,
    maxCompletionTokens: 128000,
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_CACHE_REASON, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['none', 'low', 'medium', 'high', 'xhigh'], initialValue: 'medium' /* our decision: set to medium to have thinking - clones can set to 'none' to have temperature */ },
      { paramId: 'llmVndOaiWebSearchContext' },
      { paramId: 'llmVndOaiVerbosity' },
      { paramId: 'llmVndOaiImageGeneration' },
      { paramId: 'llmVndOaiCodeInterpreter' },
      { paramId: 'llmForceNoStream' },
    ],
    chatPrice: { input: 1.75, cache: { cType: 'oai-ac', read: 0.175 }, output: 14 },
    benchmark: { cbaElo: 1437 }, // gpt-5.2-high
  },
  {
    hidden: true, // superseded by GPT-5.4/5.5
    idPrefix: 'gpt-5.2',
    label: 'GPT-5.2',
    symLink: 'gpt-5.2-2025-12-11',
  },

  // GPT-5.2 Codex - dead on OpenAI (shut down 2026-07-23, deny-listed below), but the def is kept:
  // OpenRouter still serves it via Azure (llmOrtOaiLookup needs it) - probed alive 2026-08-06
  {
    hidden: true, // dead on OpenAI direct; reachable via OpenRouter (Azure)
    idPrefix: 'gpt-5.2-codex',
    label: 'GPT-5.2 Codex [Deprecated]',
    pubDate: '20251211',
    isLegacy: true,
    description: '[Use: GPT-5.6 Sol - Shut down: 2026-07-23] GPT-5.2 optimized for long-horizon, agentic coding tasks in Codex or similar environments. Supports low, medium, high, and xhigh reasoning effort settings.',
    contextWindow: 400000,
    maxCompletionTokens: 128000,
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_CACHE_REASON, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [
      { paramId: 'llmForceNoStream' },
      { paramId: 'llmVndOaiEffort', enumValues: ['low', 'medium', 'high', 'xhigh'] },
      { paramId: 'llmVndOaiWebSearchContext' },
      { paramId: 'llmVndOaiImageGeneration' },
    ],
    chatPrice: { input: 1.75, cache: { cType: 'oai-ac', read: 0.175 }, output: 14 },
    // benchmark: TBD
  },

  // GPT-5.2 Chat Latest: removed, shut down August 10, 2026 (dead on OpenAI and OpenRouter - probed 2026-08-17)

  // GPT-5.2 Pro
  {
    hidden: true, // superseded by GPT-5.4/5.5 Pro
    idPrefix: 'gpt-5.2-pro-2025-12-11',
    label: 'GPT-5.2 Pro',
    pubDate: '20251211',
    description: 'Smartest and most trustworthy option for difficult questions. Uses more compute for harder thinking on complex domains like programming.',
    contextWindow: 400000,
    maxCompletionTokens: 128000, // official docs: 128K max output (272K is input limit within 400K context)
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_MIN, LLM_IF_OAI_Reasoning, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['medium', 'high', 'xhigh'] },
      { paramId: 'llmVndOaiWebSearchContext' },
      { paramId: 'llmVndOaiVerbosity' },
      { paramId: 'llmVndOaiImageGeneration' },
      { paramId: 'llmForceNoStream' },
    ],
    chatPrice: { input: 21, output: 168 },
    // benchmark: TBD
  },
  {
    hidden: true, // superseded by GPT-5.4/5.5 Pro
    idPrefix: 'gpt-5.2-pro',
    label: 'GPT-5.2 Pro',
    symLink: 'gpt-5.2-pro-2025-12-11',
  },


  /// GPT-5.1 series - Released November 13, 2025

  // GPT-5.1
  {
    hidden: true, // superseded by GPT-5.4/5.5
    idPrefix: 'gpt-5.1-2025-11-13',
    label: 'GPT-5.1',
    pubDate: '20251113',
    description: 'The best model for coding and agentic tasks with configurable reasoning effort.',
    contextWindow: 400000,
    maxCompletionTokens: 128000,
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_CACHE_REASON, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['none', 'low', 'medium', 'high'] }, { paramId: 'llmVndOaiWebSearchContext' },
      { paramId: 'llmVndOaiVerbosity' },
      { paramId: 'llmVndOaiImageGeneration' },
      { paramId: 'llmVndOaiCodeInterpreter' },
      { paramId: 'llmForceNoStream' },
    ],
    chatPrice: { input: 1.25, cache: { cType: 'oai-ac', read: 0.125 }, output: 10 },
    benchmark: { cbaElo: 1455 }, // gpt-5.1-high
  },
  {
    hidden: true, // superseded by GPT-5.4/5.5
    idPrefix: 'gpt-5.1',
    label: 'GPT-5.1',
    symLink: 'gpt-5.1-2025-11-13',
  },

  // GPT-5.1 Chat Latest: removed, shut down July 23, 2026 (dead on OpenRouter too - 'No endpoints found', probed 2026-08-06)

  // GPT-5.1 Codex Max / Codex / Codex Mini - dead on OpenAI (shut down 2026-07-23, deny-listed below), but
  // the defs are kept: OpenRouter still serves all three via Azure (llmOrtOaiLookup) - probed alive 2026-08-06
  {
    hidden: true, // dead on OpenAI direct; reachable via OpenRouter (Azure)
    idPrefix: 'gpt-5.1-codex-max',
    label: 'GPT-5.1 Codex Max [Deprecated]',
    pubDate: '20251119',
    isLegacy: true,
    description: '[Use: GPT-5.6 Sol - Shut down: 2026-07-23] Our most intelligent coding model optimized for long-horizon, agentic coding tasks.',
    contextWindow: 400000,
    maxCompletionTokens: 128000,
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_CACHE_REASON, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['low', 'medium', 'high', 'xhigh'] },
      { paramId: 'llmVndOaiWebSearchContext' },
      { paramId: 'llmVndOaiImageGeneration' },
      { paramId: 'llmForceNoStream' },
    ],
    chatPrice: { input: 1.25, cache: { cType: 'oai-ac', read: 0.125 }, output: 10 },
    // benchmark: TBD
  },
  {
    hidden: true, // dead on OpenAI direct; reachable via OpenRouter (Azure)
    idPrefix: 'gpt-5.1-codex-mini',
    label: 'GPT-5.1 Codex Mini [Deprecated]',
    pubDate: '20251113',
    isLegacy: true,
    description: '[Use: GPT-5.6 Terra - Shut down: 2026-07-23] Smaller, faster version of GPT-5.1 Codex for efficient coding tasks.',
    contextWindow: 400000,
    maxCompletionTokens: 128000,
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_CACHE_REASON, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['low', 'medium', 'high'] }, // low, medium, high (no minimal)
      { paramId: 'llmVndOaiWebSearchContext' },
      { paramId: 'llmVndOaiImageGeneration' },
      { paramId: 'llmForceNoStream' },
    ],
    chatPrice: { input: 0.25, cache: { cType: 'oai-ac', read: 0.025 }, output: 2 },
    // benchmark: TBD
  },
  {
    hidden: true, // dead on OpenAI direct; reachable via OpenRouter (Azure)
    idPrefix: 'gpt-5.1-codex',
    label: 'GPT-5.1 Codex [Deprecated]',
    pubDate: '20251113',
    isLegacy: true,
    description: '[Use: GPT-5.6 Sol - Shut down: 2026-07-23] A version of GPT-5.1 optimized for agentic coding tasks in Codex or similar environments.',
    contextWindow: 400000,
    maxCompletionTokens: 128000,
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_CACHE_REASON, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['low', 'medium', 'high'] }, // low, medium, high (no minimal)
      { paramId: 'llmVndOaiWebSearchContext' },
      { paramId: 'llmVndOaiImageGeneration' },
      { paramId: 'llmForceNoStream' },
    ],
    chatPrice: { input: 1.25, cache: { cType: 'oai-ac', read: 0.125 }, output: 10 },
    // benchmark: TBD
  },


  /// GPT-5 series - Released August 7, 2025

  // GPT-5
  {
    hidden: true, // deprecated Jun 11, 2026, shutdown 2026-12-11
    idPrefix: 'gpt-5-2025-08-07',
    label: 'GPT-5 [Deprecated]',
    pubDate: '20250807',
    isLegacy: true,
    description: '[Use: GPT-5.6 Sol - Shut down: 2026-12-11] The best model for coding and agentic tasks across domains.',
    contextWindow: 400000,
    maxCompletionTokens: 128000,
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_CACHE_REASON, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['minimal', 'low', 'medium', 'high'] }, { paramId: 'llmVndOaiWebSearchContext' },
      { paramId: 'llmVndOaiVerbosity' }, // gpt-5-class nets have verbosity control
      { paramId: 'llmVndOaiImageGeneration' }, // image generation capability
      { paramId: 'llmVndOaiCodeInterpreter' }, // code execution in sandboxed container
      { paramId: 'llmForceNoStream' }, // non-streaming option for unverified organizations
    ],
    chatPrice: { input: 1.25, cache: { cType: 'oai-ac', read: 0.125 }, output: 10 },
    benchmark: { cbaElo: 1434 }, // gpt-5-high
  },
  {
    hidden: true, // superseded by GPT-5.4/5.5
    idPrefix: 'gpt-5',
    label: 'GPT-5',
    symLink: 'gpt-5-2025-08-07',
  },

  // GPT-5 Pro
  {
    hidden: true, // deprecated Jun 11, 2026, shutdown 2026-12-11
    idPrefix: 'gpt-5-pro-2025-10-06',
    label: 'GPT-5 Pro [Deprecated]',
    pubDate: '20251006',
    isLegacy: true,
    description: '[Use: GPT-5.6 Sol with Pro reasoning - Shut down: 2026-12-11] Version of GPT-5 that uses more compute to produce smarter and more precise responses. Designed for tough problems.',
    contextWindow: 400000,
    maxCompletionTokens: 128000, // official docs: 128K max output (272K is input limit within 400K context)
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_MIN, LLM_IF_OAI_Reasoning, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [{ paramId: 'llmVndOaiVerbosity' }, { paramId: 'llmVndOaiWebSearchContext' }, { paramId: 'llmVndOaiImageGeneration' }, { paramId: 'llmForceNoStream' }], // reasoning effort is fixed at 'high'
    chatPrice: { input: 15, output: 120 },
    // benchmark: has not been measured yet
  },
  {
    hidden: true, // superseded by GPT-5.4/5.5 Pro
    idPrefix: 'gpt-5-pro',
    label: 'GPT-5 Pro',
    symLink: 'gpt-5-pro-2025-10-06',
  },

  // GPT-5 Chat Latest: removed, shut down July 23, 2026
  // GPT-5 Codex: removed, shut down July 23, 2026

  // GPT-5 Search API
  {
    hidden: true, // poor quality - use llmVndOaiWebSearchContext on regular models instead
    idPrefix: 'gpt-5-search-api-2025-10-14',
    label: 'GPT-5 Search API',
    pubDate: '20251014',
    description: 'Updated web search model in Chat Completions API. 60% cheaper with domain filtering support.',
    contextWindow: 400000,
    maxCompletionTokens: 100000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision], // no function calling
    parameterSpecs: [{ paramId: 'llmVndOaiWebSearchContext', initialValue: 'medium' }], // Search enabled by default
    chatPrice: { input: 1.25, cache: { cType: 'oai-ac', read: 0.125 }, output: 10 },
    // benchmark: TBD
  },
  {
    hidden: true, // poor quality - use llmVndOaiWebSearchContext on regular models instead
    idPrefix: 'gpt-5-search-api',
    label: 'GPT-5 Search API',
    symLink: 'gpt-5-search-api-2025-10-14',
  },

  // GPT-5 mini
  {
    hidden: true, // deprecated Jun 11, 2026, shutdown 2026-12-11
    idPrefix: 'gpt-5-mini-2025-08-07',
    label: 'GPT-5 Mini [Deprecated]',
    pubDate: '20250807',
    isLegacy: true,
    description: '[Use: GPT-5.6 Terra - Shut down: 2026-12-11] A faster, more cost-efficient version of GPT-5 for well-defined tasks.',
    contextWindow: 400000,
    maxCompletionTokens: 128000,
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_CACHE_REASON, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [{ paramId: 'llmVndOaiEffort', enumValues: ['minimal', 'low', 'medium', 'high'] }, { paramId: 'llmVndOaiWebSearchContext' }, { paramId: 'llmVndOaiVerbosity' }, { paramId: 'llmVndOaiImageGeneration' }, { paramId: 'llmForceNoStream' }],
    chatPrice: { input: 0.25, cache: { cType: 'oai-ac', read: 0.025 }, output: 2 },
    benchmark: { cbaElo: 1390 }, // gpt-5-mini-high
  },
  {
    hidden: true, // superseded by GPT-5.4 Mini
    idPrefix: 'gpt-5-mini',
    label: 'GPT-5 Mini',
    symLink: 'gpt-5-mini-2025-08-07',
  },

  // GPT-5 nano
  {
    hidden: true, // deprecated Jun 11, 2026, shutdown 2026-12-11
    idPrefix: 'gpt-5-nano-2025-08-07',
    label: 'GPT-5 Nano [Deprecated]',
    pubDate: '20250807',
    isLegacy: true,
    description: '[Use: GPT-5.6 Luna - Shut down: 2026-12-11] Fastest, most cost-efficient version of GPT-5 for summarization and classification tasks.',
    contextWindow: 400000,
    maxCompletionTokens: 128000,
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_CACHE_REASON, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [{ paramId: 'llmVndOaiEffort', enumValues: ['minimal', 'low', 'medium', 'high'] }, { paramId: 'llmVndOaiWebSearchContext' }, { paramId: 'llmVndOaiVerbosity' }, { paramId: 'llmVndOaiImageGeneration' }],
    chatPrice: { input: 0.05, cache: { cType: 'oai-ac', read: 0.005 }, output: 0.4 },
    benchmark: { cbaElo: 1337 }, // gpt-5-nano-high
  },
  {
    hidden: true, // superseded by GPT-5.4 Nano
    idPrefix: 'gpt-5-nano',
    label: 'GPT-5 Nano',
    symLink: 'gpt-5-nano-2025-08-07',
  },


  // osb-120b: removed, no longer returned by API (was speculative)


  // computer-use-preview: removed, no longer returned by API (shut down 2026-07-23)
  // codex-mini-latest: removed, shut down February 12, 2026


  /// Reasoning models - o-series

  // o4-mini-deep-research: removed, shut down July 23, 2026

  /// o4-mini
  {
    hidden: true, // deprecated, shutdown 2026-10-23
    idPrefix: 'o4-mini-2025-04-16',
    label: 'o4 Mini [Deprecated]',
    pubDate: '20250416',
    isLegacy: true,
    description: '[Use: GPT-5.6 Terra - Shut down: 2026-10-23] Latest o4-mini model. Optimized for fast, effective reasoning with exceptionally efficient performance in coding and visual tasks.',
    contextWindow: 200000,
    maxCompletionTokens: 100000,
    interfaces: IFS_CHAT_CACHE_REASON,
    parameterSpecs: [{ paramId: 'llmVndOaiEffort', enumValues: ['low', 'medium', 'high', 'xhigh'] }],
    chatPrice: { input: 1.1, cache: { cType: 'oai-ac', read: 0.275 }, output: 4.4 },
    benchmark: { cbaElo: 1390 }, // o4-mini-2025-04-16
  },
  {
    idPrefix: 'o4-mini',
    label: 'o4 Mini',
    symLink: 'o4-mini-2025-04-16',
  },

  // o3-deep-research: removed, shut down July 23, 2026

  // o3-pro - (v1/responses API)
  {
    hidden: true, // deprecated Jun 11, 2026, shutdown 2026-12-11
    idPrefix: 'o3-pro-2025-06-10',
    label: 'o3 Pro [Deprecated]',
    pubDate: '20250610',
    isLegacy: true,
    description: '[Use: GPT-5.6 Sol with Pro reasoning - Shut down: 2026-12-11] Version of o3 with more compute for better responses. Provides consistently better answers for complex tasks.',
    contextWindow: 200000,
    maxCompletionTokens: 100000,
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_MIN, LLM_IF_OAI_Reasoning, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [{ paramId: 'llmVndOaiEffort', enumValues: ['low', 'medium', 'high'] }, { paramId: 'llmVndOaiWebSearchContext' }, { paramId: 'llmVndOaiImageGeneration' }, { paramId: 'llmForceNoStream' }],
    chatPrice: { input: 20, output: 80 },
    // benchmark: has not been measured yet
  },
  {
    idPrefix: 'o3-pro',
    label: 'o3 Pro',
    symLink: 'o3-pro-2025-06-10',
  },

  /// o3
  {
    hidden: true, // deprecated Jun 11, 2026, shutdown 2026-12-11
    idPrefix: 'o3-2025-04-16',
    label: 'o3 [Deprecated]',
    pubDate: '20250416',
    isLegacy: true,
    description: '[Use: GPT-5.6 Sol - Shut down: 2026-12-11] A well-rounded and powerful model across domains. Sets a new standard for math, science, coding, and visual reasoning tasks.',
    contextWindow: 200000,
    maxCompletionTokens: 100000,
    interfaces: IFS_CHAT_CACHE_REASON,
    parameterSpecs: [{ paramId: 'llmVndOaiEffort', enumValues: ['low', 'medium', 'high', 'xhigh'] }, { paramId: 'llmForceNoStream' }],
    chatPrice: { input: 2, cache: { cType: 'oai-ac', read: 0.5 }, output: 8 },
    benchmark: { cbaElo: 1431 }, // o3-2025-04-16
  },
  {
    idPrefix: 'o3',
    label: 'o3',
    symLink: 'o3-2025-04-16',
  },

  // o3-mini
  {
    hidden: true, // deprecated, shutdown 2026-10-23
    idPrefix: 'o3-mini-2025-01-31',
    label: 'o3 Mini [Deprecated]',
    pubDate: '20250131',
    isLegacy: true,
    description: '[Use: GPT-5.6 Sol - Shut down: 2026-10-23] Latest o3-mini model snapshot. High intelligence at the same cost and latency targets of o1-mini. Excels at science, math, and coding tasks.',
    contextWindow: 200000,
    maxCompletionTokens: 100000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_PromptCaching, LLM_IF_OAI_Reasoning, LLM_IF_HOTFIX_StripImages],
    parameterSpecs: [{ paramId: 'llmVndOaiEffort', enumValues: ['low', 'medium', 'high', 'xhigh'] }],
    chatPrice: { input: 1.1, cache: { cType: 'oai-ac', read: 0.55 }, output: 4.4 },
    benchmark: { cbaElo: 1348 }, // o3-mini
  },
  {
    idPrefix: 'o3-mini',
    label: 'o3 Mini',
    symLink: 'o3-mini-2025-01-31',
  },

  // o1-pro - (v1/responses API) 💎💰
  {
    hidden: true,
    idPrefix: 'o1-pro-2025-03-19',
    label: 'o1 Pro [Deprecated]',
    pubDate: '20250319',
    isLegacy: true,
    description: '[Use: GPT-5.6 Sol with Pro reasoning - Shut down: 2026-10-23] A version of o1 with more compute for better responses. Provides consistently better answers for complex tasks.',
    contextWindow: 200000,
    maxCompletionTokens: 100000,
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_MIN, LLM_IF_OAI_Reasoning, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [{ paramId: 'llmVndOaiEffort', enumValues: ['low', 'medium', 'high'] }, { paramId: 'llmForceNoStream' }],
    chatPrice: { input: 150, output: 600 },
    // benchmark: has not been measured yet by third parties
  },
  {
    idPrefix: 'o1-pro',
    label: 'o1 Pro',
    symLink: 'o1-pro-2025-03-19',
  },

  // o1
  {
    idPrefix: 'o1-2024-12-17',
    label: 'o1 [Deprecated]',
    pubDate: '20241217',
    isLegacy: true,
    description: '[Use: GPT-5.6 Sol - Shut down: 2026-10-23] Previous full o-series reasoning model.',
    contextWindow: 200000,
    maxCompletionTokens: 100000,
    interfaces: IFS_CHAT_CACHE_REASON,
    parameterSpecs: [{ paramId: 'llmVndOaiEffort', enumValues: ['low', 'medium', 'high', 'xhigh'] }, { paramId: 'llmVndOaiRestoreMarkdown' }],
    chatPrice: { input: 15, cache: { cType: 'oai-ac', read: 7.5 }, output: 60 },
    benchmark: { cbaElo: 1402 }, // o1-2024-12-17
  },
  {
    idPrefix: 'o1',
    label: 'o1',
    symLink: 'o1-2024-12-17',
  },


  /// GPT-4.1 series

  // GPT-4.1
  {
    idPrefix: 'gpt-4.1-2025-04-14',
    label: 'GPT-4.1',
    pubDate: '20250414',
    description: 'Flagship GPT model for complex tasks. Major improvements on coding, instruction following, and long context with 1M token context window.',
    contextWindow: 1047576,
    maxCompletionTokens: 32768,
    interfaces: IFS_CHAT_CACHE,
    chatPrice: { input: 2, cache: { cType: 'oai-ac', read: 0.5 }, output: 8 },
    benchmark: { cbaElo: 1414 }, // gpt-4.1-2025-04-14
  },
  {
    idPrefix: 'gpt-4.1',
    label: 'GPT-4.1',
    symLink: 'gpt-4.1-2025-04-14',
  },

  // GPT-4.1 mini
  {
    idPrefix: 'gpt-4.1-mini-2025-04-14',
    label: 'GPT-4.1 Mini',
    pubDate: '20250414',
    description: 'Balanced for intelligence, speed, and cost. Matches or exceeds GPT-4o in intelligence while reducing latency by nearly half and cost by 83%.',
    contextWindow: 1047576,
    maxCompletionTokens: 32768,
    interfaces: IFS_CHAT_CACHE,
    chatPrice: { input: 0.4, cache: { cType: 'oai-ac', read: 0.1 }, output: 1.6 },
    benchmark: { cbaElo: 1383 }, // gpt-4.1-mini-2025-04-14
  },
  {
    idPrefix: 'gpt-4.1-mini',
    label: 'GPT-4.1 Mini',
    symLink: 'gpt-4.1-mini-2025-04-14',
  },

  // GPT-4.1 nano
  {
    hidden: true, // deprecated Apr 22, 2026, shutdown 2026-10-23
    idPrefix: 'gpt-4.1-nano-2025-04-14',
    label: 'GPT-4.1 Nano [Deprecated]',
    pubDate: '20250414',
    isLegacy: true,
    description: '[Use: GPT-5.6 Luna - Shut down: 2026-10-23] Fastest, most cost-effective GPT 4.1 model. Delivers exceptional performance with low latency, ideal for tasks like classification or autocompletion.',
    contextWindow: 1047576,
    maxCompletionTokens: 32768,
    interfaces: IFS_CHAT_CACHE,
    chatPrice: { input: 0.1, cache: { cType: 'oai-ac', read: 0.025 }, output: 0.4 },
    benchmark: { cbaElo: 1322 }, // gpt-4.1-nano-2025-04-14
  },
  {
    idPrefix: 'gpt-4.1-nano',
    label: 'GPT-4.1 Nano',
    symLink: 'gpt-4.1-nano-2025-04-14',
  },


  /// GPT-Audio series - General availability audio models

  // gpt-audio-1.5
  {
    idPrefix: 'gpt-audio-1.5',
    label: 'GPT Audio 1.5',
    pubDate: '20260224',
    description: 'Best voice model for audio in, audio out with Chat Completions. Accepts audio inputs and outputs.',
    contextWindow: 128000,
    maxCompletionTokens: 16384,
    interfaces: IFS_GPT_AUDIO,
    chatPrice: { input: 2.5, output: 10 },
    // benchmark: TBD
  },

  // gpt-audio
  {
    hidden: true, // deprecated Jul 20, 2026, shutdown 2027-01-20
    idPrefix: 'gpt-audio-2025-08-28',
    label: 'GPT Audio [Deprecated]',
    pubDate: '20250828',
    isLegacy: true,
    description: '[Use: GPT Audio 1.5 - Shut down: 2027-01-20] First generally available audio model. Accepts audio inputs and outputs, and can be used in the Chat Completions REST API.',
    contextWindow: 128000,
    maxCompletionTokens: 16384,
    interfaces: IFS_GPT_AUDIO,
    chatPrice: { input: 2.5, output: 10 },
    // benchmark: TBD
  },
  {
    hidden: true, // superseded by GPT Audio 1.5
    idPrefix: 'gpt-audio',
    label: 'GPT Audio',
    symLink: 'gpt-audio-2025-08-28',
  },
  {
    idPrefix: 'gpt-audio-mini-2025-12-15',
    label: 'GPT Audio Mini [Deprecated]',
    pubDate: '20251215',
    isLegacy: true,
    description: '[Use: GPT Audio 1.5 - Shut down: 2027-01-20] Cost-efficient audio model. Accepts audio inputs and outputs via Chat Completions REST API.',
    contextWindow: 128000,
    maxCompletionTokens: 16384,
    interfaces: IFS_GPT_AUDIO,
    chatPrice: { input: 0.6, output: 2.4 },
  },
  // gpt-audio-mini-2025-10-06: removed, shut down July 23, 2026
  {
    idPrefix: 'gpt-audio-mini',
    label: 'GPT Audio Mini',
    symLink: 'gpt-audio-mini-2025-12-15',
  },


  /// GPT-Realtime series - REMOVED

  /// GPT-4/4o series

  // GPT-4o
  {
    idPrefix: 'gpt-4o-2024-11-20',
    label: 'GPT-4o',
    pubDate: '20241120',
    description: 'Snapshot of gpt-4o from November 20th, 2024.',
    contextWindow: 128000,
    maxCompletionTokens: 16384,
    interfaces: IFS_CHAT_CACHE,
    chatPrice: { input: 2.5, cache: { cType: 'oai-ac', read: 1.25 }, output: 10 },
    benchmark: { cbaElo: 1335 + 1 }, // not reported; using gpt-4o-2024-08-06 + 1
  },
  {
    idPrefix: 'gpt-4o-2024-08-06',
    label: 'GPT-4o',
    pubDate: '20240806',
    hidden: true, // previous version
    description: 'Snapshot that supports Structured Outputs. gpt-4o currently points to this version.',
    contextWindow: 128000,
    maxCompletionTokens: 16384,
    interfaces: IFS_CHAT_CACHE,
    chatPrice: { input: 2.5, cache: { cType: 'oai-ac', read: 1.25 }, output: 10 },
    benchmark: { cbaElo: 1335 }, // gpt-4o-2024-08-06
  },
  {
    idPrefix: 'gpt-4o-2024-05-13',
    label: 'GPT-4o [Deprecated]',
    pubDate: '20240513',
    hidden: true, // previous version
    isLegacy: true,
    description: '[Use: GPT-5.6 Sol - Shut down: 2026-10-23] Original gpt-4o snapshot from May 13, 2024.',
    contextWindow: 128000,
    maxCompletionTokens: 4096,
    interfaces: IFS_CHAT_MIN,
    chatPrice: { input: 5, output: 15 },
    benchmark: { cbaElo: 1346 }, // gpt-4o-2024-05-13
  },
  {
    idPrefix: 'gpt-4o',
    label: 'GPT-4o',
    symLink: 'gpt-4o-2024-08-06',
  },
  // chatgpt-4o-latest: removed, shut down February 17, 2026

  // GPT-4o Search Preview: removed, the zombie alias finally died too (404 deprecated on OpenAI, 'No endpoints found' on OpenRouter - probed 2026-08-24)

  // GPT-4o Audio Preview: removed, no longer returned by API (superseded by GPT Audio family)

  // GPT-4o mini
  {
    idPrefix: 'gpt-4o-mini-2024-07-18',
    label: 'GPT-4o Mini',
    pubDate: '20240718',
    description: 'Affordable model for fast, lightweight tasks. GPT-4o Mini is cheaper and more capable than GPT-3.5 Turbo.',
    contextWindow: 128000,
    maxCompletionTokens: 16384,
    interfaces: IFS_CHAT_CACHE,
    chatPrice: { input: 0.15, cache: { cType: 'oai-ac', read: 0.075 }, output: 0.6 },
    benchmark: { cbaElo: 1318 }, // gpt-4o-mini-2024-07-18
  },
  {
    idPrefix: 'gpt-4o-mini',
    label: 'GPT-4o mini',
    symLink: 'gpt-4o-mini-2024-07-18',
  },
  // GPT-4o Mini Audio Preview: removed, no longer returned by API (superseded by GPT Audio Mini family)

  // GPT-4o Mini Search Preview: removed, same as gpt-4o-search-preview above (dead on OpenAI and OpenRouter - probed 2026-08-24)

  // GPT-4 Turbo
  {
    idPrefix: 'gpt-4-turbo-2024-04-09',
    label: 'GPT-4 Turbo [Deprecated]',
    pubDate: '20240409',
    hidden: true, // OLD
    isLegacy: true,
    description: '[Use: GPT-5.6 Sol - Shut down: 2026-10-23] GPT-4 Turbo with Vision model. Vision requests can now use JSON mode and function calling. gpt-4-turbo currently points to this version.',
    contextWindow: 128000,
    maxCompletionTokens: 4096,
    interfaces: IFS_CHAT_MIN,
    chatPrice: { input: 10, output: 30 },
    benchmark: { cbaElo: 1324 }, // gpt-4-turbo-2024-04-09
  },
  {
    idPrefix: 'gpt-4-turbo',
    label: 'GPT-4 Turbo',
    symLink: 'gpt-4-turbo-2024-04-09',
  },
  // gpt-4-0125-preview / gpt-4-1106-preview / gpt-4-turbo-preview: removed, no longer returned by API

  // GPT4's
  {
    idPrefix: 'gpt-4-0613',
    label: 'GPT-4 [Deprecated]',
    pubDate: '20230613',
    hidden: true, // OLD
    description: '[Use: GPT-5.6 Sol - Shut down: 2026-10-23] Snapshot of gpt-4 from June 13th 2023 with improved function calling support. Data up to Sep 2021.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 30, output: 60 },
    benchmark: { cbaElo: 1275 }, // gpt-4-0613
    isLegacy: true,
  },
  // gpt-4-0314: removed, no longer returned by API
  {
    idPrefix: 'gpt-4',
    label: 'GPT-4',
    symLink: 'gpt-4-0613',
    isLegacy: true,
  },


  // 3.5
  // Note: As of July 2024, gpt-4o-mini should be used in place of gpt-3.5-turbo, as it is cheaper, more capable, multimodal, and just as fast.
  // As such, many 3.5 models are in the 'deny list' below, and not even returned to the UI.
  {
    idPrefix: 'gpt-3.5-turbo-0125',
    label: '3.5-Turbo [Deprecated]',
    pubDate: '20240125',
    hidden: true, // deprecated Apr 22, 2026, shutdown 2026-10-23
    isLegacy: true,
    description: '[Use: GPT-5.6 Terra - Shut down: 2026-10-23] The latest GPT-3.5 Turbo model with higher accuracy at responding in requested formats.',
    contextWindow: 16385,
    maxCompletionTokens: 4096,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.5, output: 1.5 },
    benchmark: { cbaElo: 1225 }, // gpt-3.5-turbo-0125
  },
  {
    idPrefix: 'gpt-3.5-turbo-1106',
    label: '3.5-Turbo [Deprecated]',
    pubDate: '20231106',
    hidden: true, // OLD
    isLegacy: true,
    description: '[Use: GPT-5.6 Terra - Shut down: 2026-09-28] GPT-3.5 Turbo model with improved instruction following, JSON mode, reproducible outputs, parallel function calling, and more.',
    contextWindow: 16385,
    maxCompletionTokens: 4096,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 1, output: 2 },
    benchmark: { cbaElo: 1203 }, // gpt-3.5-turbo-1106
  },
  {
    idPrefix: 'gpt-3.5-turbo',
    label: '3.5-Turbo',
    symLink: 'gpt-3.5-turbo-0125',
  },

]);


// -- 0-day or unknown models --

export function llmsFallbackForOpenAIModel(modelId: string, isLikelyOpenAI: boolean): KnownModel {
  if (!isLikelyOpenAI)
    return _llmsOpenAICompatModelFallback;
  return _isLikelyResponsesAPIModel(modelId) ? _llmsOpenAIModelResponsesFallback : _llmsOpenAIModelFallback;
}

// native OpenAI (and Azure deployments): the ids-only list discloses no type or context, so
// unknowns carry the uncurated marker (see llmsLabelUncurated) and a null (never guessed) context
const _llmsOpenAIModelFallback: KnownModel = {
  idPrefix: '',
  label: '[?]', // + ' [<id>]' via the variant append below
  description: 'Unknown OpenAI model, not yet curated - please let us know the ID.',
  contextWindow: null,
  interfaces: IFS_CHAT_MIN,
  // hidden: true,
};

const _llmsOpenAIModelResponsesFallback: KnownModel = {
  ..._llmsOpenAIModelFallback,
  description: 'Unknown OpenAI model, not yet curated - assuming Responses API support.',
  interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_MIN],
};

// OpenAI-compatible hosts: unknown is the norm there, so stay lenient and unmarked
// ('[?]' would mark every model and hold whole services off the registry-sync push)
const _llmsOpenAICompatModelFallback: KnownModel = {
  ..._llmsOpenAIModelFallback,
  label: '?', // + ' [<id>]'
  description: 'Unknown, please let us know the ID. Assuming a context window of 128k tokens, and a maximum output of 8k tokens.',
  contextWindow: 128000,
  maxCompletionTokens: 8192,
};

function _isLikelyResponsesAPIModel(modelId: string): boolean {
  // GPT-5+ family (gpt-5, gpt-5.1, gpt-5.2, gpt-6, etc.)
  if (/^gpt-[5-9]/.test(modelId)) return true;
  // o-series reasoning models with deep-research, pro variants (o3-pro, o4-pro, etc.)
  return /^o[3-9]-(pro|deep-research|mini)/.test(modelId);
}


// exact-match deny list (id must equal entry, not just include it) - use for ambiguous aliases
const openAIModelsDenyExactList: string[] = [
  // (empty) - 'chat-latest' graduated to a real documented+priced model and is defined above
];

const openAIModelsDenyList: string[] = [
  // [OpenAI, 2025-08-28] FIXME: NOT YET SUPPORTED - "REALTIME API"
  // 'gpt-realtime', // leave this just for kicks, but it's hidden by default and won't work if unhidden
  // '-realtime-',
  '4o-realtime',
  '4o-mini-realtime',
  'gpt-realtime',
  'gpt-realtime-mini',
  'gpt-realtime-1.5',
  'gpt-realtime-2',
  'gpt-realtime-translate',
  'gpt-realtime-whisper',

  // [OpenAI, 2025-03-11] Computer Use (Responses API) - NOT YET SUPPORTED; still returned by some accounts until shutdown 2026-07-23
  'computer-use-preview', // single entry catches '-2025-03-11' too via includes()

  // 'gpt-4.5-preview',
  // 'o1-preview',
  // 'gpt-4-32k',

  // Legacy GPT models
  'gpt-3.5-turbo-0301',
  'gpt-3.5-turbo-0613',
  'gpt-3.5-turbo-16k',
  'gpt-3.5-turbo-16k-0613',

  // Non-chat GPT models
  '-turbo-instruct', 'davinci-', 'babbage-',

  // Embedding models: /v1/embeddings
  'text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002',

  // TTS Models: /v1/audio/speech
  'tts-1-hd', 'tts-1', 'gpt-4o-mini-tts', // FIXME: support these

  // STT models: /v1/audio/transcriptions, /v1/audio/translations - not chat models (supported by ASRx batch instead)
  'whisper-1', 'gpt-4o-transcribe', 'gpt-4o-mini-transcribe', 'gpt-4o-transcribe-diarize', 'gpt-transcribe',
  'gpt-live-transcribe', // STT via realtime transcription sessions only - no batch endpoint, not supported yet

  // Image-focused chat models (non-standard image output pricing)
  'gpt-5-image', 'gpt-5-image-mini',

  // Image models: /v1/images/generations
  'gpt-image-2', 'gpt-image-1.5', 'chatgpt-image-latest', 'gpt-image-1', 'gpt-image-1-mini', 'dall-e-3', 'dall-e-2',

  // Video models: /v1/videos
  'sora-2-pro', 'sora-2',

  // Specialized domain models - cybersecurity, gated behind the Daybreak program ('does not exist or you do not have access', probed 2026-08-17)
  'gpt-5.4-cyber', 'gpt-5.5-cyber', 'gpt-5.6-cyber',
  'daybreak-blue-latest', 'daybreak-red-latest', // program aliases -> gpt-5.6-sol / gpt-5.6-cyber

  // Safety/moderation models
  'gpt-oss-safeguard',

  // Moderation models
  'omni-moderation-latest', 'omni-moderation-2024-09-26', 'text-moderation-latest',
];

// [OpenAI Deprecations] Shut-down ids, filtered ONLY on native api.openai.com listings: other OpenAI-compatible
// hosts (Azure re-exports, gateways, proxies) may legitimately keep serving these and must not lose them.
// /v1/models is not a liveness signal - it keeps listing dead models (even GET /v1/models/<id> returns 200);
// only a generation attempt is: 404 'has been deprecated' = dead.
// POLICY before adding here: probe generation on OpenAI direct AND on OpenRouter (openai/<id> - Azure kept the
// 5.1/5.2 codex family alive post-shutdown), and distinguish 404-deprecated from permission errors (an entitled
// key may retain access - a permission error means alive, do not deny). Keep the def in _knownOpenAIChatModels
// when OpenRouter still serves the id, so llmOrtOaiLookup keeps its native interfaces/params.
const openAIModelsShutdownDenyList: string[] = [
  'codex-mini-latest', // shut down February 12, 2026
  'chatgpt-4o-latest', // shut down February 17, 2026
  // shut down July 23, 2026
  'gpt-5-chat-latest', // dead on OpenRouter too
  'gpt-5-codex', // on OpenRouter only as unusable :batch
  'gpt-5.1-chat-latest', // dead on OpenRouter too
  'gpt-5.1-codex', // catches -max and -mini too; defs kept above (OpenRouter serves all three via Azure)
  'gpt-5.2-codex', // def kept above (OpenRouter serves it via Azure)
  'gpt-4o-search-preview', // catches the -2025-03-11 snapshot too: the bare alias died as well (probed 2026-08-24), defs removed
  'gpt-4o-mini-search-preview', // same: alias + snapshot
  'gpt-audio-mini-2025-10-06', // the -2025-12-15 snapshot and the alias stay
  'o3-deep-research', // dead everywhere (OpenRouter: no endpoints; Bedrock: absent)
  'o4-mini-deep-research', // dead everywhere
  // shut down August 10, 2026 - defs removed (OpenRouter delisted both slugs too)
  'gpt-5.2-chat-latest',
  'gpt-5.3-chat-latest',
];

export function openAIModelFilter(model: OpenAIWire_API_Models_List.Model, isNativeOpenAI: boolean) {
  if (openAIModelsDenyExactList.includes(model.id)) return false;
  // shut-down ids only vanish from native OpenAI listings - compatible hosts may still serve them
  if (isNativeOpenAI && openAIModelsShutdownDenyList.some(deny => model.id.includes(deny))) return false;
  return !openAIModelsDenyList.some(deny => model.id.includes(deny));
}

export function openAIModelToModelDescription(modelId: string, options?: { isNotOpenai?: boolean, modelCreated?: number, modelUpdated?: number }): ModelDescriptionSchema {
  const md = fromManualMapping(_knownOpenAIChatModels, modelId, options?.modelCreated, options?.modelUpdated, llmsFallbackForOpenAIModel(modelId, !options?.isNotOpenai));

  // pubDate fallback: surface the "new" badge for genuinely-new OpenAI models not yet catalogued editorially.
  // Native OpenAI's 'created' is verified real per-model dates (124/124 unique, 2022-2026 spread). Gated to
  // native OpenAI only - generic OpenAI-compatible custom hosts (isNotOpenai) have unverified 'created'.
  // Editorial pubDate (from _knownOpenAIChatModels) always wins.
  if (!options?.isNotOpenai && md.pubDate === undefined && md.created)
    md.pubDate = formatPubDate(md.created);

  return md;
}

export function openAIInjectVariants(acc: ModelDescriptionSchema[], model: ModelDescriptionSchema): ModelDescriptionSchema[] {
  return createVariantInjector(hardcodedOpenAIVariants, 'after')(acc, model);
}


const _manualOrderingIdPrefixes = [
  // GPT-6
  'gpt-6-astra',
  'gpt-6-',
  // GPT-5.6 (Sol/Terra/Luna tiers)
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'gpt-5.6-luna',
  'gpt-5.6-',
  // ChatGPT Instant (version-less rolling pointer)
  'chat-latest',
  // GPT-5.5
  'gpt-5.5-20',
  'gpt-5.5-pro-20',
  'gpt-5.5-pro',
  'gpt-5.5-chat-latest', // GPT-5.5 Instant
  'gpt-5.5',
  // GPT-5.4
  'gpt-5.4-20',
  'gpt-5.4-pro-20',
  'gpt-5.4-pro',
  'gpt-5.4-chat-latest',
  'gpt-5.4',
  // GPT-5.3
  'gpt-5.3-20',
  'gpt-5.3-pro-20',
  'gpt-5.3-pro',
  'gpt-5.3-codex',
  'gpt-5.3-chat-latest',
  // GPT-5.2
  'gpt-5.2-20',
  'gpt-5.2-pro-20',
  'gpt-5.2-pro',
  'gpt-5.2-codex',
  'gpt-5.2-chat-latest',
  'gpt-5.2',
  // GPT-5.1
  'gpt-5.1-20',
  'gpt-5.1-chat-latest',
  'gpt-5.1-codex-max',
  'gpt-5.1-codex',
  'gpt-5.1-codex-mini',
  'gpt-5.1',
  // GPT-5
  'gpt-5-20',
  'gpt-5-pro-20',
  'gpt-5-pro',
  'gpt-5-mini-20',
  'gpt-5-nano-20',
  'gpt-5-chat-latest',
  'gpt-5-codex',
  'gpt-5-',
  // Reasoning models
  'o5-20',
  'o5-mini-20',
  'o5-',
  'o4-pro-20',
  'o4-pro',
  'o4-mini-deep-research-20',
  'o4-mini-deep-research',
  'o4-20',
  'o4-mini-20',
  'o4-',
  'o3-pro-20',
  'o3-pro',
  'o3-deep-research-20',
  'o3-deep-research',
  'o3-20',
  'o3-mini-20',
  'o3-',
  'o1-pro-20',
  'o1-pro',
  'o1-20',
  'o1-preview-',
  'o1-',
  // GPT-4.5
  'gpt-4.5-20',
  'gpt-4.5-preview',
  'gpt-4.5-',
  // GPT-4.1
  'gpt-4.1-20',
  'gpt-4.1-mini-20',
  'gpt-4.1-mini',
  'gpt-4.1-nano-20',
  'gpt-4.1-nano',
  'gpt-4.1',
  // 4o-derived?
  'gpt-audio-1.5',
  'gpt-audio-2',
  'gpt-audio-mini-',
  'gpt-audio-mini',
  'gpt-audio',
  // Preferred models
  'gpt-4o-20',
  'gpt-4o-search-20',
  'gpt-4o-search-preview',
  'gpt-4o-mini-20',
  'gpt-4o-mini-search-20',
  'gpt-4o-mini-search-preview',
  'gpt-4o-mini',
  'gpt-4o-',
  // ChatGPT models
  'chatgpt-',
  // Codex
  'codex-',
  // ...rest
  // 'gpt-4-turbo-',
  // 'gpt-4-',
  // ...
];


export function openAISortModels(a: ModelDescriptionSchema, b: ModelDescriptionSchema) {
  // bottom: links
  const aLink = a.label.startsWith('🔗');
  const bLink = b.label.startsWith('🔗');
  if (aLink !== bLink) return aLink ? 1 : -1;

  // bottom: non-chatGenerate
  const aChat = a.interfaces.includes(LLM_IF_OAI_Chat);
  const bChat = b.interfaces.includes(LLM_IF_OAI_Chat);
  if (aChat !== bChat) return aChat ? -1 : 1;

  // sort by manual ordering (if not present is implicitly at the bottom)
  const aOrder = _manualOrderingIdPrefixes.findIndex(prefix => a.id.startsWith(prefix));
  const bOrder = _manualOrderingIdPrefixes.findIndex(prefix => b.id.startsWith(prefix));
  if (aOrder !== bOrder) {
    if (aOrder === -1) return 1;
    if (bOrder === -1) return -1;
    return aOrder - bOrder;
  }

  // fix the OpenAI model names to be chronologically sorted
  function remapReleaseDate(id: string): string {
    return id
      .replace('0314', '2023-03-14')
      .replace('0613', '2023-06-13')
      .replace('1106', '2023-11-06')
      .replace('0125', '2024-01-25')
      .replace('0409', '2024-04-09');
  }

  // due to using by-label, sorting doesn't require special cases anymore
  return remapReleaseDate(b.label).localeCompare(remapReleaseDate(a.label));
}


/**
 * Checks for model definition issues:
 * 1. Stale definitions: in our known models but not in API (should remove)
 * 2. Unknown models: in API but not in our known models (should add)
 * 3. Parsing gaps: in API but lost during parsing pipeline (bug detection)
 */
export function openaiValidateModelDefs_DEV(apiModels: unknown, parsedModels: object[] | undefined, isNativeOpenAI: boolean): void {

  if (DEV_DEBUG_OPENAI_MODELS) {

    // Check if wireModels has .data array
    if (!apiModels || !Array.isArray(apiModels)) {
      console.warn('[DEV] OpenAI: wireModels is not an array', apiModels);
      return;
    }

    const apiIds = apiModels.map((model: any) => model.id);
    const knownIds = _knownOpenAIChatModels
      .filter(model => !!model.idPrefix) // exclude fallback model
      .map(model => model.idPrefix);

    // 1 & 2: Check stale and unknown definitions
    llmDevCheckModels_DEV('OpenAI', apiIds, knownIds, {
      apiFilter: id => openAIModelFilter({ id } as any, isNativeOpenAI),
      ignoreStale: ['gpt-5.6'], // docs-official alias: generates but never lists (see the symlink def)
    });

    // 3: Check for parsing gaps (models lost during filter/map pipeline)
    if (parsedModels) {
      const parsedIds = new Set(parsedModels.map((m: any) => m.id));
      const parsingGaps = apiIds.filter(id =>
        !parsedIds.has(id) && // not in parsed output
        openAIModelFilter({ id } as any, isNativeOpenAI), // not filtered by deny list
      );
      if (parsingGaps.length)
        console.log(`[DEV] OpenAI: parsing gaps (in API, passed filter, but not in output): [ ${parsingGaps.join(', ')} ]`);
    }

  }

}


// -- OpenAI-through-OpenRouter Vendor Lookup --

const _ORT_OAI_IF_ALLOWLIST: ReadonlySet<string> = new Set([
  LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning,
] as const);
const _ORT_OAI_PARAM_ALLOWLIST: ReadonlySet<string> = new Set([
  'llmVndOaiEffort', // OpenAI reasoning effort
  'llmVndOaiReasoningMode', // [2026-07-11] GPT-5.6+ reasoning mode - OR-documented `reasoning.mode`: 'pro' on a base id reroutes to the matching '*-pro' model
  'llmVndOaiVerbosity', // verbosity
  // 'llmVndOaiImageGeneration', // OR does NOT support image gen with OAI yet (2026-02-06)
] as const satisfies DModelParameterId[]);

/**
 * Lookup for OpenRouter: match an OR OpenAI model ID to a known hardcoded model
 * @param orModelName - The model name after stripping 'openai/' prefix (e.g. 'gpt-5.2', 'o3')
 */
export function llmOrtOaiLookup(orModelName: string): OrtVendorLookupResult | undefined | null {

  const isOaiProModel = orModelName.endsWith('-pro'); // before the refMap rename - drives the reasoning mode pin below

  // typemap to known models
  const ortOaiRefMap: Record<string, string | null> = {
    // renames
    // [2026-07-11] OR materializes GPT-5.6 Pro mode as standalone '-pro' ids - map to the tier entries (OR supplies label + pricing)
    'gpt-5.6-sol-pro': 'gpt-5.6-sol',
    'gpt-5.6-terra-pro': 'gpt-5.6-terra',
    'gpt-5.6-luna-pro': 'gpt-5.6-luna',
    'gpt-chat-latest': 'chat-latest', // OR slug for the version-less ChatGPT Instant pointer
    'gpt-5.5-chat': 'gpt-5.5-2026-04-23', // gpt-5.5-chat-latest not yet in API, map to snapshot
    'gpt-5.4-chat': 'gpt-5.4-2026-03-05', // no chat-latest yet, map to snapshot
    // 'gpt-5.3-chat' / 'gpt-5.1-chat' / 'gpt-5-chat': no longer OR slugs at all
    // remove openai variants
    'o4-mini-high': null,
    'o3-mini-high': null,
    'gpt-5.4-image-2': null,
    'gpt-5-image-mini': null,
    'gpt-5-image': null,
    'gpt-4o:extended': null,
    // dead ids OR still lists (probed 2026-08-17): no endpoints, or the upstream 404s
    'gpt-5.2-chat': null,
    'gpt-4-turbo-preview': null,
  } as const;
  if (orModelName in ortOaiRefMap) {
    if (ortOaiRefMap[orModelName] === null) return null;
    orModelName = ortOaiRefMap[orModelName]!;
  }

  // try exact match
  let entry = _knownOpenAIChatModels.find(m => m.idPrefix === orModelName);

  // if symlink, follow it to the concrete model definition
  const symLink = entry && 'symLink' in entry ? entry.symLink : undefined;
  if (symLink) entry = _knownOpenAIChatModels.find(m => m.idPrefix === symLink);
  if (!entry?.interfaces) return undefined;

  // allowlists on interfaces and parameter specs
  const interfaces = entry.interfaces.filter(i => _ORT_OAI_IF_ALLOWLIST.has(i));

  const parameterSpecs = entry.parameterSpecs
    ?.filter(spec => _ORT_OAI_PARAM_ALLOWLIST.has(spec.paramId))
    .map(spec =>
      (isOaiProModel && spec.paramId === 'llmVndOaiReasoningMode') ? { ...spec, initialValue: 'pro' as const, hidden: true } // '-pro' ids ARE pro mode: pinned ('standard' doesn't reroute back)
        : { ...spec },
    );

  // initialTemperature: not set - OpenAI models use the global fallback (0.5);
  // NoTemperature models are handled client-side via LLM_IF_HOTFIX_NoTemperature (not propagated to OR)
  return { interfaces, parameterSpecs, pubDate: entry.pubDate };
}
