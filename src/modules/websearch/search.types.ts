export interface WebSearchResult {
  title: string;
  link: string;
  snippet: string;
}

export type WebSearchProviderId = 'google' | 'context';

export interface WebSearchProvider {
  search(query: string, items: number, restrictToDomain?: string, signal?: AbortSignal): Promise<{ pages: WebSearchResult[], warning?: string }>;
}
