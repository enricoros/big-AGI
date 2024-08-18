import type { DLLM } from './llms.types';

import { useModelsStore } from './store-llms';


/**
 * Current 'Chat' LLM, or null
 */
export function useChatLLM(): { chatLLM: DLLM | null } {
  const chatLLM = useModelsStore(state => state.chatLLMId ? state.llms.find(llm => llm.id === state.chatLLMId) ?? null : null);
  return { chatLLM };
}

export function useModelsServices() {
  return useModelsStore(state => state.sources);
}