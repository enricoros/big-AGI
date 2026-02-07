/**
 * Parameter Registry and Model Configuration
 *
 * This module provides a type-safe parameter management system for LLM models.
 * It handles parameter definitions, validation, and runtime values while
 * maintaining strict type safety throughout the application.
 *
 * Key concepts:
 * - ParameterRegistry: Defines all possible parameters and their constraints
 * - ParameterSpec: Model-specific parameter configurations
 * - ParameterValues: Runtime parameter values (initial and user overrides)
 *
 * @module llms
 */


// shared constants
export const FALLBACK_LLM_PARAM_RESPONSE_TOKENS = 4096;
export const FALLBACK_LLM_PARAM_TEMPERATURE = 0.5;
// const FALLBACK_LLM_PARAM_REF_UNKNOWN = 'unknown_id';


/// Registry Entry Types (for compile-time validation)

type _ParameterRegistryEntry =
  | _IntegerParamDef
  | _FloatParamDef
  | _StringParamDef
  | _BooleanParamDef
  | _EnumParamDef;

interface _ParamDefBase {
  readonly label: string;
  readonly description: string;
}

interface _IntegerParamDef extends _ParamDefBase {
  readonly type: 'integer';
  readonly range?: readonly [number, number];
  readonly nullable?: { readonly meaning: string };
  readonly requiredFallback?: number;
  readonly initialValue?: number | null;
}

interface _FloatParamDef extends _ParamDefBase {
  readonly type: 'float';
  readonly range?: readonly [number, number];
  readonly nullable?: { readonly meaning: string };
  readonly requiredFallback?: number;
  readonly initialValue?: number | null;
}

interface _StringParamDef extends _ParamDefBase {
  readonly type: 'string';
  readonly initialValue?: string;
}

interface _BooleanParamDef extends _ParamDefBase {
  readonly type: 'boolean';
  readonly initialValue?: boolean;
}

interface _EnumParamDef extends _ParamDefBase {
  readonly type: 'enum';
  readonly values: readonly string[];
  readonly requiredFallback?: string;
  readonly initialValue?: string;
}


/// Registry

