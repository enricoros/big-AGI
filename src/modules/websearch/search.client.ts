import { callApiSearchGoogle } from '~/modules/google/search.client';
import { apiAsync } from '~/common/util/trpc.client';

import type { WebSearchProvider, WebSearchProviderId } from './search.types';
import { useWebSearchStore } from './store-module-websearch';


const providers: Record<WebSearchProviderId, WebSearchProvider> = {
  google: { search: callApiSearchGoogle },
  context: {
    search: async (query, items, restrictToDomain, signal) => {
      const { contextApiKey, contextRestrictToDomain } = useWebSearchStore.getState();
      try {
        return await apiAsync.contextSearch.search.mutate({
          query, items, key: contextApiKey,
          restrictToDomain: restrictToDomain ?? (contextRestrictToDomain || null),
        }, { signal, context: { noLog: true } });
      } catch {
        throw new Error(signal?.aborted ? 'Context.dev search cancelled.' : 'Context.dev search failed. Check Tools > Custom Search and try again.');
      }
    },
  },
};

export const callApiWebSearch: WebSearchProvider['search'] = (query, items, restrictToDomain, signal) =>
  providers[useWebSearchStore.getState().providerId].search(query, items, restrictToDomain, signal);
