import type { DModelDomainId } from '../model.domains.types';
import { LlmsAssignmentsInput, llmsResolvedModelDomain, ModelDomainResolution } from './useModelDomain';
import { ModelDomainsList } from '../model.domains.registry';
import { useModelsStore } from '../store-llms';


// cache
let _cached: undefined | (LlmsAssignmentsInput & {
  out: Record<DModelDomainId, ModelDomainResolution>,
});

function _llmsResolvedModelDomains(state: LlmsAssignmentsInput) {

  // hit: same inputs, same record
  const { llms, modelAssignments } = state;
  if (_cached && _cached.llms === llms && _cached.modelAssignments === modelAssignments)
    return _cached.out;

  // miss: collect the per-domain resolutions, recycling the previous record when every domain kept its identity
  const prev = _cached?.out;
  const next = {} as Record<DModelDomainId, ModelDomainResolution>;
  let changed = false;
  for (const domainId of ModelDomainsList) {
    next[domainId] = llmsResolvedModelDomain(domainId, modelAssignments, llms);
    if (next[domainId] !== prev?.[domainId])
      changed = true;
  }
  _cached = { llms, modelAssignments, out: prev && !changed ? prev : next };
  return _cached.out;
}


/**
 * All current model domains, each the cached resolution of llmsResolvedModelDomain. Reactive to changes in the store.
 */
export function useModelDomains(): Record<DModelDomainId, ModelDomainResolution> {
  return useModelsStore(_llmsResolvedModelDomains);
}
