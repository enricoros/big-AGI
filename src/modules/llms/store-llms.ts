import { create } from 'zustand';
import { shallow } from 'zustand/shallow';
import { persist } from 'zustand/middleware';

import { ModelVendorId } from './vendors/IModelVendor';


/**
 * Large Language Model - description and configuration (data object, stored)
 */
export interface DLLM<TSourceSetup = unknown, TLLMOptions = unknown> {
  id: DLLMId;
  label: string;
  created: number | 0;
  updated?: number | 0;
  description: string;
  tags: string[]; // UNUSED for now
  contextTokens: number;
  maxOutputTokens: number;
  hidden: boolean;

  // llm -> source
  sId: DModelSourceId;
  _source: DModelSource<TSourceSetup>;

  // llm-specific
  options: { llmRef: string } & Partial<TLLMOptions>;
}

export type DLLMId = string;

// Model interfaces (chat, and function calls) - here as a preview, will be used more broadly in the future
export const LLM_IF_OAI_Chat = 'oai-chat';
export const LLM_IF_OAI_Vision = 'oai-vision';
export const LLM_IF_OAI_Fn = 'oai-fn';
export const LLM_IF_OAI_Complete = 'oai-complete';


/**
 * Model Server - configured to be a unique origin of models (data object, stored)
 */
export interface DModelSource<TSourceSetup = unknown> {
  id: DModelSourceId;
  label: string;

  // source -> vendor
  vId: ModelVendorId;

  // source-specific
  setup: Partial<TSourceSetup>;
}

export type DModelSourceId = string;


/// ModelsStore - a store for configured LLMs and configured Sources

interface ModelsData {
  llms: DLLM[];
  sources: DModelSource[];
  chatLLMId: DLLMId | null;
  fastLLMId: DLLMId | null;
  funcLLMId: DLLMId | null;
}

interface ModelsActions {
  setLLMs: (llms: DLLM[], sourceId: DModelSourceId, preserveExpired?: boolean) => void;
  removeLLM: (id: DLLMId) => void;
  updateLLM: (id: DLLMId, partial: Partial<DLLM>) => void;
  updateLLMOptions: <TLLMOptions>(id: DLLMId, partialOptions: Partial<TLLMOptions>) => void;

  addSource: (source: DModelSource) => void;
  removeSource: (id: DModelSourceId) => void;
  updateSourceSetup: <TSourceSetup>(id: DModelSourceId, partialSetup: Partial<TSourceSetup>) => void;

  setChatLLMId: (id: DLLMId | null) => void;
  setFastLLMId: (id: DLLMId | null) => void;
  setFuncLLMId: (id: DLLMId | null) => void;
}

type LlmsStore = ModelsData & ModelsActions;

