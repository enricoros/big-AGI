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


/// Registry

export const DModelParameterRegistry = {

  /// Common parameters, normally available in all models ///
  // Note: we still use pre-v2 names for compatibility and ease of migration

  llmRef: {
    label: 'Model ID',
    type: 'string' as const,
    description: 'Upstream model reference',
    hidden: true,
  } as const,

  llmResponseTokens: {
    label: 'Maximum Tokens',
    type: 'integer' as const,
    description: 'Maximum length of generated text',
    nullable: {
      meaning: 'Explicitly avoid sending max_tokens to upstream API',
    } as const,
    requiredFallback: FALLBACK_LLM_PARAM_RESPONSE_TOKENS,   // if required and not specified/user overridden, use this value
  } as const,

  llmTemperature: {
    label: 'Temperature',
    type: 'float' as const,
    description: 'Controls randomness in the output',
    range: [0.0, 2.0] as const,
    nullable: {
      meaning: 'Explicitly avoid sending temperature to upstream API',
    } as const,
    requiredFallback: FALLBACK_LLM_PARAM_TEMPERATURE,
  } as const,

  /// Extended parameters, specific to certain models/vendors

  llmTopP: {
    label: 'Top P',
    type: 'float' as const,
    description: 'Nucleus sampling threshold',
    range: [0.0, 1.0] as const,
    requiredFallback: 1.0,
    incompatibleWith: ['temperature'] as const,
  } as const,

  /**
   * First introduced as a user-configurable parameter for the 'Verification' required by o3.
   * [2025-04-16] Adding parameter to disable streaming for o3, and possibly more models.
   */
  llmForceNoStream: {
    label: 'Disable Streaming',
    type: 'boolean' as const,
    description: 'Disables streaming for this model',
    // initialValue: false, // we don't need the initial value here, will be assumed off
  } as const,

  llmVndAnt1MContext: {
    label: '1M Context Window (Beta)',
    type: 'boolean' as const,
    description: 'Enable 1M token context window with premium pricing for >200K input tokens',
    // No initialValue - undefined means off (e.g. default 200K context window)
  } as const,

  llmVndAntSkills: {
    label: 'Document Skills',
    type: 'string' as const,
    description: 'Comma-separated skills (xlsx,pptx,pdf,docx)',
    initialValue: '', // empty string = disabled
  } as const,

  llmVndAntThinkingBudget: {
    label: 'Thinking Budget',
    type: 'integer' as const,
    description: 'Budget for extended thinking',
    range: [1024, 65536] as const,
    initialValue: 8192,
    nullable: {
      meaning: 'Disable extended thinking',
    } as const,
  } as const,

  llmVndAntWebFetch: {
    label: 'Web Fetch',
    type: 'enum' as const,
    description: 'Enable fetching content from web pages and PDFs',
    values: ['auto', 'off'] as const,
    // No initialValue - undefined means off (same as 'off')
  } as const,

  llmVndAntWebSearch: {
    label: 'Web Search',
    type: 'enum' as const,
    description: 'Enable web search for real-time information',
    values: ['auto', 'off'] as const,
    // No initialValue - undefined means off (same as 'off')
  } as const,

  llmVndGeminiAspectRatio: {
    label: 'Aspect Ratio',
    type: 'enum' as const,
    description: 'Controls the aspect ratio of generated images',
    values: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9'] as const,
    // No initial value - when undefined, the model decides the aspect ratio
  } as const,

  llmVndGeminiCodeExecution: {
    label: 'Code Execution',
    type: 'enum' as const,
    description: 'Enable automatic Python code generation and execution by the model',
    values: ['auto'] as const,
    // No initialValue - undefined means off
  } as const,

  llmVndGeminiComputerUse: {
    label: 'Computer Use Environment',
    type: 'enum' as const,
    description: 'Environment type for Computer Use tool (required for Computer Use model)',
    values: ['browser'] as const,
    initialValue: 'browser',
    // requiredFallback: 'browser', // See `const _requiredParamId: DModelParameterId[]` in llms.parameters.ts for why custom params don't have required values at AIX invocation...
    hidden: true,
  } as const,

  llmVndGeminiGoogleSearch: {
    label: 'Google Search',
    type: 'enum' as const,
    description: 'Enable Google Search grounding with optional time filter',
    values: ['unfiltered', '1d', '1w', '1m', '6m', '1y'] as const,
    // No initialValue - undefined means off
  } as const,

  llmVndGeminiMediaResolution: {
    label: 'Media Resolution',
    type: 'enum' as const,
    description: 'Controls vision processing quality for multimodal inputs. Higher resolution improves text reading and detail identification but increases token usage.',
    values: ['mr_high', 'mr_medium', 'mr_low'] as const,
    // No initialValue - undefined: "If unspecified, the model uses optimal defaults based on the media type." (Images: high, PDFs: medium, Videos: low/medium (rec: high for OCR))
  } as const,

  llmVndGeminiShowThoughts: {
    label: 'Show Thoughts',
    type: 'boolean' as const,
    description: 'Show Gemini\'s reasoning process',
    initialValue: true,
  } as const,

  llmVndGeminiThinkingBudget: {
    label: 'Thinking Budget',
    type: 'integer' as const,
    /**
     * can be overwritten, as gemini models seem to have different ranges which also does not include 0
     * - value = 0 disables thinking
     * - value = undefined means 'auto thinking budget'.
     */
    range: [0, 24576] as const,
    // initialValue: unset, // auto-budgeting
    description: 'Budget for extended thinking. 0 disables thinking. If not set, the model chooses automatically.',
  } as const,

  llmVndGeminiThinkingLevel: {
    label: 'Thinking Level',
    type: 'enum' as const,
    description: 'Controls internal reasoning depth. Replaces thinking_budget for Gemini 3 models. When unset, the model decides dynamically.',
    values: ['high', 'medium' /* not present at launch */, 'low' /* default when unset */] as const,
    // No initialValue - undefined means 'dynamic', which for Gemini Pro is the same as 'high' (which is the equivalent of 'medium' for OpenAI's effort levels.. somehow)
  } as const,

  // NOTE: we don't have this as a parameter, as for now we use it in tandem with llmVndGeminiGoogleSearch
  // llmVndGeminiUrlContext: {
  //   label: 'URL Context',
  //   type: 'enum' as const,
  //   description: 'Enable fetching and analyzing content from URLs provided in prompts (up to 20 URLs, 34MB each)',
  //   values: ['auto'] as const,
  //   // No initialValue - undefined means off
  // } as const,

  // Moonshot-specific parameters

  llmVndMoonshotWebSearch: {
    label: 'Web Search',
    type: 'enum' as const,
    description: 'Enable Kimi\'s $web_search builtin function for real-time web search ($0.005 per search)',
    values: ['auto'] as const,
    // No initialValue - undefined means off
  } as const,

  // OpenAI-specific parameters

  llmVndOaiReasoningEffort: {
    label: 'Reasoning Effort',
    type: 'enum' as const,
    description: 'Constrains effort on reasoning for OpenAI reasoning models',
    values: ['low', 'medium', 'high'] as const,
    requiredFallback: 'medium',
  } as const,

  llmVndOaiReasoningEffort4: {
    label: 'Reasoning Effort',
    type: 'enum' as const,
    description: 'Constrains effort on reasoning for OpenAI advanced reasoning models',
    values: ['minimal', 'low', 'medium', 'high'] as const,
    requiredFallback: 'medium',
  } as const,

  llmVndOaiRestoreMarkdown: {
    label: 'Restore Markdown',
    type: 'boolean' as const,
    description: 'Restore Markdown formatting in the output',
    initialValue: true,
  } as const,

  llmVndOaiVerbosity: {
    label: 'Verbosity',
    type: 'enum' as const,
    description: 'Controls response length and detail level',
    values: ['low', 'medium', 'high'] as const,
    requiredFallback: 'medium',
  } as const,

  llmVndOaiWebSearchContext: {
    label: 'Search Context Size',
    type: 'enum' as const,
    description: 'Amount of context retrieved from the web',
    values: ['low', 'medium', 'high'] as const,
    requiredFallback: 'medium',
  } as const,

  llmVndOaiWebSearchGeolocation: {
    // NOTE: for now this is a boolean to enable/disable using client-side geolocation, but
    // in the future we could have it a more complex object. Note that the payload that comes
    // back if of type AixAPI_Model.userGeolocation, which is the AIX Wire format for the
    // location payload.
    label: 'Add User Location (Geolocation API)',
    type: 'boolean' as const,
    description: 'Approximate location for search results',
    initialValue: false,
  } as const,

  llmVndOaiImageGeneration: {
    label: 'Image Generation',
    type: 'enum' as const,
    description: 'Image generation mode and quality',
    values: ['mq', 'hq', 'hq_edit' /* precise input editing */, 'hq_png' /* uncompressed */] as const,
    // No initialValue - defaults to undefined (off)
    // No requiredFallback - this is optional
  } as const,

  // Perplexity-specific parameters

  // llmVndPerplexityReasoningEffort - we reuse the OpenAI reasoning effort parameter

  llmVndPerplexityDateFilter: {
    label: 'Date Range',
    type: 'enum' as const,
    description: 'Filter results by publication date',
    values: ['unfiltered', '1m', '3m', '6m', '1y'] as const,
    // requiredFallback: 'unfiltered',
  } as const,

  llmVndOrtWebSearch: {
    label: 'Web Search',
    type: 'enum' as const,
    description: 'Enable OpenRouter web search (uses native search for OpenAI/Anthropic, Exa for others)',
    values: ['auto'] as const,
    // No initialValue - undefined means off
  } as const,

  llmVndPerplexitySearchMode: {
    label: 'Search Mode',
    type: 'enum' as const,
    description: 'Type of sources to search',
    values: ['default', 'academic'] as const,
    // requiredFallback: 'default', // or leave unset for "unspecified"
  } as const,

  // xAI-specific parameters

  llmVndXaiSearchMode: {
    label: 'Search Mode',
    type: 'enum' as const,
    description: 'Controls when to use live search',
    values: ['auto', 'on', 'off'] as const,
    initialValue: 'auto', // we default to auto for our users, to get them search out of the box
  } as const,

  llmVndXaiSearchSources: {
    label: 'Search Sources',
    type: 'string' as const,
    description: 'Comma-separated sources (web,x,news,rss)',
    initialValue: 'web,x', // defaults to web,x as per xAI docs
  } as const,

  llmVndXaiSearchDateFilter: {
    label: 'Search From Date',
    type: 'enum' as const,
    description: 'Filter search results by publication date',
    values: ['unfiltered', '1d', '1w', '1m', '6m', '1y'] as const,
    // requiredFallback: 'unfiltered',
  } as const,

} as const;


