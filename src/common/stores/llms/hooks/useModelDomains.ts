import * as React from 'react';

import type { DLLMId } from '../llms.types';
import type { DModelDomainId } from '../model.domains.types';
import { ModelDomainsList } from '../model.domains.registry';
import { llmsResolveDomainModel } from './useModelDomain';
import { useModelsStore } from '../store-llms';


/**
 * All current model domains, with pinned and resolved model IDs. Reactive to changes in the store.
 *
 * Entry shape (inlined; consumers can use `ReturnType<typeof useModelDomains>[DModelDomainId]` if needed):
 * - `pinnedModelId`: what the user stored - undefined for Auto, null for no-model, '<id>' for pinned (kept even when stale).
 * - `resolvedModelId`: currently-effective id - undefined for zero state, null for no-model, '<id>' for a valid set or auto-resolved model.
 * - `resolvedModelIsAuto`: true when `resolvedModelId` came from the Auto heuristic rather than a user pin (missing entries and broken pins).
 */
export function useModelDomains(): Record<DModelDomainId, {
  pinnedModelId: undefined | (DLLMId | null);
  resolvedModelId: undefined | (DLLMId | null);
  resolvedModelIsAuto: boolean;
}> {
  const { llms, modelAssignments } = useModelsStore();

  return React.useMemo(() => {
    const out = {} as Record<DModelDomainId, { pinnedModelId: undefined | (DLLMId | null); resolvedModelId: undefined | (DLLMId | null); resolvedModelIsAuto: boolean }>;
    for (const domainId of ModelDomainsList) {
      const resolved = llmsResolveDomainModel({ llms, modelAssignments }, domainId, true, false);
      out[domainId] = {
        pinnedModelId: modelAssignments[domainId]?.modelId, // raw stored: undefined if absent, null for no-model, '<id>' for pin (even if stale)
        resolvedModelId: resolved.config?.modelId,
        resolvedModelIsAuto: resolved.isAuto,
      };
    }
    return out;
  }, [llms, modelAssignments]);
}
