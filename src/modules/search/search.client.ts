import { useSettingsStore } from '@/common/state/store-settings';

import { Search } from './search.types';

export const requireUserKeyGoogleCse = !process.env.HAS_SERVER_KEYS_GOOGLE_CSE;

export const isValidGoogleCloudApiKey = (apiKey?: string) => !!apiKey && apiKey.trim()?.length >= 39;
export const isValidGoogleCseId = (cseId?: string) => !!cseId && cseId.trim()?.length >= 17;

export const CmdRunReact: string[] = ['/react'];
export const CmdRunSearch: string[] = ['/search'];


/**
 * This function either returns the Search JSON response, or throws a descriptive error string
 */
export async function callApiSearchGoogle(queryText: string): Promise<Search.API.Response> {

  // create the query with the current keys
  const { googleCloudApiKey, googleCSEId } = useSettingsStore.getState();
  const queryParams: Search.API.RequestParams = {
    query: queryText,
    ...(googleCloudApiKey ? { key: googleCloudApiKey } : {}),
    ...(googleCSEId ? { cx: googleCSEId } : {}),
  };

  let errorMessage: string;
  try {
    const response = await fetch(`/api/search/google?${objectToQueryString(queryParams)}`);
    if (response.ok)
      return await response.json();
    errorMessage = `issue fetching: ${response.status} · ${response.statusText}`;
  } catch (error: any) {
    errorMessage = `fetch error: ${error?.message || error?.toString() || 'Unknown error'}`;
  }
  console.error(`callApiSearchGoogle: ${errorMessage}`);
  throw new Error(errorMessage);
}

export function objectToQueryString(params: Record<string, any>): string {
  return Object.entries(params)
    .map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(value))
    .join('&');
}