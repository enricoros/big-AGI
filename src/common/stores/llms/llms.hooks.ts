import { useShallow } from 'zustand/react/shallow';

import { DLLM, DLLMId, isLLMVisible } from './llms.types';
import type { DModelsServiceId } from './llms.service.types';
import { useModelsStore } from './store-llms';


export function useLLM(llmId: undefined | DLLMId | null): DLLM | undefined {
  return useModelsStore(state => !llmId ? undefined : state.llms.find(llm => llm.id === llmId));
}

export function useLLMs(llmIds: ReadonlyArray<DLLMId>): ReadonlyArray<DLLM | undefined> {
  return useModelsStore(useShallow(state => {
    return llmIds.map(llmId => !llmId ? undefined : state.llms.find(llm => llm.id === llmId));
  }));
}

function _sortStarredFirstComparator(a: { userStarred?: boolean }, b: { userStarred?: boolean }) {
  if (a.userStarred && !b.userStarred) return -1;
  if (!a.userStarred && b.userStarred) return 1;
  return 0;
}

export function useLLMsByService(serviceId: false | DModelsServiceId): DLLM[] {
  return useModelsStore(useShallow(
    state => !serviceId ? state.llms : state.llms.filter(llm => llm.sId === serviceId),
  ));
}

export function useVisibleLLMs(includeLlmId: undefined | DLLMId | null, starredOnly: boolean, starredFirst: boolean): { llms: ReadonlyArray<DLLM>; hasStarred: boolean } {
  // for performance, we don't include this in the memo selector, as they'll change in tandem anyway
  let hasStarred = false;

  const llms = useModelsStore(useShallow(({ llms }) => {
    // filter by visibility and starred status
    const filtered = llms.filter((llm) => {
      // finds out if any starred LLM exists
      if (llm.userStarred) hasStarred = true;

      // always include the specified LLM ID if provided
      if (includeLlmId && llm.id === includeLlmId) return true;

      // visibility filter
      return isLLMVisible(llm) && (!starredOnly || llm.userStarred);
    });

    // sort starred first if requested
    return !starredFirst ? filtered : filtered.sort(_sortStarredFirstComparator);
  }));

  return { llms, hasStarred };
}

export function useHasLLMs(): boolean {
  return useModelsStore(state => !!state.llms.length);
}

export function useModelsServices() {
  return useModelsStore(useShallow(state => ({
    modelsServices: state.sources,
    confServiceId: state.confServiceId,
    setConfServiceId: state.setConfServiceId,
  })));
}