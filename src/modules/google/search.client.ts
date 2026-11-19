import { apiAsync } from '~/common/util/trpc.client';

import type { WebSearchResult } from '~/modules/websearch/search.types';
import { useGoogleSearchStore } from './store-module-google';


export const isValidGoogleCloudApiKey = (apiKey?: string) => !!apiKey && apiKey.trim()?.length >= 39;
export const isValidGoogleCseId = (cseId?: string) => !!cseId && cseId.trim()?.length >= 17;


/**
 * This function either returns the Search JSON response, or throws a descriptive error string
 */
export async function callApiSearchGoogle(query: string, items: number, restrictToDomain?: string, signal?: AbortSignal): Promise<{ pages: WebSearchResult[] }> {

  // get the keys (empty if they're on server)
  const { googleCloudApiKey, googleCSEId, restrictToDomain: defaultRestrictToDomain } = useGoogleSearchStore.getState();

  try {
    return await apiAsync.googleSearch.search.query({
      query,
      items,
      key: googleCloudApiKey,
      cx: googleCSEId,
      restrictToDomain: restrictToDomain || defaultRestrictToDomain || null,
    }, { signal, context: { noLog: true } });
  } catch {
    throw new Error(signal?.aborted ? 'Google Custom Search cancelled.' : 'Google Custom Search failed. Check your credentials and try again.');
  }
}