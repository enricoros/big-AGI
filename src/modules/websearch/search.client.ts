import { callApiSearchGoogle } from '~/modules/google/search.client';
import { apiAsync } from '~/common/util/trpc.client';

import type { WebSearchProvider, WebSearchProviderId } from './search.types';
import { useWebSearchStore } from './store-module-websearch';


const providers: Record<WebSearchProviderId, WebSearchProvider> = {
  google: { search: callApiSearchGoogle },
  context: {
    search: (query, items, restrictToDomain, signal) => {
      const { contextApiKey, contextRestrictToDomain } = useWebSearchStore.getState();
      return apiAsync.contextSearch.search.mutate({
        query, items, key: contextApiKey,
        restrictToDomain: restrictToDomain ?? (contextRestrictToDomain || null),
      }, { signal, context: { noLog: true } });
    },
  },
};

export const callApiWebSearch: WebSearchProvider['search'] = (query, items, restrictToDomain, signal) =>
  providers[useWebSearchStore.getState().providerId].search(query, items, restrictToDomain, signal);
