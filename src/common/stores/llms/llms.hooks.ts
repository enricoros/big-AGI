import { useShallow } from 'zustand/react/shallow';

import type { DLLM, DLLMId } from './llms.types';

import { useModelsStore } from './store-llms';


/**
 * Current 'Chat' LLM, or null
 */
export function useChatLLM(): { chatLLM: DLLM | null } {
  const chatLLM = useModelsStore(state => state.chatLLMId ? state.llms.find(llm => llm.id === state.chatLLMId) ?? null : null);
  return { chatLLM };
}

export function useLLM(llmId: DLLMId): DLLM | null {
  return useModelsStore(state => state.llms.find(llm => llm.id === llmId) ?? null);
}

export function useDefaultLLMIDs(): { chatLLMId: DLLMId | null; fastLLMId: DLLMId | null; } {
  return useModelsStore(useShallow(state => ({
    chatLLMId: state.chatLLMId,
    fastLLMId: state.fastLLMId,
  })));
}

export function useDefaultLLMs(): { chatLLM: DLLM | null; fastLLM: DLLM | null } {
  return useModelsStore(useShallow(state => {
    const { chatLLMId, fastLLMId } = state;
    const chatLLM = chatLLMId ? state.llms.find(llm => llm.id === chatLLMId) ?? null : null;
    const fastLLM = fastLLMId ? state.llms.find(llm => llm.id === fastLLMId) ?? null : null;
    return { chatLLM, fastLLM };
  }));
}

export function useFilteredLLMs(filterId: false | DLLMId): DLLM[] {
  return useModelsStore(useShallow(
    state => !filterId ? state.llms : state.llms.filter(llm => llm.sId === filterId),
  ));
}

export function useNonHiddenLLMs(): DLLM[] {
  return useModelsStore(useShallow(
    ({ llms, chatLLMId }) => llms.filter(llm => !llm.hidden || (chatLLMId && llm.id === chatLLMId)),
  ));
}

export function useLLMsCount(): number {
  return useModelsStore(state => state.llms.length);
}

export function useHasLLMs(): boolean {
  return useModelsStore(state => !!state.llms.length);
}

export function useModelsServices() {
  return useModelsStore(state => state.sources);
}