import type { OpenAIWire_API_Models_List } from '~/modules/aix/server/dispatch/wiretypes/openai.wiretypes';

import { DModelInterfaceV1, LLM_IF_HOTFIX_NoTemperature, LLM_IF_HOTFIX_StripImages, LLM_IF_HOTFIX_Sys0ToUsr0, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_PromptCaching, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Responses, LLM_IF_OAI_Vision, LLM_IF_Outputs_Audio, LLM_IF_Tools_WebSearch } from '~/common/stores/llms/llms.types';
import { Release } from '~/common/app.release';

import type { ModelDescriptionSchema } from '../../llm.server.types';
import { fromManualMapping, KnownModel, ManualMappings } from '../../models.mappings';


// OpenAI Model Variants
export const hardcodedOpenAIVariants: { [modelId: string]: Partial<ModelDescriptionSchema> } = {

  // GPT-5 with web search enabled by default
  // 'gpt-5-2025-08-07': {
  //   idVariant: 'search',
  //   label: 'GPT-5 + Search',
  //   description: 'GPT-5 with web search enabled by default for up-to-date information and research.',
  //   parameterSpecs: [
  //     // customize this param
  //     { paramId: 'llmVndOaiWebSearchContext', initialValue: 'medium', hidden: true }, // Search enabled by default
  //     // copy other params
  //     { paramId: 'llmVndOaiReasoningEffort4' },
  //     { paramId: 'llmVndOaiRestoreMarkdown' },
  //     { paramId: 'llmVndOaiVerbosity' },
  //     { paramId: 'llmVndOaiImageGeneration' },
  //   ],
  //   benchmark: { cbaElo: 1442 + 1 }, // +1 from base GPT-5
  // },

} as const;


// configuration
const DEV_DEBUG_OPENAI_MODELS = /* (Release.TenantSlug as any) === 'staging' || */ Release.IsNodeDevBuild;


// per-family interfaces
const IFS_GPT_AUDIO: DModelInterfaceV1[] = [LLM_IF_OAI_Chat, LLM_IF_Outputs_Audio] as const;
const IFS_CHAT_MIN: DModelInterfaceV1[] = [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json] as const;
const IFS_CHAT_CACHE: DModelInterfaceV1[] = [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_PromptCaching] as const;
const IFS_CHAT_CACHE_REASON: DModelInterfaceV1[] = [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_PromptCaching, LLM_IF_OAI_Reasoning] as const;

// per-type parameter specs
const PS_DEEP_RESEARCH = [{ paramId: 'llmVndOaiWebSearchContext' as const, initialValue: 'medium', hidden: true } as const];


