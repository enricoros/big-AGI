import type { TRPCClientErrorBase } from '@trpc/client';
import { useQuery } from '@tanstack/react-query';

import type { DModelsService } from '~/common/stores/llms/modelsservice.types';

import type { ModelDescriptionSchema } from './server/llm.server.types';
import { llmsUpdateModelsForServiceOrThrow } from './llm.client';


/**
 * Hook that fetches the list of models from the vendor and updates the store,
 * while returning the fetch state.
 */
export function useLlmUpdateModels<TServiceSettings extends object>(
  enabled: boolean,
  service: DModelsService<TServiceSettings> | null,
  discardUserEdits?: boolean,
): {
  isFetching: boolean,
  refetch: () => void,
  isError: boolean,
  error: TRPCClientErrorBase<any> | null
} {
  return useQuery<{ models: ModelDescriptionSchema[] }, TRPCClientErrorBase<any> | null>({
    enabled: enabled && !!service,
    queryKey: ['list-models', service?.id || 'missing-service'],
    queryFn: async () => {
      if (!service)
        throw new Error('No service provided to fetch models for');
      return await llmsUpdateModelsForServiceOrThrow(service.id, !discardUserEdits);
    },
    staleTime: Infinity,
  });
}
