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

  llmVndOaiReasoningEffort: {
    label: 'Reasoning Effort',
    type: 'enum' as const,
    description: 'Constrains effort on reasoning for OpenAI reasoning models',
    values: ['low', 'medium', 'high'] as const,
    requiredFallback: 'med',
  } as const,

} as const;


/// Types

export interface DModelParameterSpec<T extends DModelParameterId> {
  paramId: T;
  required?: boolean;
  hidden?: boolean;
  upstreamDefault?: DModelParameterValue<T>;
}

export type DModelParameterValues = {
  [K in DModelParameterId]?: DModelParameterValue<K>;
}

export type DModelParameterId = keyof typeof DModelParameterRegistry;
// type _ExtendedParameterId = keyof typeof _ExtendedParameterRegistry;

type _EnumValues<T> = T extends { type: 'enum', values: readonly (infer U)[] } ? U : never;

type DModelParameterValue<T extends DModelParameterId> =
  typeof DModelParameterRegistry[T]['type'] extends 'integer' ? number | null :
    typeof DModelParameterRegistry[T]['type'] extends 'float' ? number :
      typeof DModelParameterRegistry[T]['type'] extends 'string' ? string :
        typeof DModelParameterRegistry[T]['type'] extends 'boolean' ? boolean :
          typeof DModelParameterRegistry[T]['type'] extends 'enum'
            ? _EnumValues<typeof DModelParameterRegistry[T]>
            : never;


/// Utility Functions

const _requiredParamId: DModelParameterId[] = ['llmRef', 'llmResponseTokens', 'llmTemperature'] as const;

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