export const useModelsStore = create<LlmsStore>()(
  persist(
    (set) => ({

      llms: [],
      sources: [],
      chatLLMId: null,
      fastLLMId: null,
      funcLLMId: null,

      setChatLLMId: (id: DLLMId | null) =>
        set(state => updateSelectedIds(state.llms, id, state.fastLLMId, state.funcLLMId)),

      setFastLLMId: (id: DLLMId | null) =>
        set(state => updateSelectedIds(state.llms, state.chatLLMId, id, state.funcLLMId)),

      setFuncLLMId: (id: DLLMId | null) =>
        set(state => updateSelectedIds(state.llms, state.chatLLMId, state.fastLLMId, id)),

      // NOTE: make sure to the _source links (sId foreign) are already set before calling this
      setLLMs: (llms: DLLM[], sourceId: DModelSourceId, preserveExpired?: boolean) =>
        set(state => {

          const otherLlms = preserveExpired === true
            ? state.llms
            : state.llms.filter(llm => llm.sId !== sourceId);

          // replace existing llms with the same id
          const newLlms = [...llms, ...otherLlms.filter(llm => !llms.find(m => m.id === llm.id))];
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

      updateLLMOptions: <TLLMOptions>(id: DLLMId, partialOptions: Partial<TLLMOptions>) =>
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

      updateSourceSetup: <TSourceSetup>(id: DModelSourceId, partialSetup: Partial<TSourceSetup>) =>
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

      /* versioning:
       *  1: adds maxOutputTokens (default to half of contextTokens)
       */
      version: 1,
      migrate: (state: any, fromVersion: number): LlmsStore => {

        // 0 -> 1: add 'maxOutputTokens' where missing,
        if (state && fromVersion === 0)
          for (const llm of state.llms)
            if (!llm.maxOutputTokens)
              llm.maxOutputTokens = Math.round((llm.contextTokens || 4096) / 2);

        return state;
      },

      // Pre-saving: omit the memory references from the persisted state
      partialize: (state) => ({
        ...state,
        llms: state.llms.map(llm => {
          const { _source, ...rest } = llm;
          return rest;
        }),
      }),

      // Post-loading: re-link the memory references on rehydration
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


const defaultChatSuffixPreference = ['gpt-4-1106-preview', 'gpt-4-0613', 'gpt-4', 'gpt-4-32k', 'gpt-3.5-turbo'];
const defaultFastSuffixPreference = ['gpt-3.5-turbo-1106', 'gpt-3.5-turbo-16k-0613', 'gpt-3.5-turbo-0613', 'gpt-3.5-turbo-16k', 'gpt-3.5-turbo'];
const defaultFuncSuffixPreference = ['gpt-4-1106-preview', 'gpt-3.5-turbo-16k-0613', 'gpt-3.5-turbo-0613', 'gpt-4-0613'];

export function findLLMOrThrow<TSourceSetup, TLLMOptions>(llmId: DLLMId): DLLM<TSourceSetup, TLLMOptions> {
  const llm = useModelsStore.getState().llms.find(llm => llm.id === llmId);
  if (!llm) throw new Error(`LLM ${llmId} not found`);
  if (!llm._source) throw new Error(`LLM ${llmId} has no source`);
  return llm as DLLM<TSourceSetup, TLLMOptions>;
}

function findLlmIdBySuffix(llms: DLLM[], suffixes: string[], fallbackToFirst: boolean): DLLMId | null {
  if (!llms?.length) return null;
  for (const suffix of suffixes)
    for (const llm of llms)
      if (llm.id.endsWith(suffix))
        return llm.id;
  // otherwise return first id
  return fallbackToFirst ? llms[0].id : null;
}

function updateSelectedIds(allLlms: DLLM[], chatLlmId: DLLMId | null, fastLlmId: DLLMId | null, funcLlmId: DLLMId | null): Partial<ModelsData> {
  if (chatLlmId && !allLlms.find(llm => llm.id === chatLlmId)) chatLlmId = null;
  if (!chatLlmId) chatLlmId = findLlmIdBySuffix(allLlms, defaultChatSuffixPreference, true);

  if (fastLlmId && !allLlms.find(llm => llm.id === fastLlmId)) fastLlmId = null;
  if (!fastLlmId) fastLlmId = findLlmIdBySuffix(allLlms, defaultFastSuffixPreference, true);

  if (funcLlmId && !allLlms.find(llm => llm.id === funcLlmId)) funcLlmId = null;
  if (!funcLlmId) funcLlmId = findLlmIdBySuffix(allLlms, defaultFuncSuffixPreference, false);

  return { chatLLMId: chatLlmId, fastLLMId: fastLlmId, funcLLMId: funcLlmId };
}

/**
 * Current 'Chat' LLM, or null
 */
export function useChatLLM() {
  return useModelsStore(state => {
    const { chatLLMId } = state;
    const chatLLM = chatLLMId ? state.llms.find(llm => llm.id === chatLLMId) ?? null : null;
    return { chatLLMId, chatLLM };
  }, shallow);
}

/**
 * Source-specific read/write - great time saver
 */
export function useSourceSetup<TSourceSetup, TAccess>(sourceId: DModelSourceId, getAccess: (partialSetup?: Partial<TSourceSetup>) => TAccess) {
  // invalidate when the setup changes
  const { updateSourceSetup, ...rest } = useModelsStore(state => {
    const source: DModelSource<TSourceSetup> | null = state.sources.find(source => source.id === sourceId) ?? null;
    const sourceLLMs = source ? state.llms.filter(llm => llm._source === source) : [];
    return {
      source,
      sourceLLMs,
      sourceHasLLMs: !!sourceLLMs.length,
      access: getAccess(source?.setup),
      updateSourceSetup: state.updateSourceSetup,
    };
  }, shallow);

  // convenience function for this source
  const updateSetup = (partialSetup: Partial<TSourceSetup>) => updateSourceSetup<TSourceSetup>(sourceId, partialSetup);
  return { ...rest, updateSetup };
}