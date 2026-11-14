import type { WebSearchProvider } from '~/modules/search/search.provider';

import { callApiSearchGoogle, googleSearchIsConfigured } from './search.client';

/**
 * Google Custom Search as the first WebSearchProvider (issue #536).
 * Pass-through wrapper of the existing search client, so provider selection can
 * grow without changing the Google path: same credentials, same tRPC procedure,
 * same server env fallbacks.
 */
export const webSearchProviderGoogleCse: WebSearchProvider = {
  id: 'google-cse',
  isConfigured: googleSearchIsConfigured,
  search: ({ query, items, restrictToDomain }) => callApiSearchGoogle(query, items, restrictToDomain ?? undefined),
};