export const DModelParameterRegistry = {

  /// Common parameters, normally available in all models ///
  // Note: we still use pre-v2 names for compatibility and ease of migration

  llmRef: {
    label: 'Model ID',
    type: 'string',
    description: 'Upstream model reference',
  },

  llmResponseTokens: {
    label: 'Maximum Tokens',
    type: 'integer',
    description: 'Maximum length of generated text',
    nullable: {
      meaning: 'Explicitly avoid sending max_tokens to upstream API',
    },
    requiredFallback: FALLBACK_LLM_PARAM_RESPONSE_TOKENS,   // if required and not specified/user overridden, use this value
  },

  llmTemperature: {
    label: 'Temperature',
    type: 'float',
    description: 'Controls randomness in the output',
    range: [0.0, 2.0] as const,
    nullable: {
      meaning: 'Explicitly avoid sending temperature to upstream API',
    },
    requiredFallback: FALLBACK_LLM_PARAM_TEMPERATURE,
  },

  /// Extended parameters, specific to certain models/vendors

  llmTopP: {
    label: 'Top P',
    type: 'float',
    description: 'Nucleus sampling threshold',
    range: [0.0, 1.0] as const,
    requiredFallback: 1.0,
  },

  /**
   * First introduced as a user-configurable parameter for the 'Verification' required by o3.
   * [2025-04-16] Adding parameter to disable streaming for o3, and possibly more models.
   *
   * [2026-01-21] OpenAI Responses API: Reasoning Summaries require organization verification.
   * Per OpenAI docs, both streaming AND reasoning summaries require org verification for GPT-5/5.1/5.2.
   *  - https://help.openai.com/en/articles/10362446-api-model-availability-by-usage-tier-and-verification-status
   *  - Rather than adding a separate param, we piggyback on llmForceNoStream.
   *  - AIX Wire type `vndOaiReasoningSummary` is derived from `llmForceNoStream` in aix.client.ts.
   */
  llmForceNoStream: {
    label: 'Disable Streaming',
    type: 'boolean',
    description: 'Disables streaming for this model',
    // initialValue: false, // we don't need the initial value here, will be assumed off
  },

  llmVndAnt1MContext: {
    label: '1M Context Window (Beta)',
    type: 'boolean',
    description: 'Enable 1M token context window with premium pricing for >200K input tokens',
    // No initialValue - undefined means off (e.g. default 200K context window)
  },

  llmVndAntEffortMax: { // introduced with Claude Opus 4.6; this adds the 'max' level on top of llmVndAntEffort
    label: 'Effort',
    type: 'enum' as const,
    description: 'Controls thinking depth. max = deepest reasoning with no constraints, high = default.',
    values: ['low', 'medium', 'high', 'max'] as const,
    // No initialValue - undefined means high effort (default)
  } as const,

  llmVndAntEffort: {
    label: 'Effort',
    type: 'enum' as const,
    description: 'Controls token usage vs. thoroughness trade-off. Works alongside thinking budget.',
    values: ['low', 'medium', 'high'] as const,
    // No initialValue - undefined means high effort (default, equivalent to omitting the parameter)
  } as const,

  llmVndAntSkills: {
    label: 'Document Skills',
    type: 'string',
    description: 'Comma-separated skills (xlsx,pptx,pdf,docx)',
    initialValue: '', // empty string = disabled
  },

  /**
   * Important: when this is set to anything other than nullish, it enables Adaptive(-1)/Extended(int > 1024) thinking,
   * and as a side effect **disables the temperature** in the requests (even when tunneled through OpenRouter). So this
   * control must disable the UI controls for temperature in both the side panel and the model configuration dialog.
   */
  llmVndAntThinkingBudget: {
    label: 'Thinking Budget',
    type: 'integer',
    description: 'Budget for extended thinking',
    range: [1024, 65536] as const,
    initialValue: 16384, // special: '-1' is an out-of-range sentinel for 'adaptive' thinking (hidden, used for 4.6+)
    nullable: { // null means to not turn on thinking at all, and it's the user-overridden equivalent to the param missing
      meaning: 'Disable extended thinking',
    },
  },

  llmVndAntWebFetch: { // implies: LLM_IF_Tools_WebSearch
    label: 'Web Fetch',
    type: 'enum',
    description: 'Enable fetching content from web pages and PDFs',
    values: ['auto', 'off'] as const,
    // No initialValue - undefined means off (same as 'off')
  },

  llmVndAntWebSearch: { // implies: LLM_IF_Tools_WebSearch
    label: 'Web Search',
    type: 'enum',
    description: 'Enable web search for real-time information',
    values: ['auto', 'off'] as const,
    // No initialValue - undefined means off (same as 'off')
  },

  // llmVndAntToolSearch: { // Not user set
  //   label: 'Tool Search',
  //   type: 'enum' as const,
  //   description: 'Search algorithm for discovering tools on-demand (regex=pattern-based, bm25=natural language)',
  //   values: ['regex', 'bm25'] as const,
  //   // No initialValue - undefined means off (tool search disabled)
  // } as const,

  llmVndGeminiAspectRatio: { // implies: LLM_IF_Outputs_Image
    label: 'Aspect Ratio',
    type: 'enum',
    description: 'Controls the aspect ratio of generated images',
    values: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9'] as const,
    // No initial value - when undefined, the model decides the aspect ratio
  },

  llmVndGeminiCodeExecution: {
    label: 'Code Execution',
    type: 'enum',
    description: 'Enable automatic Python code generation and execution by the model',
    values: ['auto'] as const,
    // No initialValue - undefined means off
  },

  llmVndGeminiComputerUse: {
    label: 'Computer Use Environment',
    type: 'enum',
    description: 'Environment type for Computer Use tool (required for Computer Use model)',
    values: ['browser'] as const,
    initialValue: 'browser',
    // requiredFallback: 'browser', // See `const _requiredParamId: DModelParameterId[]` in llms.parameters.ts for why custom params don't have required values at AIX invocation...
  },

  llmVndGeminiGoogleSearch: { // implies: LLM_IF_Tools_WebSearch
    label: 'Google Search',
    type: 'enum',
    description: 'Enable Google Search grounding with optional time filter',
    values: ['unfiltered', '1d', '1w', '1m', '6m', '1y'] as const,
    // No initialValue - undefined means off
  },

  llmVndGeminiImageSize: { // implies: LLM_IF_Outputs_Image - [Gemini, 2025-11-20] Nano Banana launch
    label: 'Image Size',
    type: 'enum',
    description: 'Controls the resolution of generated images',
    values: ['1K', '2K', '4K'] as const,
    // No initial value - when undefined, the model decides the image size
  },

  llmVndGeminiMediaResolution: {
    label: 'Media Resolution',
    type: 'enum',
    description: 'Controls vision processing quality for multimodal inputs. Higher resolution improves text reading and detail identification but increases token usage.',
    values: ['mr_high', 'mr_medium', 'mr_low'] as const,
    // No initialValue - undefined: "If unspecified, the model uses optimal defaults based on the media type." (Images: high, PDFs: medium, Videos: low/medium (rec: high for OCR))
  },

  llmVndGeminiShowThoughts: {
    label: 'Show Thoughts',
    type: 'boolean',
    description: 'Show Gemini\'s reasoning process',
    // initialValue: true, // no initial value
  },

  llmVndGeminiThinkingBudget: {
    label: 'Thinking Budget',
    type: 'integer',
    /**
     * can be overwritten, as gemini models seem to have different ranges which also does not include 0
     * - value = 0 disables thinking
     * - value = undefined means 'auto thinking budget'.
     */
    range: [0, 24576] as const,
    // initialValue: unset, // auto-budgeting
    description: 'Budget for extended thinking. 0 disables thinking. If not set, the model chooses automatically.',
  },

  llmVndGeminiThinkingLevel: {
    label: 'Thinking Level',
    type: 'enum',
    description: 'Controls internal reasoning depth for Gemini 3 Pro. When unset, the model decides dynamically.',
    values: ['high', 'low'] as const,
    // No initialValue - undefined means 'dynamic', which for Gemini Pro is the same as 'high'
  },

  llmVndGeminiThinkingLevel4: {
    label: 'Thinking Level',
    type: 'enum',
    description: 'Controls internal reasoning depth for Gemini 3 Flash. When unset, the model decides dynamically.',
    values: ['high', 'medium', 'low', 'minimal'] as const,
    // No initialValue - undefined means 'dynamic'
  },

  // NOTE: we don't have this as a parameter, as for now we use it in tandem with llmVndGeminiGoogleSearch
  // llmVndGeminiUrlContext: {
  //   label: 'URL Context',
  //   type: 'enum' as const,
  //   description: 'Enable fetching and analyzing content from URLs provided in prompts (up to 20 URLs, 34MB each)',
  //   values: ['auto'] as const,
  //   // No initialValue - undefined means off
  // } as const,

  // Moonshot-specific parameters

  llmVndMoonReasoningEffort: {
    label: 'Reasoning Effort',
    type: 'enum',
    description: 'Controls thinking depth for Kimi K2.5. High enables extended multi-step reasoning (default).',
    values: ['none', 'high'] as const,
    // No initialValue - undefined means high (thinking enabled, the default for K2.5)
  },

  llmVndMoonshotWebSearch: { // implies: LLM_IF_Tools_WebSearch
    label: 'Web Search',
    type: 'enum',
    description: 'Enable Kimi\'s $web_search builtin function for real-time web search ($0.005 per search)',
    values: ['auto'] as const,
    // No initialValue - undefined means off
  },

  // OpenAI-specific parameters
  // Reasoning effort levels per model:
  // - GPT-5: minimal, low, medium (default), high
  // - GPT-5.1: none (default), low, medium, high
  // - GPT-5.2: none (default), low, medium, high, xhigh
  // - GPT-5.2 Pro: medium (default), high, xhigh

  llmVndOaiReasoningEffort: {
    label: 'Reasoning Effort',
    type: 'enum',
    description: 'Constrains effort on reasoning for OpenAI reasoning models',
    values: ['low', 'medium', 'high'] as const,
    requiredFallback: 'medium',
  },

  llmVndOaiReasoningEffort4: {
    label: 'Reasoning Effort',
    type: 'enum',
    description: 'Constrains effort on reasoning for OpenAI advanced reasoning models',
    values: ['minimal', 'low', 'medium', 'high'] as const,
    requiredFallback: 'medium',
  },

  llmVndOaiReasoningEffort52: {
    label: 'Reasoning Effort',
    type: 'enum',
    description: 'Constrains effort on reasoning for GPT-5.2 models. When unset, defaults to none (fast responses).',
    values: ['none', 'low', 'medium', 'high', 'xhigh'] as const,
    // No requiredFallback - unset = none (the default for GPT-5.2)
    // No initialValue - starts undefined, which the UI should display as "none"
  },

  llmVndOaiReasoningEffort52Pro: {
    label: 'Reasoning Effort',
    type: 'enum',
    description: 'Constrains effort on reasoning for GPT-5.2 Pro. Defaults to medium.',
    values: ['medium', 'high', 'xhigh'] as const,
    // No requiredFallback - unset = medium (the default for GPT-5.2 Pro)
  },

  llmVndOaiRestoreMarkdown: {
    label: 'Restore Markdown',
    type: 'boolean',
    description: 'Restore Markdown formatting in the output',
    initialValue: true,
  },

  llmVndOaiVerbosity: {
    label: 'Verbosity',
    type: 'enum',
    description: 'Controls response length and detail level',
    values: ['low', 'medium', 'high'] as const,
    requiredFallback: 'medium',
  },

  llmVndOaiWebSearchContext: { // implies: LLM_IF_Tools_WebSearch
    label: 'Search Context Size',
    type: 'enum',
    description: 'Amount of context retrieved from the web',
    values: ['low', 'medium', 'high'] as const,
    requiredFallback: 'medium',
  },

  llmVndOaiWebSearchGeolocation: {
    // NOTE: for now this is a boolean to enable/disable using client-side geolocation, but
    // in the future we could have it a more complex object. Note that the payload that comes
    // back if of type AixAPI_Model.userGeolocation, which is the AIX Wire format for the
    // location payload.
    label: 'Add User Location (Geolocation API)',
    type: 'boolean',
    description: 'Approximate location for search results',
    initialValue: false,
  },

  llmVndOaiImageGeneration: { // implies: LLM_IF_Outputs_Image
    label: 'Image Generation',
    type: 'enum',
    description: 'Image generation mode and quality',
    values: ['mq', 'hq', 'hq_edit' /* precise input editing */, 'hq_png' /* uncompressed */] as const,
    // No initialValue - defaults to undefined (off)
    // No requiredFallback - this is optional
  },

  llmVndOaiCodeInterpreter: {
    label: 'Code Interpreter',
    type: 'enum',
    description: 'Python code execution ($0.03/container)',
    values: ['off', 'auto'] as const,
    // No initialValue - undefined means off (same as 'off')
  },

  // Perplexity-specific parameters

  // llmVndPerplexityReasoningEffort - we reuse the OpenAI reasoning effort parameter

  llmVndPerplexityDateFilter: {
    label: 'Date Range',
    type: 'enum',
    description: 'Filter results by publication date',
    values: ['unfiltered', '1m', '3m', '6m', '1y'] as const,
    // requiredFallback: 'unfiltered',
  },

  llmVndOrtWebSearch: { // implies: LLM_IF_Tools_WebSearch
    label: 'Web Search',
    type: 'enum',
    description: 'Enable OpenRouter web search (uses native search for OpenAI/Anthropic, Exa for others)',
    values: ['auto'] as const,
    // No initialValue - undefined means off
  },

  llmVndPerplexitySearchMode: { // implies: LLM_IF_Tools_WebSearch
    label: 'Search Mode',
    type: 'enum',
    description: 'Type of sources to search',
    values: ['default', 'academic'] as const,
    // requiredFallback: 'default', // or leave unset for "unspecified"
  },

  // xAI-specific parameters

  llmVndXaiCodeExecution: {
    label: 'Code Execution',
    type: 'enum',
    description: 'Enable server-side code execution by the model',
    values: ['off', 'auto'] as const,
    // No initialValue - undefined means off (same as 'off')
  },

  llmVndXaiSearchInterval: {
    label: 'Search Interval', // "X Search only" for now, fw comp to web search
    type: 'enum',
    description: 'Search in this interval',
    values: ['unfiltered', '1d', '1w', '1m', '6m', '1y'] as const,
    // No initialValue - undefined means unfiltered
  },

  llmVndXaiWebSearch: { // implies: LLM_IF_Tools_WebSearch
    label: 'Web Search',
    type: 'enum',
    description: 'Enable web search for real-time information',
    values: ['off', 'auto'] as const,
    // No initialValue - undefined means off (same as 'off')
  },

  llmVndXaiXSearch: { // implies: LLM_IF_Tools_WebSearch
    label: 'X Search',
    type: 'enum',
    description: 'Enable X/Twitter search for social media content',
    values: ['off', 'auto'] as const,
    // NOTE: disabling or this could be slow
    // initialValue: 'auto', // we default to 'auto' for our users, as they may expect "X search" out of the box
  },

  llmVndXaiXSearchHandles: {
    label: 'X Handles Filter',
    type: 'string',
    description: 'Filter X search to specific handles (comma-separated, e.g. @elonmusk, @xai)',
    // initialValue: '', // empty = no filter
  },

} as const satisfies Record<string, _ParameterRegistryEntry>;


