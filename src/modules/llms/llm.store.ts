import { create } from 'zustand';
import { shallow } from 'zustand/shallow';
import { persist } from 'zustand/middleware';

import { DLLM, DLLMId, DModelSource, DModelSourceId } from './llm.types';


/// ModelsStore - a store for LLMs and their origins
interface ModelsStore {

  llms: DLLM[];
  sources: DModelSource[];

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

      llms: [],
      sources: [],

      // NOTE: make sure to the _source links (sId foreign) are already set before calling this
      // this will replace existing llms with the same id
      addLLMs: (llms: DLLM[]) =>
        set(state => ({
          llms: state.llms.filter(llm => !llms.find(m => m.id === llm.id)).concat(llms),
        })),

      removeLLM: (id: DLLMId) =>
        set(state => ({
          llms: state.llms.filter(llm => llm.id !== id),
        })),

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
        set(state => ({
          llms: state.llms.filter(llm => llm.sId !== id),
          sources: state.sources.filter(source => source.id !== id),
        })),

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


export function useLLMs(): DLLM[] {
  return useModelsStore(state => state.llms, shallow);
}

export function findLLMOrThrow(llmId: DLLMId): DLLM {
  const llm = useModelsStore.getState().llms.find(llm => llm.id === llmId);
  if (!llm) throw new Error(`LLM ${llmId} not found`);
  return llm;
}

export function findOpenAILlmIdOrThrow(llmId: DLLMId): string {
  const { options: { llmId: openAILLMId } } = findLLMOrThrow(llmId);
  if (!openAILLMId) throw new Error(`LLM ${llmId} has no OpenAI LLM`);
  return openAILLMId;
}

export function defaultLLMId(): DLLMId | null {
  const llms = useModelsStore.getState().llms;
  if (llms.length === 0) return null;
  return llms[0].id;
}

export function fasterLLMIdOrThrow(): DLLMId {
  const llms = useModelsStore.getState().llms;
  for (const llm of llms)
    if (llm.id.indexOf('turbo') > 0)
      return llm.id;
  if (llms.length > 0)
    return llms[0].id;
  throw new Error('No faster LLM found');
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
