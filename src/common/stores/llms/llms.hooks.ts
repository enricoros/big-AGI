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

export function useLLMsByService(serviceId: false | DModelsServiceId): DLLM[] {
  return useModelsStore(useShallow(
    state => !serviceId ? state.llms : state.llms.filter(llm => llm.sId === serviceId),
  ));
}

export function useVisibleLLMs(includeLlmId: undefined | DLLMId | null): ReadonlyArray<DLLM> {
  return useModelsStore(useShallow(
    ({ llms }) => llms.filter(llm => isLLMVisible(llm) || (includeLlmId && llm.id === includeLlmId)),
  ));
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