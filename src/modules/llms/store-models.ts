import { create } from 'zustand';
import { shallow } from 'zustand/shallow';
import { persist } from 'zustand/middleware';

import { ModelVendorId } from './vendors-registry';


/**
 * Model - a LLM with certain capabilities, referenced by ID, and with a link to the source
 */
export interface DLLM {
  uid: DLLMId; // unique, saved in chats
  _sourceId: DModelSourceId;
  _sourceModelId: string;
  label: string;

  // capabilities
  contextWindowSize: number;
  canStream: boolean;
  canChat: boolean;

  // optional
  description?: string;
  tradeoff?: string;
  created?: number;
}

type DLLMId = string;

/**
 * ModelSource - a source of models, e.g. a vendor
 *
 * Has all the parameters for accessing a list of models, and to call generation functions
 */
export interface DModelSource {
  sourceId: DModelSourceId;
  label: string;
  vendorId: ModelVendorId;

  // vendor-specific data
  _config?: any;
  configured: boolean;
}

export type DModelSourceId = string;


interface ModelsStore {
  // Models
  llms: DLLM[];
  addLLMs: (models: DLLM[]) => void;
  removeLLM: (uid: DLLMId) => void;

  // Sources
  sources: DModelSource[];
  addSource: (source: DModelSource) => void;
  removeSource: (sourceId: DModelSourceId) => void;
  updateSourceConfig: <T>(sourceId: DModelSourceId, config: Partial<T>) => void;
}

export const useModelsStore = create<ModelsStore>()(
  persist(
    (set) => ({

      llms: [],

      addLLMs: (models: DLLM[]) =>
        set(state => ({
          // remove existing models with the same uid
          llms: state.llms.filter(model => !models.find((m) => m.uid === model.uid)).concat(models),
        })),

      removeLLM: (uid: DLLMId) =>
        set((state) => ({ llms: state.llms.filter((model) => model.uid !== uid) })),


      sources: [],

      addSource: (source: DModelSource) =>
        set(state => ({ sources: [...state.sources, source] })),

      removeSource: (sourceId: DModelSourceId) =>
        set(state => ({
          sources: state.sources.filter((source) => source.sourceId !== sourceId),
          llms: state.llms.filter((model) => model._sourceId !== sourceId),
        })),

      updateSourceConfig: <T>(sourceId: DModelSourceId, config: Partial<T>) =>
        set(state => ({
          sources: state.sources.map((source: DModelSource): DModelSource =>
            source.sourceId === sourceId
              ? {
                ...source,
                _config: { ...source._config, ...config },
              } : source,
          ),
        })),

    }),
    {
      name: 'app-models',
    }),
);


/**
 * Hook used by the UIs to configure their own specific model source
 */
export function useSourceConfigurator<T>(sourceId: DModelSourceId, normalizeDefaults: (config?: Partial<T>) => T): { config: T; update: (entry: Partial<T>) => void } {
  // finds the source, and returns its normalized config
  const { config, updateSourceConfig } = useModelsStore(state => {
    const modelSource = state.sources.find((s) => s.sourceId === sourceId);
    return {
      config: normalizeDefaults(modelSource?._config as Partial<T>),
      updateSourceConfig: state.updateSourceConfig,
    };
  }, shallow);

  // prepares a function to update the source config
  const update = (entry: Partial<T>) => updateSourceConfig<T>(sourceId, entry);
  return { config, update };
}


/**
 * Joined list of models
 */
export function useJoinedLLMs(): { model: DLLM, sourceLabel: string, vendorId: ModelVendorId | null }[] {
  const llms = useModelsStore(state => state.llms);
  return llms.map((model) => {
    const source = useModelsStore.getState().sources.find((s) => s.sourceId === model._sourceId);
    return {
      model: model,
      sourceLabel: source?.label ?? 'Unknown',
      vendorId: source?.vendorId ?? null,
    };
  });
}
