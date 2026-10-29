import * as React from 'react';

import { shallowEquals } from '~/common/util/hooks/useShallowObject';

import type { DModelDomainId } from '../model.domains.types';
import { DLLMId, getLLMLabel } from '../llms.types';
import { LlmsAssignmentsState, llmsAuto_ModelIdForDomain_SLOW } from '../store-llms-domains_slice';
import { LlmsRootState, llmsStoreActions, llmsStoreState, useModelsStore } from '../store-llms';
import { ModelDomains_MaxFallbackHops, ModelDomainsRegistry } from '../model.domains.registry';
import { createDModelConfiguration, DModelConfiguration } from '../modelconfiguration.types';


export type LlmsAssignmentsInput = Pick<LlmsRootState, 'llms'> & Pick<LlmsAssignmentsState, 'modelAssignments'>;

/** Resolution of a model domain: the effective configuration, and whether it is the user's pin. */
export interface ModelDomainResolution {
  config: undefined | DModelConfiguration; // the stored pin itself, or an Auto configuration created per resolution; undefined when unresolved
  isAuto: boolean;                          // false only when `config` is the stored pin; true for a heuristic hit, a fallback hit, or unresolved
}

// config compared shallowly: a pin is the stored object (same identity across unrelated writes), an Auto configuration is created per resolution
function _sameDomainResolution(a: ModelDomainResolution, b: ModelDomainResolution): boolean {
  return a.isAuto === b.isAuto && shallowEquals(a.config, b.config);
}


/**
 * Immediate configuration resolution for a single domain
 *
 * Storage semantics (modelAssignments[domainId]):
 * - undefined            -> Auto: resolve dynamically via heuristic
 * - { modelId: null }    -> explicit "no model" (rare; kept as-is)
 * - { modelId: '<id>' }  -> pinned (if the id still resolves; otherwise degrades to Auto)
 *
 * `isAuto` is false only when the stored pin is applied (a valid pin, or explicit `modelId: null`);
 * every other outcome - heuristic hit, fallback hit, unresolved - is Auto from this domain's view.
 *
 * The registry's fallback domain is tried (up to ModelDomains_MaxFallbackHops) only when this
 * domain's heuristic returns nothing (no compatible models at all).
 */
function _resolveModelDomain_SLOW(
  modelDomainId: DModelDomainId,
  modelAssignments: LlmsAssignmentsInput['modelAssignments'],
  llms: LlmsAssignmentsInput['llms'],
  hop = 0, // fallback-domain depth: callers omit it, the recursive call passes hop + 1
): ModelDomainResolution {

  // pinned model config: use if LLM still exists, else degrade to Auto (below)
  const storedConfig = modelAssignments?.[modelDomainId];
  if (storedConfig) {
    // explicit 'no model', or pinned-and-still-valid
    if (storedConfig.modelId === null
      || llms.some(llm => llm.id === storedConfig.modelId) // LLM must exist
    )
      return { config: storedConfig, isAuto: false };

    // else: broken pin - degrade to Auto via the heuristic below
  }

  // auto-resolve model (editorial, ELO, etc.)
  const autoLLMId = llmsAuto_ModelIdForDomain_SLOW(modelDomainId, llms);
  if (autoLLMId)
    return { config: createDModelConfiguration(modelDomainId, autoLLMId, undefined), isAuto: true };

  // try the fallback domain (bounded hops) when this domain can't auto-resolve at all; a hit is Auto from this
  // domain's view whatever it is on the fallback domain: the user did not pick it here
  const fallbackDomainId = hop >= ModelDomains_MaxFallbackHops ? undefined : ModelDomainsRegistry[modelDomainId]?.fallbackDomain;
  if (fallbackDomainId) {
    const fallback = _resolveModelDomain_SLOW(fallbackDomainId, modelAssignments, llms, hop + 1);
    if (fallback.config !== undefined)
      return { config: fallback.config, isAuto: true };
  }

  // unresolved: no visible model for this domain and no fallback hit - still Auto, the pin (if any) was not applied
  return { config: undefined, isAuto: true };
}


