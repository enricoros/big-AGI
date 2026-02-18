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


/**
 * Implicit common parameters always supported by all models, not listed in parameterSpecs.
 * Must be preserved during model refresh operations.
 */
export const LLMImplicitParamersRuntimeFallback = {
  // llmRef: '' // disabled: we know this can't have a fallback value in the registry
  llmResponseTokens: 8192,
  llmTemperature: 0.5,
  // llmTopP: 1.0,
} as const satisfies DModelParameterValues;


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
  readonly initialValue?: number | null;
}

interface _FloatParamDef extends _ParamDefBase {
  readonly type: 'float';
  readonly range?: readonly [number, number];
  readonly nullable?: { readonly meaning: string };
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

interface _EnumParamDef<V extends string = string> extends _ParamDefBase {
  readonly type: 'enum';
  readonly values: readonly V[];
  readonly initialValue?: NoInfer<V>;
  /** Per-value pricing multiplier. When the parameter is set to a value listed here, model pricing is multiplied. */
  readonly enumPriceMultiplier?: { readonly [k in NoInfer<V>]?: number };
}

/** Zero-cost identity function - TS infers V from `values` only: NoInfer constrains fallback/initial. */
function _enumDef<const V extends string>(def: _EnumParamDef<V>): _EnumParamDef<V> {
  return def;
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
  },

  llmTemperature: {
    label: 'Temperature',
    type: 'float',
    description: 'Controls randomness in the output',
    range: [0.0, 2.0],
    nullable: {
      meaning: 'Explicitly avoid sending temperature to upstream API',
    },
  },

  /// Extended parameters, specific to certain models/vendors

  llmTopP: {
    label: 'Top P',
    type: 'float',
    description: 'Nucleus sampling threshold',
    range: [0.0, 1.0],
  },

  /**
   * Unified 'reasoning' effort parameter for all vendors. The full superset of all possible effort levels.
   * Each model declares its own subset via `enumValues` in its parameterSpec.
   *
   * Mapping to vendor-native values is done in adapters (the only place with vendor knowledge):
   * - Anthropic: output_config.effort
   * - OpenAI: reasoning_effort (ChatCompletions) / reasoning.effort (Responses)
   * - Gemini: thinkingConfig.thinkingLevel (depending on model: low/high, minimal/low/medium/high, ...)
   * - Moonshot/ZAI: thinking.type (none->disabled, high->enabled)
   * - Perplexity: reasoning_effort
   * - etc.
   */
  llmEffort: _enumDef({
    label: 'Reasoning Effort',
    type: 'enum',
    description: 'Controls reasoning depth and effort level.',
    values: [
      // all values (max includes) sorted in ascending order of effort
      'none', 'minimal', 'low', 'medium', 'high', 'xhigh', // OpenAI/common
      'max', // Anthropic only, for now
    ],
    // No initialValue - undefined means vendor default (usually high or medium, could be different such as none)
  }),

  /**
   * First introduced as a user-configurable parameter for the 'Verification' required by o3.
   * [2025-04-16] Adding parameter to disable streaming for o3, and possibly more models.
   *
   * [2026-01-21] OpenAI Responses API: Reasoning Summaries require organization verification.
   * Per OpenAI docs, both streaming AND reasoning summaries require org verification for GPT-5/5.1/5.2.
   *  - https://help.openai.com/en/articles/10362446-api-model-availability-by-usage-tier-and-verification-status
   *  - Rather than adding a separate param, we piggyback on llmForceNoStream
   */
  llmForceNoStream: {
    label: 'Disable Streaming',
    type: 'boolean',
    description: 'Disables streaming for this model',
    // initialValue: false, // we don't need the initial value here, will be assumed off
  },


  // Anthropic-specific

  llmVndAnt1MContext: {
    label: '1M Context Window (Beta)',
    type: 'boolean',
    description: 'Enable 1M token context window with premium pricing for >200K input tokens',
    // No initialValue - undefined means off (e.g. default 200K context window)
  },

  llmVndAntInfSpeed: _enumDef({
    label: 'Fast Mode',
    type: 'enum',
    description: 'Accelerated inference (~2.5x faster output) at 6x pricing. Preview access required.',
    values: ['fast'],
    enumPriceMultiplier: { fast: 6 },
    // No initialValue - undefined means standard speed (omitted from request)
  }),

  llmVndAntSkills: {
    label: 'Document Skills',
    type: 'string',
    description: 'Comma-separated skills (xlsx,pptx,pdf,docx)',
    initialValue: '', // empty string = disabled
  },

