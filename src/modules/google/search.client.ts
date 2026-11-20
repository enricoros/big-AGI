import { hasServerConf } from '~/common/app.serverconf';
import { apiAsync } from '~/common/util/trpc.client';

import { Search } from './search.types';
import { useGoogleSearchStore } from './store-module-google';


const isValidGoogleCloudApiKey = (apiKey?: string) => !!apiKey && apiKey.trim()?.length >= 39;
const isValidGoogleCseId = (cseId?: string) => !!cseId && cseId.trim()?.length >= 17;

/**
 * Validity of the Google search configuration, per credential: client-held keys, else server-held keys.
 * Shared by the settings UI (per-field errors) and the search provider (`isConfigured`).
 */
export function googleSearchConfigValidity(): { keyValid: boolean; cseIdValid: boolean } {
  const { googleCloudApiKey, googleCSEId } = useGoogleSearchStore.getState();
  const backendHasGoogle = hasServerConf('hasGoogleCustomSearch');
  return {
    keyValid: googleCloudApiKey ? isValidGoogleCloudApiKey(googleCloudApiKey) : backendHasGoogle,
    cseIdValid: googleCSEId ? isValidGoogleCseId(googleCSEId) : backendHasGoogle,
  };
}

export function googleSearchIsConfigured(): boolean {
  const { keyValid, cseIdValid } = googleSearchConfigValidity();
  return keyValid && cseIdValid;
}


/**
 * This function either returns the Search JSON response, or throws a descriptive error string
 */
export async function callApiSearchGoogle(query: string, items: number, restrictToDomain?: string): Promise<{ pages: Search.API.BriefResult[] }> {

  // get the keys (empty if they're on server)
  const { googleCloudApiKey, googleCSEId, restrictToDomain: defaultRestrictToDomain } = useGoogleSearchStore.getState();

  try {
    return await apiAsync.googleSearch.search.query({
      query,
      items,
      key: googleCloudApiKey,
      cx: googleCSEId,
      restrictToDomain: restrictToDomain || defaultRestrictToDomain || null,
    });
  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    console.error(`callApiSearchGoogle: ${errorMessage}`);
    throw new Error(errorMessage);
  }
}