// per domain: the inputs it was resolved from, and the resolution
const _cachedResolutions = new Map<DModelDomainId, LlmsAssignmentsInput & {
  out: ModelDomainResolution,
}>();


/**
 * Cached resolution, keyed by the identity of `llms` and `modelAssignments` (every store write replaces them;
 * the store never mutates them in place). The output object keeps its identity while its fields are unchanged,
 * so a parameter edit, a changelog append or a service stamp does not re-render subscribers.
 */
export function llmsResolvedModelDomain(modelDomainId: DModelDomainId, modelAssignments: LlmsAssignmentsInput['modelAssignments'], llms: LlmsAssignmentsInput['llms']): ModelDomainResolution {

  // hit: same inputs, same resolution
  const prev = _cachedResolutions.get(modelDomainId);
  if (prev && prev.llms === llms && prev.modelAssignments === modelAssignments)
    return prev.out;

  // miss: resolve
  const next = _resolveModelDomain_SLOW(modelDomainId, modelAssignments, llms);

  // recycle the previous object when equivalent
  const out = prev && _sameDomainResolution(prev.out, next) ? prev.out : next;
  _cachedResolutions.set(modelDomainId, { llms, modelAssignments, out });
  return out;
}


/**
 * Getter for a single domain's resolved model configuration: the stored pin while its model exists, else the
 * Auto pick (with the fallback hop). Served from the cache, e.g. per-message token counts.
 */
export function getDomainModelConfiguration(modelDomainId: DModelDomainId): DModelConfiguration | undefined {
  const { llms, modelAssignments } = llmsStoreState();
  return llmsResolvedModelDomain(modelDomainId, modelAssignments, llms).config;
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

  /** = ModelDomainResolution.config?.modelId, not renamed just for legacy/compatibility reasons */
  domainModelId: undefined | DLLMId | null; // resolved DLLMId: after applying the pin or the Auto heuristic; undefined for zero state, null for explicit no-model
  resolvedModelIsAuto: boolean; // = ModelDomainResolution.isAuto: the stored pin was not applied

  assignDomainModelId: (modelId: DLLMId) => void; // explicit pin only; use assignDomainModelAuto() to reset to Auto
  assignDomainModelAuto: () => void; // reset pinning

} {

  // external state
  const resolved = useModelsStore(({ llms, modelAssignments }) =>
    llmsResolvedModelDomain(modelDomainId, modelAssignments, llms));

  const assignDomainModelId = React.useCallback((modelId: DLLMId) =>
    llmsStoreActions().assignDomainModelId(modelDomainId, modelId), [modelDomainId]);

  const assignDomainModelAuto = React.useCallback(() =>
    llmsStoreActions().assignDomainModelAuto(modelDomainId), [modelDomainId]);

  // stable return (safe in deps and as a prop): changes only with the resolution or the domain
  return React.useMemo(() => ({

    domainModelId: resolved.config?.modelId,
    resolvedModelIsAuto: resolved.isAuto,

    assignDomainModelId,
    assignDomainModelAuto,

  }), [resolved, assignDomainModelId, assignDomainModelAuto]);
}

/**
 * Label of the model Auto would pick for the domain, independent of the pin: the "Auto: <name>" entry of model
 * pickers while pinned. Runs the heuristic on every `llms` change, so mount it only where that entry is shown.
 */
export function useModelDomainAutoModelLabel(modelDomainId: DModelDomainId): string | undefined {
  const llms = useModelsStore(state => state.llms);
  return React.useMemo(() => {
    const autoModelId = llmsAuto_ModelIdForDomain_SLOW(modelDomainId, llms);
    const autoLLM = autoModelId ? llms.find(llm => llm.id === autoModelId) : undefined;
    return autoLLM ? getLLMLabel(autoLLM) : undefined;
  }, [modelDomainId, llms]);
}
