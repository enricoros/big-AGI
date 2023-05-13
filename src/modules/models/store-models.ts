import { create } from 'zustand';
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
  // state attributes
  configured: boolean;
  // specific config?
}

export type DModelSourceId = string;


interface ModelsStore {

  modelSources: DModelSource[];
  addModelSource: (modelSource: DModelSource) => void;
  removeModelSource: (sourceId: DModelSourceId) => void;
  updateModelSource: (sourceId: DModelSourceId, updatedModelSource: Partial<DModelSource>) => void;

  fetchModels: (sourceId: DModelSourceId) => Promise<DLLM[]>;

  models: DLLM[];
  addModel: (model: DLLM) => void;
  removeModel: (modelId: string) => void;

}

export const useModelsStore = create<ModelsStore>()(devtools(
  persist(
    (set, get) => ({

      modelSources: [],

      addModelSource: (modelSource) => {
        set((state) => ({ modelSources: [...state.modelSources, modelSource] }));
      },

      removeModelSource: (sourceId) => {
        set((state) => removeSourceAndModels(state, sourceId));
      },

      updateModelSource: (sourceId, updatedModelSource) => {
        set((state) => ({
          modelSources: state.modelSources.map((source) => (source.sourceId === sourceId ? { ...source, ...updatedModelSource } : source)),
        }));
      },

      fetchModels: async (sourceId) => {
        const modelSource = get().modelSources.find((source) => source.sourceId === sourceId);
        if (!modelSource) {
          throw new Error('Model source not found');
        }

        const models = await mockApi.fetchModelsFromVendor(modelSource.vendorId);
        set((state) => ({ models: [...state.models, ...models] }));
        return models;
      },

      models: [],
      addModel: (model) => {
        set((state) => ({ models: [...state.models, model] }));
      },
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

function removeSourceAndModels(state: ModelsStore, sourceId: DModelSourceId): Partial<ModelsStore> {
  const updatedModelSources = state.modelSources.filter((source) => source.sourceId !== sourceId);
  const updatedModels = state.models.filter((model) => model.sourceId !== sourceId);
  return { modelSources: updatedModelSources, models: updatedModels };
}


async function fetchModels(sourceId: DModelSourceId) {
  const modelSource = useModelsStore.getState().modelSources.find(
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
