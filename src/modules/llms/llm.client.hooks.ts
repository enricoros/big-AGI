import type { TRPCClientErrorBase } from '@trpc/client';
import { useQuery } from '@tanstack/react-query';

import type { ModelDescriptionSchema } from './server/llm.server.types';
import type { DModelSource } from './store-llms';
import { llmsUpdateModelsForSourceOrThrow } from './llm.client';


/**
 * Hook that fetches the list of models from the vendor and updates the store,
 * while returning the fetch state.
 */
export function useLlmUpdateModels<TSourceSetup>(
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
    queryFn: async () => await llmsUpdateModelsForSourceOrThrow(source.id, keepUserEdits === true),
    staleTime: Infinity,
  });
}


