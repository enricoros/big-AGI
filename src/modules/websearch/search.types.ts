import type { Search } from '~/modules/google/search.types';


export type WebSearchProviderId = 'google' | 'context';

export interface WebSearchProvider {
  search(query: string, items: number, restrictToDomain?: string, signal?: AbortSignal): Promise<{ pages: Search.API.BriefResult[] }>;
}
