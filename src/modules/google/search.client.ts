import { apiAsync } from '~/common/util/trpc.client';

import { isValidJinaApiKey, useJinaStore } from '~/modules/jina/store-module-jina';

import { Search } from './search.types';
import { useGoogleSearchStore } from './store-module-google';


export const isValidGoogleCloudApiKey = (apiKey?: string) => !!apiKey && apiKey.trim()?.length >= 39;
export const isValidGoogleCseId = (cseId?: string) => !!cseId && cseId.trim()?.length >= 17;


/**
 * This function either returns the Search JSON response, or throws a descriptive error string
 */
export async function callApiSearchGoogle(query: string, items: number, restrictToDomain?: string): Promise<{ pages: Search.API.BriefResult[] }> {

  // get the keys (empty if they're on server)
  const { googleCloudApiKey, googleCSEId, restrictToDomain: defaultRestrictToDomain } = useGoogleSearchStore.getState();
  const { jinaApiKey } = useJinaStore.getState();

  // use Jina Search when Google PSE isn't configured client-side but a Jina key is;
  // when both are empty the server decides (env fallback: Google first, then JINA_API_KEY)
  const hasGoogle = isValidGoogleCloudApiKey(googleCloudApiKey) && isValidGoogleCseId(googleCSEId);
  const hasJina = isValidJinaApiKey(jinaApiKey);
  const useJina = !hasGoogle && hasJina;

  try {
    return await apiAsync.googleSearch.search.query({
      query,
      items,
      provider: useJina ? 'jina' : 'google',
      key: googleCloudApiKey,
      cx: googleCSEId,
      ...(useJina && { jinaKey: jinaApiKey.trim() }),
      restrictToDomain: restrictToDomain || defaultRestrictToDomain || null,
    });
  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    console.error(`callApiSearchGoogle: ${errorMessage}`);
    throw new Error(errorMessage);
  }
}