  /**
   * NOTE: this is being phased out with Opus 4.6 in favor of llmEffort ('low', 'medium', 'high', 'max')
   *
   * Important: when this is set to anything other than nullish, it enables Adaptive(-1)/Extended(int > 1024) thinking,
   * and as a side effect **disables the temperature** in the requests (even when tunneled through OpenRouter). So this
   * control must disable the UI controls for temperature in both the side panel and the model configuration dialog.
   */
  llmVndAntThinkingBudget: {
    label: 'Thinking Budget',
    type: 'integer',
    description: 'Budget for extended thinking',
    range: [1024, 65536],
    initialValue: 16384, // special: '-1' is an out-of-range sentinel for 'adaptive' thinking (hidden, used for 4.6+)
    nullable: { // null means to not turn on thinking at all, and it's the user-overridden equivalent to the param missing
      meaning: 'Disable extended thinking',
    },
  },

  llmVndAntWebFetch: _enumDef({ // implies: LLM_IF_Tools_WebSearch
    label: 'Web Fetch',
    type: 'enum',
    description: 'Enable fetching content from web pages and PDFs',
    values: ['auto', 'off'],
    // No initialValue - undefined means off (same as 'off')
  }),

  llmVndAntWebSearch: _enumDef({ // implies: LLM_IF_Tools_WebSearch
    label: 'Web Search',
    type: 'enum',
    description: 'Enable web search for real-time information',
    values: ['auto', 'off'],
    // No initialValue - undefined means off (same as 'off')
  }),

  // llmVndAntToolSearch: { // Not user set
  //   label: 'Tool Search',
  //   type: 'enum',
  //   description: 'Search algorithm for discovering tools on-demand (regex=pattern-based, bm25=natural language)',
  //   values: ['regex', 'bm25'],
  //   // No initialValue - undefined means off (tool search disabled)
  // },


  // Gemini-specific

  llmVndGeminiAspectRatio: _enumDef({ // implies: LLM_IF_Outputs_Image
    label: 'Aspect Ratio',
    type: 'enum',
    description: 'Controls the aspect ratio of generated images',
    values: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9'],
    // No initial value - when undefined, the model decides the aspect ratio
  }),

  llmVndGeminiCodeExecution: _enumDef({
    label: 'Code Execution',
    type: 'enum',
    description: 'Enable automatic Python code generation and execution by the model',
    values: ['auto'],
    // No initialValue - undefined means off
  }),

  llmVndGeminiComputerUse: _enumDef({
    label: 'Computer Use Environment',
    type: 'enum',
    description: 'Environment type for Computer Use tool (required for Computer Use model)',
    values: ['browser'],
    initialValue: 'browser',
  }),

  llmVndGeminiGoogleSearch: _enumDef({ // implies: LLM_IF_Tools_WebSearch
    label: 'Google Search',
    type: 'enum',
    description: 'Enable Google Search grounding with optional time filter',
    values: ['unfiltered', '1d', '1w', '1m', '6m', '1y'],
    // No initialValue - undefined means off
  }),

  llmVndGeminiImageSize: _enumDef({ // implies: LLM_IF_Outputs_Image - [Gemini, 2025-11-20] Nano Banana launch
    label: 'Image Size',
    type: 'enum',
    description: 'Controls the resolution of generated images',
    values: ['1K', '2K', '4K'],
    // No initial value - when undefined, the model decides the image size
  }),

  llmVndGeminiMediaResolution: _enumDef({
    label: 'Media Resolution',
    type: 'enum',
    description: 'Controls vision processing quality for multimodal inputs. Higher resolution improves text reading and detail identification but increases token usage.',
    values: ['mr_high', 'mr_medium', 'mr_low'],
    // No initialValue - undefined: "If unspecified, the model uses optimal defaults based on the media type." (Images: high, PDFs: medium, Videos: low/medium (rec: high for OCR))
  }),

  llmVndGeminiThinkingBudget: {
    label: 'Thinking Budget',
    type: 'integer',
    /**
     * can be overwritten, as gemini models seem to have different ranges which also does not include 0
     * - value = 0 disables thinking
     * - value = undefined means 'auto thinking budget'.
     */
    range: [0, 24576],
    // initialValue: unset, // auto-budgeting
    description: 'Budget for extended thinking. 0 disables thinking. If not set, the model chooses automatically.',
  },

  // NOTE: we don't have this as a parameter, as for now we use it in tandem with llmVndGeminiGoogleSearch
  // llmVndGeminiUrlContext: {
  //   label: 'URL Context',
  //   type: 'enum',
  //   description: 'Enable fetching and analyzing content from URLs provided in prompts (up to 20 URLs, 34MB each)',
  //   values: ['auto'],
  //   // No initialValue - undefined means off
  // },


  // Moonshot-specific parameters

