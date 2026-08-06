import type { Immutable } from '~/common/types/immutable.types';

import type { DLLMId } from './llms.types';
import type { DModelDomainId } from './model.domains.types';
import { DModelParameterValues, duplicateDModelParameterValues } from './llms.parameters';


/**
 * This is used for Global models, as well as Per-Persona (or in the future per-project even) models.
 */
export type DModelConfiguration = {
  mct: 'model-parametric';

  // simpler version of a search space
  domainId: DModelDomainId;

  // configuration of the model and its parameters
  modelId: DLLMId | null; // null: "I don't want to use any model for this domain", which is different than an unconfigured domain, which can still have a 'fallback'

  /**
   * DModelConfiguration Parameter semantics: applied in order (last wins): Global, Per-Persona, Per-Chat, Per-Operation, etc.
   * When applied, they fully replace the `llm.userParameters` that came before; as such:
   * - `undefined` does nothing, i.e. the DModelConfiguration does nothing to the parameters
   * - `{}` resets everything that was applied before, as it's a full override with no values
   * - `{ param1: value1 }` sets `param1` to `value1`, and resets everything else that was applied before
   *
   * This only applies to DModelConfiguration semantics, as the underlying DModelParameterValues can have other semantics elsewhere.
   */
  modelParameters?: DModelParameterValues;
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


/// helpers - duplication

export function duplicateDModelConfiguration(config: Immutable<DModelConfiguration>): DModelConfiguration {
  return {
    mct: config.mct,
    domainId: config.domainId,
    modelId: config.modelId,
    ...(config.modelParameters !== undefined ? { modelParameters: duplicateDModelParameterValues(config.modelParameters) } : {}),
  };
}