import * as React from 'react';
import type { TRPCClientErrorBase } from '@trpc/client';
import { useQuery } from '@tanstack/react-query';

import type { DModelsService } from '~/common/stores/llms/llms.service.types';

import type { ModelDescriptionSchema } from './server/llm.server.types';
import { llmsListServiceModelsQueryKey, llmsUpdateModelsForServiceOrThrow } from './llm.client';


/**
 * Hook that fetches the list of models from the vendor and updates the store,
 * while returning the fetch state.
 */
export function useLlmUpdateModels<TServiceSettings extends object>(
  enabled: boolean,
  service: DModelsService<TServiceSettings> | null,
): {
  isFetching: boolean,
  refetch: () => void,
  isError: boolean,
  error: TRPCClientErrorBase<any> | null
} {
  const { isFetching, refetch, isError, error } = useQuery<{ models: ModelDescriptionSchema[] }, TRPCClientErrorBase<any> | null>({
    enabled: enabled && !!service,
    queryKey: llmsListServiceModelsQueryKey(service?.id),
    queryFn: async () => {
      if (!service) throw new Error('No service provided to fetch models for'); // only to allow null
      return await llmsUpdateModelsForServiceOrThrow(service.id, { at: Date.now(), via: 'service' });
    },
    staleTime: Infinity,
  });

  // join an in-flight listing (a session's, or a double click) instead of cancelling it: the listing does not
  // consume react-query's signal, so a cancelled one would still land and write, next to the new one
  const refetchOrJoin = React.useCallback(() => void refetch({ cancelRefetch: false }), [refetch]);

  return { isFetching, refetch: refetchOrJoin, isError, error };
}
