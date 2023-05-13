import { create } from 'zustand';
import { shallow } from 'zustand/shallow';
import { devtools, persist } from 'zustand/middleware';

import { ModelVendorId } from './vendors-registry';


/**
 * Model - a LLM with certain capabilities, referenced by ID, and with a link to the source
 */
export interface DLLM {
  modelId: DModelId; // unique
  sourceId: DModelSourceId;

  // metadata
  label: string;
  // name: string;
  description: string;
  tradeoff: string;
  speed: 'slow' | 'medium' | 'fast';

  // capabilities
  contextWindowSize: number;
  canStream: boolean;
  canChat: boolean;

  // state attributes?
  // - current state
  // - history
  // - etc.
}

type DModelId = string;

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

  // Sources
  sources: DModelSource[];
  addSource: (source: DModelSource) => void;
  removeSource: (sourceId: DModelSourceId) => void;
  updateSourceConfig: <T>(sourceId: DModelSourceId, config: Partial<T>) => void;

  // fetchModels: (sourceId: DModelSourceId) => Promise<DLLM[]>;

  // Models
  models: DLLM[];
  addModel: (model: DLLM) => void;
  removeModel: (modelId: string) => void;

}

export const useModelsStore = create<ModelsStore>()(devtools(
  persist(
    (set, get) => ({

      sources: [],

      addSource: (source: DModelSource) =>
        set(state => ({ sources: [...state.sources, source] })),

      removeSource: (sourceId: DModelSourceId) =>
        set(state => ({
          sources: state.sources.filter((source) => source.sourceId !== sourceId),
          models: state.models.filter((model) => model.sourceId !== sourceId),
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

      /*fetchModels: async (sourceId) => {
        const modelSource = get().sources.find((source) => source.sourceId === sourceId);
        if (!modelSource) {
          throw new Error('Model source not found');
        }

        const models = await mockApi.fetchModelsFromVendor(modelSource.vendorId);
        set((state) => ({ models: [...state.models, ...models] }));
        return models;
      },*/


      models: [],

      addModel: (model) =>
        set(state => ({ models: [...state.models, model] })),

      removeModel: (modelId) => {
        set((state) => ({ models: state.models.filter((model) => model.modelId !== modelId) }));
      },

    }),
    {
      name: 'app-models',
    }),
  {
    name: 'AppModels',
    enabled: false,
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


async function fetchModels(sourceId: DModelSourceId) {
  const modelSource = useModelsStore.getState().sources.find(
    (source) => source.sourceId === sourceId,
  );
  if (!modelSource) {
    throw new Error('Model source not found');
  }

  const models = await mockApi.fetchModelsFromVendor(modelSource.vendorId);
  models.forEach((model) => useModelsStore.getState().addModel(model));
  return models;
}

export interface ApiTest {
  fetchModelsFromVendor: (vendorId: ModelVendorId) => Promise<DLLM[]>;
}

export class MockApi implements ApiTest {
  async fetchModelsFromVendor(vendorId: ModelVendorId): Promise<DLLM[]> {
    // Example models data
    const exampleModels: DLLM[] = [
      {
        modelId: 'model1',
        sourceId: 'source1',
        label: 'Model 1',
        description: 'This is an example model 1.',
        tradeoff: 'balanced',
        speed: 'medium',
        contextWindowSize: 4096,
        canStream: true,
        canChat: false,
      },
      {
        modelId: 'model2',
        sourceId: 'source1',
        label: 'Model 2',
        description: 'This is an example model 2.',
        tradeoff: 'speed',
        speed: 'fast',
        contextWindowSize: 8192,
        canStream: false,
        canChat: true,
      },
    ];

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return exampleModels;
  }
}

const mockApi: ApiTest = new MockApi();
