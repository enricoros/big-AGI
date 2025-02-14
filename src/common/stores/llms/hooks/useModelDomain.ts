import * as React from 'react';

import type { DLLMId } from '../llms.types';
import type { DModelConfiguration } from '../modelconfiguration.types';
import type { DModelDomainId } from '../model.domains.types';
import type { LlmsAssignmentsState } from '../store-llms-domains_slice';
import { LlmsRootState, useModelsStore } from '../store-llms';
import { ModelDomainsRegistry } from '../model.domains.registry';


/**
 * Getter for a single domain model configuration.
 * - Can optionally verify that the LLM exists.
 * - Can optionally use a fallback domain.
 */
export function getDomainModelConfiguration(modelDomainId: DModelDomainId, verifyLLMExists: boolean, autoDomainFallback: boolean): DModelConfiguration | undefined {
  return _getDomainModelConfigurationFromState(useModelsStore.getState(), modelDomainId, verifyLLMExists, autoDomainFallback);
}

function _getDomainModelConfigurationFromState({ llms, modelAssignments }: LlmsRootState & LlmsAssignmentsState, modelDomainId: DModelDomainId, verifyLLMExists: boolean, autoDomainFallback: boolean): DModelConfiguration | undefined {
  const modelConfiguration = modelAssignments?.[modelDomainId] ?? undefined;
  if (modelConfiguration) {
    if (!verifyLLMExists)
      return modelConfiguration;
    if (llms.find(llm => llm.id === modelConfiguration.modelId))
      return modelConfiguration;
  }

  // Try fallback domain
  if (!autoDomainFallback)
    return undefined;
  const fallbackDomain = ModelDomainsRegistry[modelDomainId]?.fallbackDomain ?? undefined;
  if (!fallbackDomain)
    return undefined;
  const fallbackModelConfiguration = modelAssignments?.[fallbackDomain] ?? undefined;
  if (fallbackModelConfiguration) {
    if (!verifyLLMExists)
      return fallbackModelConfiguration;
    if (llms.find(llm => llm.id === fallbackModelConfiguration.modelId))
      return fallbackModelConfiguration;
  }

  // couldn't find or verify domain or fallback domain
  return undefined;
}


/**
 * Single hooks to access per-domain LLM configurations.
 * - Since this is reactive, we assume we don't do 'automated domain fallback' here
 * - We also verify mandatory LLM existence
 */
export function useModelDomain(modelDomainId: DModelDomainId): {

  domainModelId: undefined | DLLMId | null;
  assignDomainModelId: (modelId: DLLMId | null) => void;

  domainModelConfiguration: DModelConfiguration | undefined;
  assignDomainModelConfiguration: (config: DModelConfiguration) => void;

} {

  const domainModelConfiguration = useModelsStore(state =>
    _getDomainModelConfigurationFromState(state, modelDomainId, true, false),
  );

  const assignDomainModelConfiguration = React.useCallback((modelConfiguration: DModelConfiguration) =>
    useModelsStore.getState().assignDomainModelConfiguration(modelConfiguration), []);

  const assignDomainModelId = React.useCallback((modelId: DLLMId | null) =>
    useModelsStore.getState().assignDomainModelId(modelDomainId, modelId), [modelDomainId]);

  return {

    // simple
    domainModelId: domainModelConfiguration?.modelId,
    assignDomainModelId,

    // full
    domainModelConfiguration,
    assignDomainModelConfiguration,

  };
}