// [OpenAI] Known Chat Models
// https://platform.openai.com/docs/models
// https://platform.openai.com/docs/pricing
// NOTES:
// - "Structured Outputs" is LLM_IF_OAI_Json
export const _knownOpenAIChatModels: ManualMappings = [

  /// GPT-5.1 series - Released November 13, 2025

  // GPT-5.1
  {
    idPrefix: 'gpt-5.1-2025-11-13',
    label: 'GPT-5.1 (2025-11-13)',
    description: 'The best model for coding and agentic tasks with configurable reasoning effort.',
    contextWindow: 400000,
    maxCompletionTokens: 128000,
    // trainingDataCutoff: 'Sep 30, 2024',
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_CACHE_REASON, LLM_IF_Tools_WebSearch, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [
      { paramId: 'llmVndOaiReasoningEffort4' }, { paramId: 'llmVndOaiWebSearchContext' },
      { paramId: 'llmVndOaiRestoreMarkdown' },
      { paramId: 'llmVndOaiVerbosity' },
      { paramId: 'llmVndOaiImageGeneration' },
      { paramId: 'llmForceNoStream' },
    ],
    chatPrice: { input: 1.25, cache: { cType: 'oai-ac', read: 0.125 }, output: 10 },
    // benchmark: TBD
  },
  {
    idPrefix: 'gpt-5.1',
    label: 'GPT-5.1',
    symLink: 'gpt-5.1-2025-11-13',
  },

  // GPT-5.1 Chat Latest
  {
    idPrefix: 'gpt-5.1-chat-latest',
    label: 'GPT-5.1 Instant',
    description: 'GPT-5.1 Instant with adaptive reasoning. More conversational with improved instruction following.',
    contextWindow: 400000,
    maxCompletionTokens: 128000,
    // trainingDataCutoff: 'Oct 31, 2024',
    // interfaces: [LLM_IF_OAI_Responses, LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_PromptCaching], // no function calling or reasoning
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_CACHE_REASON, LLM_IF_Tools_WebSearch, LLM_IF_HOTFIX_NoTemperature],
    // parameterSpecs: [
    //   { paramId: 'llmVndOaiReasoningEffort4' }, { paramId: 'llmVndOaiWebSearchContext' },
    //   { paramId: 'llmVndOaiRestoreMarkdown' },
    //   { paramId: 'llmVndOaiVerbosity' },
    //   { paramId: 'llmVndOaiImageGeneration' },
    //   { paramId: 'llmForceNoStream' },
    // ],
    chatPrice: { input: 1.25, cache: { cType: 'oai-ac', read: 0.125 }, output: 10 }, // TODO: Update with official pricing when available - this is `gpt-5-chat-latest` pricing
    // benchmark: TBD
  },

  // GPT-5.1 Codex Max
  {
    idPrefix: 'gpt-5.1-codex-max',
    label: 'GPT-5.1 Codex Max',
    description: 'Our most intelligent coding model optimized for long-horizon, agentic coding tasks.',
    contextWindow: 400000,
    maxCompletionTokens: 128000,
    trainingDataCutoff: 'Sep 30, 2024',
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_CACHE_REASON, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [
      { paramId: 'llmVndOaiReasoningEffort4' },
      { paramId: 'llmForceNoStream' },
    ],
    chatPrice: { input: 1.25, cache: { cType: 'oai-ac', read: 0.125 }, output: 10 },
    // benchmark: TBD
  },
  // GPT-5.1 Codex
  {
    idPrefix: 'gpt-5.1-codex',
    label: 'GPT-5.1 Codex',
    description: 'A version of GPT-5.1 optimized for agentic coding tasks in Codex or similar environments.',
    contextWindow: 400000,
    maxCompletionTokens: 128000,
    trainingDataCutoff: 'Sep 30, 2024',
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_CACHE_REASON, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [
      { paramId: 'llmVndOaiReasoningEffort4' },
      { paramId: 'llmForceNoStream' },
    ],
    chatPrice: { input: 1.25, cache: { cType: 'oai-ac', read: 0.125 }, output: 10 },
    // benchmark: TBD
  },
  // GPT-5.1 Codex Mini
  {
    idPrefix: 'gpt-5.1-codex-mini',
    label: 'GPT-5.1 Codex Mini',
    description: 'Smaller, faster version of GPT-5.1 Codex for efficient coding tasks.',
    contextWindow: 400000,
    maxCompletionTokens: 128000,
    trainingDataCutoff: 'Sep 30, 2024',
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_CACHE_REASON, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [
      { paramId: 'llmVndOaiReasoningEffort4' },
      { paramId: 'llmForceNoStream' },
    ],
    chatPrice: { input: 0.25, cache: { cType: 'oai-ac', read: 0.025 }, output: 2 },
    // benchmark: TBD
  },



  /// GPT-5 series - Released August 7, 2025

  // GPT-5
  {
    idPrefix: 'gpt-5-2025-08-07',
    label: 'GPT-5 (2025-08-07)',
    description: 'The best model for coding and agentic tasks across domains.',
    contextWindow: 400000,
    maxCompletionTokens: 128000,
    trainingDataCutoff: 'Sep 30, 2024',
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_CACHE_REASON, LLM_IF_Tools_WebSearch, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [
      { paramId: 'llmVndOaiReasoningEffort4' }, { paramId: 'llmVndOaiWebSearchContext' },
      { paramId: 'llmVndOaiRestoreMarkdown' }, // activate markdown restoration (true as initial value)
      { paramId: 'llmVndOaiVerbosity' }, // gpt-5-class nets have verbosity control
      { paramId: 'llmVndOaiImageGeneration' }, // image generation capability
      { paramId: 'llmForceNoStream' }, // non-streaming option for unverified organizations
    ],
    chatPrice: { input: 1.25, cache: { cType: 'oai-ac', read: 0.125 }, output: 10 },
    benchmark: { cbaElo: 1442 }, // gpt-5-high
  },
  {
    idPrefix: 'gpt-5',
    label: 'GPT-5',
    symLink: 'gpt-5-2025-08-07',
  },

  // GPT-5 Pro
  {
    idPrefix: 'gpt-5-pro-2025-10-06',
    label: 'GPT-5 Pro (2025-10-06)',
    description: 'Version of GPT-5 that uses more compute to produce smarter and more precise responses. Designed for tough problems.',
    contextWindow: 400000,
    maxCompletionTokens: 272000,
    trainingDataCutoff: 'Sep 30, 2024',
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_MIN, LLM_IF_OAI_Reasoning, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [{ paramId: 'llmVndOaiReasoningEffort' }, { paramId: 'llmForceNoStream' }],
    chatPrice: { input: 15, output: 120 },
    // benchmark: has not been measured yet
  },
  {
    idPrefix: 'gpt-5-pro',
    label: 'GPT-5 Pro',
    symLink: 'gpt-5-pro-2025-10-06',
  },

  // GPT-5 Chat Latest
  {
    idPrefix: 'gpt-5-chat-latest',
    label: 'GPT-5 ChatGPT (Non-Thinking)',
    description: 'GPT-5 model used in ChatGPT. Points to the GPT-5 snapshot currently used in ChatGPT.',
    contextWindow: 400000,
    maxCompletionTokens: 128000,
    trainingDataCutoff: 'Sep 29, 2024',
    interfaces: [LLM_IF_OAI_Responses, LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_PromptCaching], // no function calling or reasoning
    chatPrice: { input: 1.25, cache: { cType: 'oai-ac', read: 0.125 }, output: 10 },
    benchmark: { cbaElo: 1430 }, // gpt-5-chat
  },

  // GPT-5 Codex
  {
    idPrefix: 'gpt-5-codex',
    label: 'GPT-5 Codex',
    description: 'A version of GPT-5 optimized for agentic coding in Codex.',
    contextWindow: 400000,
    maxCompletionTokens: 128000,
    trainingDataCutoff: 'Sep 30, 2024',
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_CACHE_REASON, LLM_IF_Tools_WebSearch, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [
      { paramId: 'llmVndOaiReasoningEffort' }, // works
      { paramId: 'llmVndOaiWebSearchContext' }, // works, although is not triggered often
      // { paramId: 'llmVndOaiRestoreMarkdown', initialValue: false }, // since this is for code, let the prompt dictate markdown usage rather than us injecting
      { paramId: 'llmForceNoStream' },
    ],
    chatPrice: { input: 1.25, cache: { cType: 'oai-ac', read: 0.125 }, output: 10 },
    // benchmark: TBD
  },

  // GPT-5 Search API
  {
    idPrefix: 'gpt-5-search-api-2025-10-14',
    label: 'GPT-5 Search API (2025-10-14)',
    description: 'Updated web search model in Chat Completions API. 60% cheaper with domain filtering support.',
    contextWindow: 400000,
    maxCompletionTokens: 100000,
    trainingDataCutoff: 'Sep 30, 2024',
    interfaces: [...IFS_CHAT_MIN, LLM_IF_Tools_WebSearch],
    parameterSpecs: [{ paramId: 'llmVndOaiWebSearchContext', initialValue: 'medium' }], // Search enabled by default
    chatPrice: { input: 1.25, cache: { cType: 'oai-ac', read: 0.125 }, output: 10 },
    // benchmark: TBD
  },
  {
    idPrefix: 'gpt-5-search-api',
    label: 'GPT-5 Search API',
    symLink: 'gpt-5-search-api-2025-10-14',
  },

  // GPT-5 mini
  {
    idPrefix: 'gpt-5-mini-2025-08-07',
    label: 'GPT-5 Mini (2025-08-07)',
    description: 'A faster, more cost-efficient version of GPT-5 for well-defined tasks.',
    contextWindow: 400000,
    maxCompletionTokens: 128000,
    trainingDataCutoff: 'May 30, 2024',
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_CACHE_REASON, LLM_IF_Tools_WebSearch, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [{ paramId: 'llmVndOaiReasoningEffort4' }, { paramId: 'llmVndOaiWebSearchContext' }, { paramId: 'llmVndOaiRestoreMarkdown' }, { paramId: 'llmVndOaiVerbosity' }, { paramId: 'llmVndOaiImageGeneration' }, { paramId: 'llmForceNoStream' }],
    chatPrice: { input: 0.25, cache: { cType: 'oai-ac', read: 0.025 }, output: 2 },
    benchmark: { cbaElo: 1388 }, // gpt-5-mini-high
  },
  {
    idPrefix: 'gpt-5-mini',
    label: 'GPT-5 Mini',
    symLink: 'gpt-5-mini-2025-08-07',
  },

  // GPT-5 nano
  {
    idPrefix: 'gpt-5-nano-2025-08-07',
    label: 'GPT-5 Nano (2025-08-07)',
    description: 'Fastest, most cost-efficient version of GPT-5 for summarization and classification tasks.',
    contextWindow: 400000,
    maxCompletionTokens: 128000,
    trainingDataCutoff: 'May 30, 2024',
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_CACHE_REASON, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [{ paramId: 'llmVndOaiReasoningEffort4' }, { paramId: 'llmVndOaiVerbosity' }, { paramId: 'llmVndOaiImageGeneration' }],
    chatPrice: { input: 0.05, cache: { cType: 'oai-ac', read: 0.005 }, output: 0.4 },
    benchmark: { cbaElo: 1344 }, // gpt-5-nano-high
  },
  {
    idPrefix: 'gpt-5-nano',
    label: 'GPT-5 Nano',
    symLink: 'gpt-5-nano-2025-08-07',
  },

  /// [OpenAI, 2025-03-11] NEW `v1/responses` API MODELS - UNSUPPORTED YET

  // Computer Use Preview - INTERNAL MODEL FOR AGENTS - UNSUPPORTED YET
  {
    hidden: true, // UNSUPPORTED YET
    idPrefix: 'computer-use-preview-2025-03-11',
    label: 'Computer Use Preview (2025-03-11)',
    description: 'Specialized model for computer use tool. Optimized for computer interaction capabilities.',
    contextWindow: 8192,
    maxCompletionTokens: 1024,
    trainingDataCutoff: 'Sep 30, 2023',
    interfaces: [LLM_IF_OAI_Responses, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_HOTFIX_NoTemperature],
    chatPrice: { input: 3, output: 12 },
    isPreview: true,
  },
  {
    idPrefix: 'computer-use-preview',
    label: 'Computer Use Preview',
    symLink: 'computer-use-preview-2025-03-11',
  },
  {
    hidden: true, // RESPONSES API UNSUPPORTED YET
    idPrefix: 'codex-mini-latest',
    label: 'Codex Mini Latest',
    description: 'Fast reasoning model optimized for the Codex CLI. A fine-tuned version of o4-mini.',
    contextWindow: 200000,
    maxCompletionTokens: 100000,
    trainingDataCutoff: 'May 31, 2024',
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_CACHE_REASON, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [{ paramId: 'llmVndOaiReasoningEffort' }],
    chatPrice: { input: 1.5, cache: { cType: 'oai-ac', read: 0.375 }, output: 6 },
  },


  /// Reasoning models - o-series

  // o4-mini-deep-research - (v1/responses API)
  {
    idPrefix: 'o4-mini-deep-research-2025-06-26',
    label: 'o4 Mini Deep Research (2025-06-26)',
    description: 'Faster, more affordable deep research model for complex, multi-step research tasks.',
    contextWindow: 200000,
    maxCompletionTokens: 100000,
    trainingDataCutoff: 'May 31, 2024',
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_CACHE_REASON],
    parameterSpecs: PS_DEEP_RESEARCH,
    chatPrice: { input: 2, cache: { cType: 'oai-ac', read: 0.5 }, output: 8 },
  },
  {
    idPrefix: 'o4-mini-deep-research',
    label: 'o4 Mini Deep Research',
    symLink: 'o4-mini-deep-research-2025-06-26',
  },

  /// o4-mini
  {
    idPrefix: 'o4-mini-2025-04-16',
    label: 'o4 Mini (2025-04-16)',
    description: 'Latest o4-mini model. Optimized for fast, effective reasoning with exceptionally efficient performance in coding and visual tasks.',
    contextWindow: 200000,
    maxCompletionTokens: 100000,
    trainingDataCutoff: 'May 31, 2024',
    interfaces: IFS_CHAT_CACHE_REASON,
    parameterSpecs: [{ paramId: 'llmVndOaiReasoningEffort' }],
    chatPrice: { input: 1.1, cache: { cType: 'oai-ac', read: 0.275 }, output: 4.4 },
    benchmark: { cbaElo: 1393 }, // o4-mini-2025-04-16
  },
  {
    idPrefix: 'o4-mini',
    label: 'o4 Mini',
    symLink: 'o4-mini-2025-04-16',
  },

  // o3-deep-research - (v1/responses API)
  {
    idPrefix: 'o3-deep-research-2025-06-26',
    label: 'o3 Deep Research (2025-06-26)',
    description: 'Our most powerful deep research model for complex, multi-step research tasks.',
    contextWindow: 200000,
    maxCompletionTokens: 100000,
    trainingDataCutoff: 'May 31, 2024',
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_CACHE_REASON],
    parameterSpecs: PS_DEEP_RESEARCH,
    chatPrice: { input: 10, cache: { cType: 'oai-ac', read: 2.5 }, output: 40 },
  },
  {
    idPrefix: 'o3-deep-research',
    label: 'o3 Deep Research',
    symLink: 'o3-deep-research-2025-06-26',
  },

  // o3-pro - (v1/responses API)
  {
    idPrefix: 'o3-pro-2025-06-10',
    label: 'o3 Pro (2025-06-10)',
    description: 'Version of o3 with more compute for better responses. Provides consistently better answers for complex tasks.',
    contextWindow: 200000,
    maxCompletionTokens: 100000,
    trainingDataCutoff: 'May 31, 2024',
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_MIN, LLM_IF_OAI_Reasoning, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [{ paramId: 'llmVndOaiReasoningEffort' }, { paramId: 'llmForceNoStream' }],
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
    idPrefix: 'o3-2025-04-16',
    label: 'o3 (2025-04-16)',
    description: 'A well-rounded and powerful model across domains. Sets a new standard for math, science, coding, and visual reasoning tasks.',
    contextWindow: 200000,
    maxCompletionTokens: 100000,
    trainingDataCutoff: 'May 31, 2024',
    interfaces: IFS_CHAT_CACHE_REASON,
    parameterSpecs: [{ paramId: 'llmVndOaiReasoningEffort' }, { paramId: 'llmForceNoStream' }],
    chatPrice: { input: 2, cache: { cType: 'oai-ac', read: 0.5 }, output: 8 },
    benchmark: { cbaElo: 1444 }, // o3-2025-04-16
  },
  {
    idPrefix: 'o3',
    label: 'o3',
    symLink: 'o3-2025-04-16',
  },

  // o3-mini
  {
    idPrefix: 'o3-mini-2025-01-31',
    label: 'o3 Mini (2025-01-31)',
    description: 'Latest o3-mini model snapshot. High intelligence at the same cost and latency targets of o1-mini. Excels at science, math, and coding tasks.',
    contextWindow: 200000,
    maxCompletionTokens: 100000,
    trainingDataCutoff: 'Oct 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_PromptCaching, LLM_IF_OAI_Reasoning, LLM_IF_HOTFIX_StripImages],
    parameterSpecs: [{ paramId: 'llmVndOaiReasoningEffort' }],
    chatPrice: { input: 1.1, cache: { cType: 'oai-ac', read: 0.55 }, output: 4.4 },
    benchmark: { cbaElo: 1347 }, // o3-mini (not using o3-mini-high here, as it seems too inflated)
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
    label: 'o1 Pro (2025-03-19)',
    description: 'A version of o1 with more compute for better responses. Provides consistently better answers for complex tasks.',
    contextWindow: 200000,
    maxCompletionTokens: 100000,
    trainingDataCutoff: 'Sep 30, 2023',
    interfaces: [LLM_IF_OAI_Responses, ...IFS_CHAT_MIN, LLM_IF_OAI_Reasoning, LLM_IF_HOTFIX_NoTemperature],
    parameterSpecs: [{ paramId: 'llmVndOaiReasoningEffort' }],
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
    label: 'o1 (2024-12-17)',
    description: 'Previous full o-series reasoning model.',
    contextWindow: 200000,
    maxCompletionTokens: 100000,
    trainingDataCutoff: 'Oct 2023',
    interfaces: IFS_CHAT_CACHE_REASON,
    parameterSpecs: [{ paramId: 'llmVndOaiReasoningEffort' }, { paramId: 'llmVndOaiRestoreMarkdown' }],
    chatPrice: { input: 15, cache: { cType: 'oai-ac', read: 7.5 }, output: 60 },
    benchmark: { cbaElo: 1399 }, // o1-2024-12-17
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
    label: 'GPT-4.1 (2025-04-14)',
    description: 'Flagship GPT model for complex tasks. Major improvements on coding, instruction following, and long context with 1M token context window.',
    contextWindow: 1047576,
    maxCompletionTokens: 32768,
    trainingDataCutoff: 'May 31, 2024',
    interfaces: IFS_CHAT_CACHE,
    chatPrice: { input: 2, cache: { cType: 'oai-ac', read: 0.5 }, output: 8 },
    benchmark: { cbaElo: 1409 }, // gpt-4.1-2025-04-14
  },
  {
    idPrefix: 'gpt-4.1',
    label: 'GPT-4.1',
    symLink: 'gpt-4.1-2025-04-14',
  },

  // GPT-4.1 mini
  {
    idPrefix: 'gpt-4.1-mini-2025-04-14',
    label: 'GPT-4.1 Mini (2025-04-14)',
    description: 'Balanced for intelligence, speed, and cost. Matches or exceeds GPT-4o in intelligence while reducing latency by nearly half and cost by 83%.',
    contextWindow: 1047576,
    maxCompletionTokens: 32768,
    trainingDataCutoff: 'May 31, 2024',
    interfaces: IFS_CHAT_CACHE,
    chatPrice: { input: 0.4, cache: { cType: 'oai-ac', read: 0.1 }, output: 1.6 },
    benchmark: { cbaElo: 1377 }, // gpt-4.1-mini-2025-04-14
  },
  {
    idPrefix: 'gpt-4.1-mini',
    label: 'GPT-4.1 Mini',
    symLink: 'gpt-4.1-mini-2025-04-14',
  },

  // GPT-4.1 nano
  {
    idPrefix: 'gpt-4.1-nano-2025-04-14',
    label: 'GPT-4.1 Nano (2025-04-14)',
    description: 'Fastest, most cost-effective GPT 4.1 model. Delivers exceptional performance with low latency, ideal for tasks like classification or autocompletion.',
    contextWindow: 1047576,
    maxCompletionTokens: 32768,
    trainingDataCutoff: 'May 31, 2024',
    interfaces: IFS_CHAT_CACHE,
    chatPrice: { input: 0.1, cache: { cType: 'oai-ac', read: 0.025 }, output: 0.4 },
    benchmark: { cbaElo: 1320 }, // gpt-4.1-nano-2025-04-14
  },
  {
    idPrefix: 'gpt-4.1-nano',
    label: 'GPT-4.1 Nano',
    symLink: 'gpt-4.1-nano-2025-04-14',
  },


  /// GPT-Audio series - General availability audio models

  // gpt-audio
  {
    idPrefix: 'gpt-audio-2025-08-28',
    label: 'GPT Audio (2025-08-28)',
    description: 'First generally available audio model. Accepts audio inputs and outputs, and can be used in the Chat Completions REST API.',
    contextWindow: 128000,
    maxCompletionTokens: 16384,
    interfaces: IFS_GPT_AUDIO,
    chatPrice: { input: 2.5, output: 10 },
    // benchmark: TBD
  },
  {
    idPrefix: 'gpt-audio',
    label: 'GPT Audio',
    symLink: 'gpt-audio-2025-08-28',
  },
  {
    idPrefix: 'gpt-audio-mini-2025-10-06',
    label: 'GPT Audio Mini (2025-10-06)',
    description: '',
    contextWindow: 128000,
    maxCompletionTokens: 16384,
    interfaces: IFS_GPT_AUDIO,
    chatPrice: { input: 0.6, output: 2.4 },
  },
  {
    idPrefix: 'gpt-audio-mini',
    label: 'GPT Audio Mini',
    symLink: 'gpt-audio-mini-2025-10-06',
  },


  /// GPT-Realtime series - REMOVED

  /// GPT-4/4o series

  // GPT-4o
  {
    idPrefix: 'gpt-4o-2024-11-20',
    label: 'GPT-4o (2024-11-20)',
    description: 'Snapshot of gpt-4o from November 20th, 2024.',
    contextWindow: 128000,
    maxCompletionTokens: 16384,
    trainingDataCutoff: 'Oct 2023',
    interfaces: IFS_CHAT_CACHE,
    chatPrice: { input: 2.5, cache: { cType: 'oai-ac', read: 1.25 }, output: 10 },
    benchmark: { cbaElo: 1265 + 1 }, // not reported; using gpt-4o-2024-08-06 + 1
  },
  {
    idPrefix: 'gpt-4o-2024-08-06',
    label: 'GPT-4o (2024-08-06)',
    hidden: true, // previous version
    description: 'Snapshot that supports Structured Outputs. gpt-4o currently points to this version.',
    contextWindow: 128000,
    maxCompletionTokens: 16384,
    trainingDataCutoff: 'Oct 2023',
    interfaces: IFS_CHAT_CACHE,
    chatPrice: { input: 2.5, cache: { cType: 'oai-ac', read: 1.25 }, output: 10 },
    benchmark: { cbaElo: 1333 }, // GPT-4o (08/06)
  },
  {
    idPrefix: 'gpt-4o-2024-05-13',
    label: 'GPT-4o (2024-05-13)',
    hidden: true, // previous version
    description: 'Original gpt-4o snapshot from May 13, 2024.',
    contextWindow: 128000,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Oct 2023',
    interfaces: IFS_CHAT_MIN,
    chatPrice: { input: 5, output: 15 },
    benchmark: { cbaElo: 1344 }, // gpt-4o-2024-05-13
  },
  {
    idPrefix: 'gpt-4o',
    label: 'GPT-4o',
    symLink: 'gpt-4o-2024-08-06',
  },
  {
    idPrefix: 'chatgpt-4o-latest',
    label: 'ChatGPT-4o Latest',
    description: 'The chatgpt-4o-latest model version continuously points to the version of GPT-4o used in ChatGPT, and is updated frequently.',
    contextWindow: 128000,
    maxCompletionTokens: 16384,
    trainingDataCutoff: 'Oct 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json], // does not support Tools
    chatPrice: { input: 5, output: 15 },
    benchmark: { cbaElo: 1441 }, // chatgpt-4o-latest-20250326
  },

  // GPT-4o Search Preview: When using Chat Completions, the model always retrieves information from the web before responding to your query.
  {
    hidden: true, // old
    idPrefix: 'gpt-4o-search-preview-2025-03-11',
    label: 'GPT-4o Search Preview (2025-03-11)',
    description: 'Latest snapshot of the GPT-4o model optimized for web search capabilities.',
    contextWindow: 128000,
    maxCompletionTokens: 16384,
    trainingDataCutoff: 'Sep 30, 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Json, LLM_IF_Tools_WebSearch, LLM_IF_HOTFIX_NoTemperature], // NOTE: 2025-03-15: confirmed on 'playground' that this model does not support images
    parameterSpecs: [{ paramId: 'llmVndOaiWebSearchContext' }, { paramId: 'llmVndOaiWebSearchGeolocation' }],
    chatPrice: { input: 2.5, output: 10 },
    // benchmarks don't apply to search models
    isPreview: true,
  },
  {
    idPrefix: 'gpt-4o-search-preview',
    label: 'GPT-4o Search Preview',
    symLink: 'gpt-4o-search-preview-2025-03-11',
  },

  // GPT-4o Audio Preview
  {
    hidden: true, // old
    idPrefix: 'gpt-4o-audio-preview-2025-06-03',
    label: 'GPT-4o Audio Preview (2025-06-03)',
    description: 'Latest snapshot for the Audio API model.',
    contextWindow: 128000,
    maxCompletionTokens: 16384,
    trainingDataCutoff: 'Oct 2023',
    interfaces: IFS_GPT_AUDIO,
    chatPrice: { input: 2.5, output: 10 /* AUDIO PRICING UNSUPPORTED 40/80 */ },
    // benchmarks don't apply to audio models
    isPreview: true,
  },
  {
    hidden: true, // old
    idPrefix: 'gpt-4o-audio-preview-2024-12-17',
    label: 'GPT-4o Audio Preview (2024-12-17)',
    description: 'Snapshot for the Audio API model.',
    contextWindow: 128000,
    maxCompletionTokens: 16384,
    trainingDataCutoff: 'Oct 2023',
    interfaces: IFS_GPT_AUDIO,
    chatPrice: { input: 2.5, output: 10 /* AUDIO PRICING UNSUPPORTED 40/80 */ },
    // benchmarks don't apply to audio models
    isPreview: true,
  },
  {
    idPrefix: 'gpt-4o-audio-preview',
    label: 'GPT-4o Audio Preview',
    symLink: 'gpt-4o-audio-preview-2025-06-03',
  },

  // GPT-4o mini
  {
    idPrefix: 'gpt-4o-mini-2024-07-18',
    label: 'GPT-4o Mini (2024-07-18)',
    description: 'Affordable model for fast, lightweight tasks. GPT-4o Mini is cheaper and more capable than GPT-3.5 Turbo.',
    contextWindow: 128000,
    maxCompletionTokens: 16384,
    trainingDataCutoff: 'Oct 2023',
    interfaces: IFS_CHAT_CACHE,
    chatPrice: { input: 0.15, cache: { cType: 'oai-ac', read: 0.075 }, output: 0.6 },
    benchmark: { cbaElo: 1316 }, // GPT-4o-mini (07/18)
  },
  {
    idPrefix: 'gpt-4o-mini',
    label: 'GPT-4o mini',
    symLink: 'gpt-4o-mini-2024-07-18',
  },
  {
    hidden: true, // UNSUPPORTED yet (audio output model)
    idPrefix: 'gpt-4o-mini-audio-preview-2024-12-17',
    label: 'GPT-4o Mini Audio Preview (2024-12-17)',
    description: 'Snapshot for the Audio API model.',
    contextWindow: 128000,
    maxCompletionTokens: 16384,
    trainingDataCutoff: 'Oct 2023',
    interfaces: IFS_GPT_AUDIO,
    chatPrice: { input: 0.15, output: 0.6 /* AUDIO PRICING UNSUPPORTED 10/20 */ },
    // benchmarks don't apply to audio models
    isPreview: true,
  },
  {
    idPrefix: 'gpt-4o-mini-audio-preview',
    label: 'GPT-4o Mini Audio Preview',
    symLink: 'gpt-4o-mini-audio-preview-2024-12-17',
  },
  // GPT-4o Mini Search Preview: When using Chat Completions, the model always retrieves information from the web before responding to your query.
  {
    hidden: true, // old
    idPrefix: 'gpt-4o-mini-search-preview-2025-03-11',
    label: 'GPT-4o Mini Search Preview (2025-03-11)',
    description: 'Latest snapshot of the GPT-4o Mini model optimized for web search capabilities.',
    contextWindow: 128000,
    maxCompletionTokens: 16384,
    trainingDataCutoff: 'Sep 30, 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Json, LLM_IF_Tools_WebSearch, LLM_IF_HOTFIX_NoTemperature], // NOTE: this support function calling, but only its own, not a Custom Function
    parameterSpecs: [{ paramId: 'llmVndOaiWebSearchContext' }, { paramId: 'llmVndOaiWebSearchGeolocation' }],
    chatPrice: { input: 0.15, output: 0.6 },
    // benchmarks don't apply to search models
    isPreview: true,
  },
  {
    idPrefix: 'gpt-4o-mini-search-preview',
    label: 'GPT-4o Mini Search Preview',
    symLink: 'gpt-4o-mini-search-preview-2025-03-11',
  },

  // GPT-4 Turbo
  {
    idPrefix: 'gpt-4-turbo-2024-04-09',
    label: 'GPT-4 Turbo (2024-04-09)',
    hidden: true, // OLD
    description: 'GPT-4 Turbo with Vision model. Vision requests can now use JSON mode and function calling. gpt-4-turbo currently points to this version.',
    contextWindow: 128000,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Dec 2023',
    interfaces: IFS_CHAT_MIN,
    chatPrice: { input: 10, output: 30 },
    benchmark: { cbaElo: 1324 }, // gpt-4-turbo-2024-04-09
  },
  {
    idPrefix: 'gpt-4-turbo',
    label: 'GPT-4 Turbo',
    symLink: 'gpt-4-turbo-2024-04-09',
  },
  {
    idPrefix: 'gpt-4-0125-preview',
    label: 'GPT-4 Turbo (0125)',
    hidden: true, // OLD
    description: 'GPT-4 Turbo preview model intended to reduce cases of "laziness" where the model doesn\'t complete a task.',
    contextWindow: 128000,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Dec 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: { input: 10, output: 30 },
    benchmark: { cbaElo: 1315 }, // gpt-4-0125-preview
  },
  {
    idPrefix: 'gpt-4-1106-preview', // GPT-4 Turbo preview model
    label: 'GPT-4 Turbo (1106)',
    hidden: true, // OLD
    description: 'GPT-4 Turbo preview model featuring improved instruction following, JSON mode, reproducible outputs, parallel function calling, and more.',
    contextWindow: 128000,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Apr 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: { input: 10, output: 30 },
    benchmark: { cbaElo: 1315 }, // gpt-4-1106-preview
  },
  {
    idPrefix: 'gpt-4-turbo-preview',
    label: 'GPT-4 Turbo Preview',
    symLink: 'gpt-4-0125-preview',
    isLegacy: true,
  },

  // GPT4's
  {
    idPrefix: 'gpt-4-0613',
    label: 'GPT-4 (0613)',
    hidden: true, // OLD
    description: 'Snapshot of gpt-4 from June 13th 2023 with improved function calling support. Data up to Sep 2021.',
    contextWindow: 8192,
    trainingDataCutoff: 'Sep 2021',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 30, output: 60 },
    benchmark: { cbaElo: 1163 },
    isLegacy: true,
  },
  {
    idPrefix: 'gpt-4-0314',
    label: 'GPT-4 (0314)',
    hidden: true, // OLD
    description: 'Snapshot of gpt-4 from March 14th 2023 with function calling data. Data up to Sep 2021.',
    contextWindow: 8192,
    trainingDataCutoff: 'Sep 2021',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 30, output: 60 },
    benchmark: { cbaElo: 1186 },
    isLegacy: true,
  },
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
    label: '3.5-Turbo (2024-01-25)',
    hidden: true, // OLD
    description: 'The latest GPT-3.5 Turbo model with higher accuracy at responding in requested formats and a fix for a bug which caused a text encoding issue for non-English language function calls.',
    contextWindow: 16385,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Sep 2021',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.5, output: 1.5 },
    benchmark: { cbaElo: 1106 },
  },
  {
    idPrefix: 'gpt-3.5-turbo-1106',
    label: '3.5-Turbo (1106)',
    hidden: true, // OLD
    description: 'GPT-3.5 Turbo model with improved instruction following, JSON mode, reproducible outputs, parallel function calling, and more.',
    contextWindow: 16385,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Sep 2021',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 1, output: 2 },
    benchmark: { cbaElo: 1068 },
  },
  {
    idPrefix: 'gpt-3.5-turbo',
    label: '3.5-Turbo',
    symLink: 'gpt-3.5-turbo-0125',
  },

];

