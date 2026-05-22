import * as React from 'react';

import type { DLLMId } from '../llms.types';
import type { DModelDomainId } from '../model.domains.types';
import { LlmsAssignmentsState, llmsAssignmentsAutoModelId } from '../store-llms-domains_slice';
import { LlmsRootState, llmsStoreActions, llmsStoreState, useModelsStore } from '../store-llms';
import { ModelDomainsRegistry } from '../model.domains.registry';
import { createDModelConfiguration, DModelConfiguration } from '../modelconfiguration.types';


/**
 * Resolver: returns both the resolved DModelConfiguration and whether it came from Auto.
 *
 * Storage semantics (modelAssignments[domainId]):
 * - undefined            -> Auto: resolve dynamically via heuristic
 * - { modelId: null }    -> explicit "no model" (rare; kept as-is)
 * - { modelId: '<id>' }  -> pinned (if the id still resolves; otherwise degrades to Auto)
 *
 * `isAuto` is true whenever the returned config was produced by the heuristic (entry absent,
 * or pinned id no longer exists). It is false for explicit pins, including `modelId: null`.
 *
 * The fallback-domain path is used only when this domain's heuristic returns nothing (no
 * compatible models at all). A successful fallback hit is reported as isAuto=true since the
 * user did not pick it on the source domain.
 */
export function llmsResolveDomainModel(
  state: Pick<LlmsRootState, 'llms'> & LlmsAssignmentsState, // store state
  modelDomainId: DModelDomainId,
  verifyLLMExists: boolean,
  autoDomainFallback: boolean,
): { config: undefined | DModelConfiguration, isAuto: boolean } {

  // use the domain directly
  const { llms, modelAssignments } = state;
  const stored = modelAssignments?.[modelDomainId];
  if (stored) {
    // explicit 'no model', or pinned-and-still-valid, or pinned-and-caller-doesn't-care
    if (stored.modelId === null || !verifyLLMExists || llms.find(llm => llm.id === stored.modelId))
      return { config: stored, isAuto: false };

    // else: broken pin - degrade to Auto via the heuristic below
  }

  // auto-resolve in case of absent assingment, or broken pin under verifyLLMExists
  const autoLLMId = llmsAssignmentsAutoModelId(modelDomainId, llms);
  if (autoLLMId)
    return { config: createDModelConfiguration(modelDomainId, autoLLMId, undefined), isAuto: true };

  // try the fallback domain when this domain can't auto-resolve at all
  const fallbackDomain = !autoDomainFallback ? undefined : ModelDomainsRegistry[modelDomainId]?.fallbackDomain;
  if (!fallbackDomain) return { config: undefined, isAuto: false };
  const fb = llmsResolveDomainModel(state, fallbackDomain, verifyLLMExists, false);
  return { config: fb.config, isAuto: fb.config !== undefined };
}


/**
 * Getter for a single domain's resolved model configuration.
 * - `verifyLLMExists`: when true, broken pins are degraded to Auto rather than returned.
 * - `autoDomainFallback`: when true, fall through to the registry's `fallbackDomain`
 */
export function getDomainModelConfiguration(modelDomainId: DModelDomainId, verifyLLMExists: boolean, autoDomainFallback: boolean): DModelConfiguration | undefined {
  const { config /*, isAuto*/ } = llmsResolveDomainModel(llmsStoreState(), modelDomainId, verifyLLMExists, autoDomainFallback);
  return config;
}

/**
 * Non-hook setter for the primary chat model. Use from event handlers / callbacks
 * (e.g. the top bar dropdown, or the right-side chat pane on the `dev` branch)
 * when you want to update the global default that drives the next chat run.
 */
export function setPrimaryChatModelId(modelId: DLLMId): void {
  llmsStoreActions().assignDomainModelId('primaryChat', modelId);
}

/**
 * Reactive single-domain hook that _resolves_ the per-domain LLM configuration.
 *
 * The hook never returns the raw 'Auto' sentinel state to consumers: callers always see:
 * - resolved `domainModelId | null` (if resolution succeeded) or `undefined` (if resolution failed, e.g. in the models zero state)
 *
 */
export function useModelDomain(modelDomainId: DModelDomainId): {

  /** resolved DLLMId, not renamed just for legacy/compatibility reasons */
  domainModelId: undefined | DLLMId | null; // resolved DLLMId: after applying the pin or the Auto heuristic; undefined for zero state, null for explicit no-model
  resolvedModelIsAuto: boolean; // true when `domainModelId` came from the Auto heuristic rather than a user pin (missing entry or broken pin)

  assignDomainModelId: (modelId: DLLMId) => void; // explicit pin only; use assignDomainModelAuto() to reset to Auto
  assignDomainModelAuto: () => void; // reset pinning

} {

  // external state
  const { llms, modelAssignments } = useModelsStore(); // no selector because that's all the state we have

  // memo the resolution logic, by state
  const resolved = React.useMemo(() => {
    return llmsResolveDomainModel({ llms, modelAssignments }, modelDomainId, true, false);
  }, [llms, modelAssignments, modelDomainId]);


  const assignDomainModelId = React.useCallback((modelId: DLLMId) =>
    llmsStoreActions().assignDomainModelId(modelDomainId, modelId), [modelDomainId]);

  const assignDomainModelAuto = React.useCallback(() =>
    llmsStoreActions().assignDomainModelAuto(modelDomainId), [modelDomainId]);

  return {

    domainModelId: resolved.config?.modelId,
    resolvedModelIsAuto: resolved.isAuto,

    assignDomainModelId,
    assignDomainModelAuto,

  };
}