/// Types

/** Stores runtime parameter values (initial and user overrides). */
export type DModelParameterValues = {
  [K in DModelParameterId]?: DModelParameterValue<K>;
};

export type DModelParameterId = keyof typeof DModelParameterRegistry;

/** Maps a parameter ID to its TypeScript value type (with nullable handling). */
export type DModelParameterValue<T extends DModelParameterId> =
  typeof DModelParameterRegistry[T] extends { nullable: object }
    ? _ParamTypeToBaseValue<T> | null
    : _ParamTypeToBaseValue<T>;


// helper: map parameter type to base TypeScript type (before nullable handling)
type _ParamTypeToBaseValue<T extends DModelParameterId> =
  typeof DModelParameterRegistry[T]['type'] extends 'integer' ? number :
    typeof DModelParameterRegistry[T]['type'] extends 'float' ? number :
      typeof DModelParameterRegistry[T]['type'] extends 'string' ? string :
        typeof DModelParameterRegistry[T]['type'] extends 'boolean' ? boolean :
          typeof DModelParameterRegistry[T]['type'] extends 'enum' ? _EnumValues<typeof DModelParameterRegistry[T]> :
            never;

type _EnumValues<T> = T extends { readonly type: 'enum'; readonly values: readonly (infer U)[] } ? U : never;