export const _fallbackOpenAIModel: KnownModel = {
  idPrefix: '',
  label: '?',
  description: 'Unknown, please let us know the ID. Assuming a context window of 128k tokens, and a maximum output of 4k tokens.',
  contextWindow: 128000,
  maxCompletionTokens: 4096,
  interfaces: IFS_CHAT_MIN,
  // hidden: true,
};


const openAIModelsDenyList: string[] = [
  // [OpenAI, 2025-08-28] FIXME: NOT YET SUPPORTED - "REALTIME API"
  // 'gpt-realtime', // leave this just for kicks, but it's hidden by default and won't work if unhidden
  // '-realtime-',
  '4o-realtime',
  '4o-mini-realtime',
  'gpt-realtime',

  // [OpenAI, 2025-03-11] FIXME: NOT YET SUPPORTED - "RESPONSES API"
  'computer-use-preview', 'computer-use-preview-2025-03-11', // FIXME: support these

  // [OpenAI Deprecations] Explicitly deny shut-down model IDs that we removed
  // 'gpt-4.5-preview',
  // 'o1-preview',
  // 'gpt-4-32k',

  // Legacy GPT models
  'gpt-3.5-turbo-0301',
  'gpt-3.5-turbo-0613',
  'gpt-3.5-turbo-16k',
  'gpt-3.5-turbo-16k-0613',

  // Other unwanted GPT models
  'gpt-4-turbo-preview',

  // Non-chat GPT models
  '-turbo-instruct', 'davinci-', 'babbage-',

  // Embedding models: /v1/embeddings
  'text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002',

  // TTS Models: /v1/audio/speech
  'tts-1-hd', 'tts-1', 'gpt-4o-mini-tts', // FIXME: support these

  // STT models: /v1/audio/transcriptions, /v1/audio/translations
  'whisper-1', 'gpt-4o-transcribe', 'gpt-4o-mini-transcribe', // FIXME: support these

  // Image models: /v1/images/generations
  'gpt-image-1', 'gpt-image-1-mini', 'dall-e-3', 'dall-e-2',

  // Video models: /v1/videos
  'sora-2-pro', 'sora-2',

  // Moderation models
  'omni-moderation-latest', 'omni-moderation-2024-09-26', 'text-moderation-latest',
];

