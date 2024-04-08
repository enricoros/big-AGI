import { apiAsync } from '~/common/util/trpc.client';

import { Search } from './search.types';
import { useGoogleSearchStore } from './store-module-google';


export const isValidGoogleCloudApiKey = (apiKey?: string) => !!apiKey && apiKey.trim()?.length >= 39;
export const isValidGoogleCseId = (cseId?: string) => !!cseId && cseId.trim()?.length >= 17;


/**
 * This function either returns the Search JSON response, or throws a descriptive error string
 */
export async function callApiSearchGoogle(queryText: string): Promise<{ pages: Search.API.BriefResult[] }> {

  // get the keys (empty if they're on server)
  const { googleCloudApiKey, googleCSEId } = useGoogleSearchStore.getState();

  try {
    return await apiAsync.googleSearch.search.query({ query: queryText, key: googleCloudApiKey, cx: googleCSEId });
  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    console.error(`callApiSearchGoogle: ${errorMessage}`);
    throw new Error(errorMessage);
  }
}