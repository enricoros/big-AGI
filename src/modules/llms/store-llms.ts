import { create } from 'zustand';
import { shallow } from 'zustand/shallow';
import { persist } from 'zustand/middleware';

import { DLLM, DLLMId, DModelSource, DModelSourceId } from './llm.types';


/// ModelsStore - a store for LLMs and their origins
interface ModelsStore {

  chatLLMId: DLLMId | null;
  fastLLMId: DLLMId | null;
  funcLLMId: DLLMId | null;
  llms: DLLM[];
  sources: DModelSource[];

  setChatLLMId: (id: DLLMId | null) => void;
  setFastLLMId: (id: DLLMId | null) => void;
  setFuncLLMId: (id: DLLMId | null) => void;

  addLLMs: (llms: DLLM[]) => void;
  removeLLM: (id: DLLMId) => void;
  updateLLM: (id: DLLMId, partial: Partial<DLLM>) => void;
  updateLLMOptions: <T>(id: DLLMId, partialOptions: Partial<T>) => void;

  addSource: (source: DModelSource) => void;
  removeSource: (id: DModelSourceId) => void;
  updateSourceSetup: <T>(id: DModelSourceId, partialSetup: Partial<T>) => void;

}


export const useModelsStore = create<ModelsStore>()(
  persist(
    (set) => ({

      chatLLMId: null,
      fastLLMId: null,
      funcLLMId: null,
      llms: [],
      sources: [],

      setChatLLMId: (id: DLLMId | null) =>
        set(state => updateSelectedIds(state.llms, id, state.fastLLMId, state.funcLLMId)),

      setFastLLMId: (id: DLLMId | null) =>
        set(state => updateSelectedIds(state.llms, state.chatLLMId, id, state.funcLLMId)),

      setFuncLLMId: (id: DLLMId | null) =>
        set(state => updateSelectedIds(state.llms, state.chatLLMId, state.fastLLMId, id)),

      // NOTE: make sure to the _source links (sId foreign) are already set before calling this
      // this will replace existing llms with the same id
      addLLMs: (llms: DLLM[]) =>
        set(state => {
          const newLlms = [...llms, ...state.llms.filter(llm => !llms.find(m => m.id === llm.id))];
          return {
            llms: newLlms,
            ...updateSelectedIds(newLlms, state.chatLLMId, state.fastLLMId, state.funcLLMId),
          };
        }),

      removeLLM: (id: DLLMId) =>
        set(state => {
          const newLlms = state.llms.filter(llm => llm.id !== id);
          return {
            llms: newLlms,
            ...updateSelectedIds(newLlms, state.chatLLMId, state.fastLLMId, state.funcLLMId),
          };
        }),

      updateLLM: (id: DLLMId, partial: Partial<DLLM>) =>
        set(state => ({
          llms: state.llms.map((llm: DLLM): DLLM =>
            llm.id === id
              ? { ...llm, ...partial }
              : llm,
          ),
        })),

      updateLLMOptions: <T>(id: DLLMId, partialOptions: Partial<T>) =>
        set(state => ({
          llms: state.llms.map((llm: DLLM): DLLM =>
            llm.id === id
              ? { ...llm, options: { ...llm.options, ...partialOptions } }
              : llm,
          ),
        })),


      addSource: (source: DModelSource) =>
        set(state => ({
          sources: [...state.sources, source],
        })),

      removeSource: (id: DModelSourceId) =>
        set(state => {
          const llms = state.llms.filter(llm => llm.sId !== id);
          return {
            llms,
            sources: state.sources.filter(source => source.id !== id),
            ...updateSelectedIds(llms, state.chatLLMId, state.fastLLMId, state.funcLLMId),
          };
        }),

      updateSourceSetup: <T>(id: DModelSourceId, partialSetup: Partial<T>) =>
        set(state => ({
          sources: state.sources.map((source: DModelSource): DModelSource =>
            source.id === id
              ? {
                ...source,
                setup: { ...source.setup, ...partialSetup },
              } : source,
          ),
        })),

    }),
    {
      name: 'app-models',

      // omit the memory references from the persisted state
      partialize: (state) => ({
        ...state,
        llms: state.llms.map(llm => {
          const { _source, ...rest } = llm;
          return rest;
        }),
      }),

      // re-link the memory references on rehydration
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        state.llms = state.llms.map(llm => {
          const source = state.sources.find(source => source.id === llm.sId);
          if (!source) return null;
          return { ...llm, _source: source };
        }).filter(llm => !!llm) as DLLM[];
      },
    }),
);


const defaultChatSuffixPreference = ['gpt-4-0613', 'gpt-4', 'gpt-4-32k', 'gpt-3.5-turbo'];
const defaultFastSuffixPreference = ['gpt-3.5-turbo-0613', 'gpt-3.5-turbo-16k-0613', 'gpt-3.5-turbo-16k', 'gpt-3.5-turbo'];
const defaultFuncSuffixPreference = ['gpt-3.5-turbo-0613', 'gpt-4-0613'];

function findLlmIdBySuffix(llms: DLLM[], suffixes: string[], fallbackToFirst: boolean): DLLMId | null {
  if (!llms?.length) return null;
  for (const suffix of suffixes)
    for (const llm of llms)
      if (llm.id.endsWith(suffix))
        return llm.id;
  // otherwise return first id
  return fallbackToFirst ? llms[0].id : null;
}

function updateSelectedIds(allLlms: DLLM[], chatLlmId: DLLMId | null, fastLlmId: DLLMId | null, funcLlmId: DLLMId | null): Partial<ModelsStore> {
  if (chatLlmId && !allLlms.find(llm => llm.id === chatLlmId)) chatLlmId = null;
  if (!chatLlmId) chatLlmId = findLlmIdBySuffix(allLlms, defaultChatSuffixPreference, true);

  if (fastLlmId && !allLlms.find(llm => llm.id === fastLlmId)) fastLlmId = null;
  if (!fastLlmId) fastLlmId = findLlmIdBySuffix(allLlms, defaultFastSuffixPreference, true);

  if (funcLlmId && !allLlms.find(llm => llm.id === funcLlmId)) funcLlmId = null;
  if (!funcLlmId) funcLlmId = findLlmIdBySuffix(allLlms, defaultFuncSuffixPreference, false);

  return { chatLLMId: chatLlmId, fastLLMId: fastLlmId, funcLLMId: funcLlmId };
}


export function useChatLLM() {
  return useModelsStore(state => {
    const { chatLLMId } = state;
    const chatLLM = chatLLMId ? state.llms.find(llm => llm.id === chatLLMId) ?? null : null;
    return {
      chatLLMId,
      chatLLM,
    };
  }, shallow);
}


/**
 * Hook used for Source-specific setup
 */
export function useSourceSetup<T>(sourceId: DModelSourceId, normalizer: (partialSetup?: Partial<T>) => T) {
  // invalidate when the setup changes
  const { updateSourceSetup, ...rest } = useModelsStore(state => {
    const source = state.sources.find(source => source.id === sourceId) ?? null;
    return {
      source,
      sourceLLMs: source ? state.llms.filter(llm => llm._source === source) : [],
      normSetup: normalizer(source?.setup as Partial<T> | undefined),
      updateSourceSetup: state.updateSourceSetup,
    };
  }, shallow);

  // convenience function for this source
  const updateSetup = (partialSetup: Partial<T>) => updateSourceSetup<T>(sourceId, partialSetup);
  return { ...rest, updateSetup };
}
