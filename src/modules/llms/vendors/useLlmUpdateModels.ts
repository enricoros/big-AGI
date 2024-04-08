import type { TRPCClientErrorBase } from '@trpc/client';
import { useQuery } from '@tanstack/react-query';

import type { IModelVendor } from './IModelVendor';
import type { ModelDescriptionSchema } from '../server/llm.server.types';
import { DLLM, DModelSource, useModelsStore } from '../store-llms';
import { FALLBACK_LLM_TEMPERATURE } from './openai/openai.vendor';


/**
 * Hook that fetches the list of models from the vendor and updates the store,
 * while returning the fetch state.
 */
export function useLlmUpdateModels<TSourceSetup, TAccess, TLLMOptions>(
  vendor: IModelVendor<TSourceSetup, TAccess, TLLMOptions>,
  access: TAccess,
  enabled: boolean,
  source: DModelSource<TSourceSetup>,
  keepUserEdits?: boolean,
): {
  isFetching: boolean,
  refetch: () => void,
  isError: boolean,
  error: TRPCClientErrorBase<any> | null
} {
  return useQuery<{ models: ModelDescriptionSchema[] }, TRPCClientErrorBase<any> | null>({
    enabled: enabled && !!source,
    queryKey: ['list-models', source.id],
    queryFn: async () => {
      const data = await vendor.rpcUpdateModelsOrThrow(access);
      source && updateModelsForSource(data, source, keepUserEdits === true);
      return data;
    },
    staleTime: Infinity,
  });
}

export function updateModelsForSource<TSourceSetup>(data: { models: ModelDescriptionSchema[] }, source: DModelSource<TSourceSetup>, keepUserEdits: boolean) {
  useModelsStore.getState().setLLMs(
    data.models.map(model => modelDescriptionToDLLMOpenAIOptions(model, source)),
    source.id,
    true,
    keepUserEdits,
  );
}

function modelDescriptionToDLLMOpenAIOptions<TSourceSetup, TLLMOptions>(model: ModelDescriptionSchema, source: DModelSource<TSourceSetup>): DLLM<TSourceSetup, TLLMOptions> {

  // null means unknown contenxt/output tokens
  const contextTokens = model.contextWindow || null;
  const maxOutputTokens = model.maxCompletionTokens || (contextTokens ? Math.round(contextTokens / 2) : null);
  const llmResponseTokensRatio = model.maxCompletionTokens ? 1 / 2 : 1 / 4;
  const llmResponseTokens = maxOutputTokens ? Math.round(maxOutputTokens * llmResponseTokensRatio) : null;

  return {
    id: `${source.id}-${model.id}`,

    label: model.label,
    created: model.created || 0,
    updated: model.updated || 0,
    description: model.description,
    tags: [], // ['stream', 'chat'],
    contextTokens,
    maxOutputTokens,
    hidden: !!model.hidden,

    isFree: model.pricing?.cpmPrompt === 0 && model.pricing?.cpmCompletion === 0,

    sId: source.id,
    _source: source,

    options: {
      llmRef: model.id,
      // @ts-ignore FIXME: large assumption that this is LLMOptionsOpenAI object
      llmTemperature: FALLBACK_LLM_TEMPERATURE,
      llmResponseTokens,
    },
  };
}