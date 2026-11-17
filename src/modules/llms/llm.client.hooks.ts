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
  // A setting being typed is not listed by itself (Enter and the Models button list it): the format rules behind
  // `enabled` are weak, and a half-typed key or host fails the listing. A whole value - a paste, a fill, a toggle - is.
  // [derived from the previous render] whether the last change of the setup was typed
  const setup = service?.setup;
  const [seen, setSeen] = React.useState({ setup, isTyped: false });
  let isTyped = seen.isTyped;
  if (seen.setup !== setup) {
    const change = _setupChange(seen.setup, setup);
    if (change !== 'none') isTyped = change === 'typed';
    setSeen({ setup, isTyped });
  }

  const { isFetching, refetch, isError, error } = useQuery<{ models: ModelDescriptionSchema[] }, TRPCClientErrorBase<any> | null>({
    enabled: enabled && !!service && !isTyped,
    queryKey: llmsListServiceModelsQueryKey(service?.id),
    queryFn: async () => {
      if (!service) throw new Error('No service provided to fetch models for'); // only to allow null
      return await llmsUpdateModelsForServiceOrThrow(service.id, { at: Date.now(), via: 'service' });
    },
    // no staleTime: an earlier listing of this id says nothing once `enabled` asks for one - its models are gone
    // (removed, or the service was removed and added again, which reuses the id)
  });

  // join an in-flight listing (a session's, or a double click) instead of cancelling it: the listing does not
  // consume react-query's signal, so a cancelled one would still land and write, next to the new one
  const refetchOrJoin = React.useCallback(() => void refetch({ cancelRefetch: false }), [refetch]);

  return { isFetching, refetch: refetchOrJoin, isError, error };
}

/**
 * How a setup changed: 'typed' when one text setting differs by one character (inserted, deleted or replaced),
 * 'whole' for any other difference, 'none' when the settings are equal.
 */
function _setupChange(prev: object | undefined, next: object | undefined): 'none' | 'typed' | 'whole' {
  const from: Record<string, unknown> = { ...prev }, to: Record<string, unknown> = { ...next };
  const changed = Object.keys({ ...from, ...to }).filter(name => from[name] !== to[name]);
  if (changed.length !== 1) return changed.length ? 'whole' : 'none';

  // a setting typed for the first time has no value yet
  const a = from[changed[0]] ?? '', b = to[changed[0]] ?? '';
  if (a === b) return 'none';
  if (typeof a !== 'string' || typeof b !== 'string') return 'whole';
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (long.length - short.length > 1) return 'whole';

  // past the common start, the rest is equal after skipping one character: of the longer text, or of both
  let at = 0;
  while (at < short.length && short[at] === long[at]) at++;
  return long.slice(at + 1) === short.slice(long.length > short.length ? at : at + 1) ? 'typed' : 'whole';
}