/**
 * Union of all possible model parameter specifications.
 */
export type DModelParameterSpecAny = {
  [K in DModelParameterId]: DModelParameterSpec<K>;
}[DModelParameterId];

/**
 * Model-specific parameter configuration
 * Defines which parameters a model supports and their per-model settings.
 *
 * Note: This is the client-side TypeScript definition that matches
 * ModelParameterSpec_schema in `llm.server.types.ts`.
 */
interface DModelParameterSpec<T extends DModelParameterId> {
  paramId: T;
  required?: boolean;
  hidden?: boolean;
  initialValue?: DModelParameterValue<T>;
  // upstreamDefault?: DModelParameterValue<T>;
  /**
   * (optional, rare) Special: [min, max] range override for this parameter.
   * Used by llmVndGeminiThinkingBudget to allow different ranges for different models.
   */
  rangeOverride?: [number, number];
}


/// Utility Functions

export function applyModelParameterSpecsInitialValues(destValues: DModelParameterValues, modelParameterSpecs: DModelParameterSpecAny[], overwriteExisting: boolean): void {
  for (const parameterSpec of modelParameterSpecs) {
    const paramId = parameterSpec.paramId;

    // skip if already present
    // NOTE: for the currently only caller, the destValues already has llmRef, llmTemperature, llmResponseTokens
    if (!overwriteExisting && paramId in destValues)
      continue;

    // 1. (if present) apply Spec.initialValue
    if (parameterSpec.initialValue !== undefined) {
      destValues[paramId] = parameterSpec.initialValue as DModelParameterValue<typeof paramId>;
      continue;
    }

    // 2. (if present) apply Registry[paramId].initialValue
    const registryDef = DModelParameterRegistry[paramId];
    if (registryDef) {
      if ('initialValue' in registryDef && registryDef.initialValue !== undefined)
        destValues[paramId] = registryDef.initialValue as DModelParameterValue<typeof paramId>;
    } else
      console.warn(`applyModelParameterInitialValues: unknown parameter id '${paramId}'`);
  }
}