  llmVndMoonshotWebSearch: _enumDef({ // implies: LLM_IF_Tools_WebSearch
    label: 'Web Search',
    type: 'enum',
    description: 'Enable Kimi\'s $web_search builtin function for real-time web search ($0.005 per search)',
    values: ['auto'],
    // No initialValue - undefined means off
  }),


  // OpenAI-specific

  llmVndOaiRestoreMarkdown: {
    label: 'Restore Markdown',
    type: 'boolean',
    description: 'Restore Markdown formatting in the output',
    initialValue: true,
  },

  llmVndOaiVerbosity: _enumDef({
    label: 'Verbosity',
    type: 'enum',
    description: 'Controls response length and detail level',
    values: ['low', 'medium', 'high'],
  }),

  llmVndOaiWebSearchContext: _enumDef({ // implies: LLM_IF_Tools_WebSearch
    label: 'Search Context Size',
    type: 'enum',
    description: 'Amount of context retrieved from the web',
    values: ['low', 'medium', 'high'],
  }),

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

  llmVndOaiImageGeneration: _enumDef({ // implies: LLM_IF_Outputs_Image
    label: 'Image Generation',
    type: 'enum',
    description: 'Image generation mode and quality',
    values: ['mq', 'hq', 'hq_edit' /* precise input editing */, 'hq_png' /* uncompressed */],
    // No initialValue - defaults to undefined (off)
  }),

  llmVndOaiCodeInterpreter: _enumDef({
    label: 'Code Interpreter',
    type: 'enum',
    description: 'Python code execution ($0.03/container)',
    values: ['off', 'auto'],
    // No initialValue - undefined means off (same as 'off')
  }),


  // OpenRouter-specific

  llmVndOrtWebSearch: _enumDef({ // implies: LLM_IF_Tools_WebSearch
    label: 'Web Search',
    type: 'enum',
    description: 'Enable OpenRouter web search (uses native search for OpenAI/Anthropic, Exa for others)',
    values: ['auto'],
    // No initialValue - undefined means off
  }),


  // Perplexity-specific parameters

  llmVndPerplexityDateFilter: _enumDef({
    label: 'Date Range',
    type: 'enum',
    description: 'Filter results by publication date',
    values: ['unfiltered', '1m', '3m', '6m', '1y'],
  }),

  llmVndPerplexitySearchMode: _enumDef({ // implies: LLM_IF_Tools_WebSearch
    label: 'Search Mode',
    type: 'enum',
    description: 'Type of sources to search',
    values: ['default', 'academic'],
  }),


  // xAI-specific parameters

  llmVndXaiCodeExecution: _enumDef({
    label: 'Code Execution',
    type: 'enum',
    description: 'Enable server-side code execution by the model',
    values: ['off', 'auto'],
    // No initialValue - undefined means off (same as 'off')
  }),

  llmVndXaiSearchInterval: _enumDef({
    label: 'Search Interval', // "X Search only" for now, fw comp to web search
    type: 'enum',
    description: 'Search in this interval',
    values: ['unfiltered', '1d', '1w', '1m', '6m', '1y'],
    // No initialValue - undefined means unfiltered
  }),

  llmVndXaiWebSearch: _enumDef({ // implies: LLM_IF_Tools_WebSearch
    label: 'Web Search',
    type: 'enum',
    description: 'Enable web search for real-time information',
    values: ['off', 'auto'],
    // No initialValue - undefined means off (same as 'off')
  }),

  llmVndXaiXSearch: _enumDef({ // implies: LLM_IF_Tools_WebSearch
    label: 'X Search',
    type: 'enum',
    description: 'Enable X/Twitter search for social media content',
    values: ['off', 'auto'],
    // NOTE: disabling or this could be slow
    // initialValue: 'auto', // we default to 'auto' for our users, as they may expect "X search" out of the box
  }),

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
  /**
   * (optional) For enum params: restrict which values from the registry are allowed for this model.
   * The UI will only show these values. Analogous to rangeOverride for numeric params.
   * Example: llmEffort registry has 7 values, but a specific model may only support ['low', 'medium', 'high'].
   */
  enumValues?: readonly string[];
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


export function getAllModelParameterValues(initialParameters: undefined | DModelParameterValues, userParameters?: DModelParameterValues): DModelParameterValues {
  return {
    ...LLMImplicitParamersRuntimeFallback,
    ...initialParameters,
    ...userParameters,
  };
}


/**
 * NOTE: this is actually only used for `llmResponseTokens` from the Composer for now (!)
 */
export function getModelParameterValueWithFallback<T extends DModelParameterId>(
  paramId: T,
  initialValues: undefined | DModelParameterValues,
  userValues: undefined | DModelParameterValues,
  fallbackValue: DModelParameterValue<T>,
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
  return fallbackValue;
}
