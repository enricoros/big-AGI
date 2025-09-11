import type { DLLMId } from './llms.types';
import type { DModelDomainId } from './model.domains.types';
import type { DModelParameterValues } from './llms.parameters';


/**
 * This is used for Global models, as well as Per-Persona (or in the future per-project even) models.
 */
export type DModelConfiguration = {
  mct: 'model-parametric';

  // simpler version of a search space
  domainId: DModelDomainId;

  // configuration of the model and its parameters
  modelId: DLLMId | null; // null: "I don't want to use any model for this domain", which is different than an unconfigured domain, which can still have a 'fallback'
  modelParameters?: DModelParameterValues; // this is an override, to be overlaid on top of other configurations, if any
}


/// helpers - creation

export function createDModelConfiguration(domainId: DModelDomainId, modelId: DLLMId | null, modelParameters: DModelParameterValues | undefined): DModelConfiguration {
  return {
    mct: 'model-parametric',
    domainId: domainId,
    modelId: modelId,
    ...(modelParameters !== undefined ? { modelParameters: modelParameters } : {}),
  };
}


// TODO: remove this
export function createDModelConfigurationPrimaryChat(modelId: DLLMId | null, modelParameters?: DModelParameterValues): DModelConfiguration {
  return createDModelConfiguration('primaryChat', modelId, modelParameters);
}
