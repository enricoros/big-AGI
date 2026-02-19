import * as React from 'react';

import { useShallow } from 'zustand/react/shallow';

import type { DLLMId } from '../llms.types';
import type { DModelQuickKeySlot } from '../store-llms-domains_slice';
import { useModelsStore } from '../store-llms';


/**
 * Returns the quick key assignments (slot -> llmId) and a reverse map (llmId -> slot).
 */
export function useModelQuickKeys(): {
  quickKeys: Partial<Record<DModelQuickKeySlot, DLLMId>>;
  quickKeysByLlmId: ReadonlyMap<DLLMId, DModelQuickKeySlot>;
} {
  const quickKeys = useModelsStore(useShallow(state => state.modelQuickKeys));

  const quickKeysByLlmId = React.useMemo(() => {
    const map = new Map<DLLMId, DModelQuickKeySlot>();
    for (const [slot, llmId] of Object.entries(quickKeys) as [DModelQuickKeySlot, DLLMId][])
      if (llmId)
        map.set(llmId, slot);
    return map;
  }, [quickKeys]);

  return { quickKeys, quickKeysByLlmId };
}


/**
 * Returns the llmId for a given quick key slot, or undefined if not assigned.
 */
export function getModelQuickKeyLlmId(slot: DModelQuickKeySlot): DLLMId | undefined {
  return useModelsStore.getState().modelQuickKeys[slot];
}
