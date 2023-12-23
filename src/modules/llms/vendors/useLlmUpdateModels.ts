import type { IModelVendor } from './IModelVendor';
import type { ModelDescriptionSchema } from '../server/llm.server.types';
import { DLLM, DModelSource, useModelsStore } from '../store-llms';


/**
 * Hook that fetches the list of models from the vendor and updates the store,
 * while returning the fetch state.
 */
export function useLlmUpdateModels<TSourceSetup, TAccess, TLLMOptions>(vendor: IModelVendor<TSourceSetup, TAccess, TLLMOptions>, access: TAccess, enabled: boolean, source: DModelSource<TSourceSetup>) {
  return vendor.rpcUpdateModelsQuery(access, enabled, data => source && updateModelsFn(data, source));
}


function updateModelsFn<TSourceSetup>(data: { models: ModelDescriptionSchema[] }, source: DModelSource<TSourceSetup>) {
  useModelsStore.getState().setLLMs(
    data.models.map(model => modelDescriptionToDLLMOpenAIOptions(model, source)),
    source.id,
  );
}

function modelDescriptionToDLLMOpenAIOptions<TSourceSetup, TLLMOptions>(model: ModelDescriptionSchema, source: DModelSource<TSourceSetup>): DLLM<TSourceSetup, TLLMOptions> {
  const maxOutputTokens = model.maxCompletionTokens || Math.round((model.contextWindow || 4096) / 2);
  const llmResponseTokens = Math.round(maxOutputTokens / (model.maxCompletionTokens ? 2 : 4));
  return {
    id: `${source.id}-${model.id}`,

    label: model.label,
    created: model.created || 0,
    updated: model.updated || 0,
    description: model.description,
    tags: [], // ['stream', 'chat'],
    contextTokens: model.contextWindow,
    maxOutputTokens: maxOutputTokens,
    hidden: !!model.hidden,

    isFree: model.pricing?.cpmPrompt === 0 && model.pricing?.cpmCompletion === 0,

    sId: source.id,
    _source: source,

    options: {
      llmRef: model.id,
      // @ts-ignore FIXME: large assumption that this is LLMOptionsOpenAI object
      llmTemperature: 0.5,
      llmResponseTokens: llmResponseTokens,
    },
  };
}