/// Types

// this is the client-side typescript definition that matches ModelParameterSpec_schema in `llm.server.types.ts`
export interface DModelParameterSpec<T extends DModelParameterId> {
  paramId: T;
  required?: boolean;
  hidden?: boolean;
  initialValue?: boolean | number | string | null;
  // upstreamDefault?: DModelParameterValue<T>;
  /**
   * (optional, rare) Special: [min, max] range override for this parameter.
   * Used by llmVndGeminiThinkingBudget to allow different ranges for different models.
   */
  rangeOverride?: [number, number];
}

export type DModelParameterValues = {
  [K in DModelParameterId]?: DModelParameterValue<K>;
}

export type DModelParameterId = keyof typeof DModelParameterRegistry;
// type _ExtendedParameterId = keyof typeof _ExtendedParameterRegistry;

type _EnumValues<T> = T extends { type: 'enum', values: readonly (infer U)[] } ? U : never;

type DModelParameterValue<T extends DModelParameterId> =
  typeof DModelParameterRegistry[T]['type'] extends 'integer'
    ? typeof DModelParameterRegistry[T] extends { nullable: any }
      ? number | null
      : number :
    typeof DModelParameterRegistry[T]['type'] extends 'float'
      ? typeof DModelParameterRegistry[T] extends { nullable: any }
        ? number | null
        : number :
      typeof DModelParameterRegistry[T]['type'] extends 'string' ? string :
        typeof DModelParameterRegistry[T]['type'] extends 'boolean' ? boolean :
          typeof DModelParameterRegistry[T]['type'] extends 'enum'
            ? _EnumValues<typeof DModelParameterRegistry[T]>
            : never;


/// Utility Functions

export function applyModelParameterInitialValues(destValues: DModelParameterValues, parameterSpecs: DModelParameterSpec<DModelParameterId>[], overwriteExisting: boolean): void {
  for (const param of parameterSpecs) {
    const paramId = param.paramId;

    // skip if already present
    if (!overwriteExisting && paramId in destValues)
      continue;

    // 1. (if present) apply Spec.initialValue
    if (param.initialValue !== undefined) {
      destValues[paramId] = param.initialValue as DModelParameterValue<typeof paramId>;
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


const _requiredParamId: DModelParameterId[] = [
  // 'llmRef', // disabled: we know this can't have a fallback value in the registry
  'llmResponseTokens', // DModelParameterRegistry.llmResponseTokens.requiredFallback = FALLBACK_LLM_PARAM_RESPONSE_TOKENS
  'llmTemperature', // DModelParameterRegistry.llmTemperature.requiredFallback = FALLBACK_LLM_PARAM_TEMPERATURE
] as const;

export function getAllModelParameterValues(initialParameters: undefined | DModelParameterValues, userParameters?: DModelParameterValues): DModelParameterValues {

  // fallback values
  const fallbackParameters: DModelParameterValues = {};
  for (const requiredParamId of _requiredParamId) {
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