/**
 * Implicit common parameters always supported by all models, not listed in parameterSpecs.
 * Must be preserved during model refresh operations.
 */
export const LLMS_ImplicitParamIds: readonly DModelParameterId[] = [
  // 'llmRef', // disabled: we know this can't have a fallback value in the registry
  'llmResponseTokens', // DModelParameterRegistry.llmResponseTokens.requiredFallback = FALLBACK_LLM_PARAM_RESPONSE_TOKENS
  'llmTemperature', // DModelParameterRegistry.llmTemperature.requiredFallback = FALLBACK_LLM_PARAM_TEMPERATURE
];

export function getAllModelParameterValues(initialParameters: undefined | DModelParameterValues, userParameters?: DModelParameterValues): DModelParameterValues {

  // fallback values
  const fallbackParameters: DModelParameterValues = {};
  for (const requiredParamId of LLMS_ImplicitParamIds) {
    if ('requiredFallback' in DModelParameterRegistry[requiredParamId])
      fallbackParameters[requiredParamId] = DModelParameterRegistry[requiredParamId].requiredFallback as DModelParameterValue<typeof requiredParamId>;
  }

  // accumulate initial and user values
  return {
    ...fallbackParameters,
    ...initialParameters,
    ...userParameters,
  };
}


/**
 * NOTE: this is actually only used for `llmResponseTokens` from the Composer for now (!)
 */
export function getModelParameterValueOrThrow<T extends DModelParameterId>(
  paramId: T,
  initialValues: undefined | DModelParameterValues,
  userValues: undefined | DModelParameterValues,
  fallbackValue: undefined | DModelParameterValue<T>,
): DModelParameterValue<T> {

  // check user values first
  if (userValues && paramId in userValues) {
    const value = userValues[paramId];
    if (value !== undefined) return value;
  }

  // then check initial values
  if (initialValues && paramId in initialValues) {
    const value = initialValues[paramId];
    if (value !== undefined) return value;
  }

  // then try provided fallback
  if (fallbackValue !== undefined) return fallbackValue;

  // finally the global registry fallback
  const paramDef = DModelParameterRegistry[paramId];
  if ('requiredFallback' in paramDef && paramDef.requiredFallback !== undefined)
    return paramDef.requiredFallback as DModelParameterValue<T>;

  // if we're here, we couldn't find a value
  // [DANGER] VERY DANGEROUS, but shall NEVER happen
  throw new Error(`getModelParameterValue: missing required parameter '${paramId}'`);
}