export function openAIModelFilter(model: OpenAIWire_API_Models_List.Model) {
  return !openAIModelsDenyList.some(deny => model.id.includes(deny));
}

export function openAIModelToModelDescription(modelId: string, modelCreated: number | undefined, modelUpdated?: number): ModelDescriptionSchema {
  return fromManualMapping(_knownOpenAIChatModels, modelId, modelCreated, modelUpdated, _fallbackOpenAIModel);
}


const _manualOrderingIdPrefixes = [
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
  'gpt-audio-2',
  'gpt-4o-audio-preview',
  'gpt-audio-mini-',
  'gpt-audio-mini',
  'gpt-4o-mini-audio-preview',
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
  // Computer use models
  'computer-use-20',
  'computer-use-preview',
  'computer-use',
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
 * Inject model variants into the models array.
 * Similar to how Anthropic handles variants (e.g., thinking variants),
 * this allows creating specialized versions of models with different defaults.
 */
export function openAIInjectVariants(models: ModelDescriptionSchema[], model: ModelDescriptionSchema): ModelDescriptionSchema[] {

  // Add variant first (if defined), then the base model
  if (hardcodedOpenAIVariants[model.id])
    models.push({
      ...model,
      ...hardcodedOpenAIVariants[model.id],
    });

  // Add the base model
  models.push(model);

  return models;
}


/**
 * Checks for both superfluous and missing models in OpenAI API.
 *
 * Combines the functionality of checking for models in our editorial definitions
 * that aren't present in the API response (superfluous) and checking for models
 * in the API that we don't have definitions for (missing).
 *
 * @param apiModels is the raw API response from OpenAI, the .data[] array
 * @param parsedModels is the parsed models array, which should match the wireModels
 */
export function openaiDevCheckForModelsOverlap_DEV(apiModels: unknown, parsedModels: object[]): void {

  if (DEV_DEBUG_OPENAI_MODELS) {

    // Check if wireModels has .data array
    if (!apiModels || !Array.isArray(apiModels)) {
      console.warn('[DEV] OpenAI: wireModels is not an array', apiModels);
      return;
    }

    const apiModelIds = apiModels.map((model: any) => model.id);

    // 1. Check for superfluous models (in our definitions but not in API)
    const expectedModelIds = _knownOpenAIChatModels
      .filter(model => model.idPrefix && model.idPrefix !== '') // exclude fallback model
      .map(model => model.idPrefix);

    const superfluousModels = expectedModelIds.filter(id => !apiModelIds.includes(id));
    if (superfluousModels.length > 0)
      console.warn(`[DEV] OpenAI: superfluous model definitions: [\n  - ${superfluousModels.join('\n  - ')}\n]`);

    // 2. Check for missing models (in API but not in our definitions)
    const parsedModelIds = parsedModels.map((model: any) => model.id);
    const missingModelIds = apiModelIds.filter((id: string) => !parsedModelIds.includes(id));

    if (missingModelIds.length > 0) {
      // Split missing models: filtered out vs truly missing
      // const filteredOutModels = missingModelIds.filter((id: string) =>
      //   openAIModelsDenyList.some(deny => id.includes(deny))
      // );
      const trulyMissingModels = missingModelIds.filter((id: string) =>
        !openAIModelsDenyList.some(deny => id.includes(deny)),
      );

      // if (filteredOutModels.length > 0)
      //   console.warn(`[DEV] OpenAI: filtered out models: [\n  - ${filteredOutModels.join('\n  - ')}\n]`);

      if (trulyMissingModels.length > 0)
        console.warn(`[DEV] OpenAI: truly missing model definitions[\n  - ${trulyMissingModels.join('\n  - ')}\n]`);
    }

  }

}
