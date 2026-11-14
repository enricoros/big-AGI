import type { Search } from '~/modules/google/search.types';

import { webSearchProviderGoogleCse } from '~/modules/google/search.provider.google';
import { DEFAULT_SEARCH_PROVIDER_ID, useSearchStore } from './store-module-search';

/**
 * Pluggable web search backends (issue #536): one interface, one active provider.
 *
 * The search consumer (the ReAct `google:` action) calls `getActiveSearchProvider()`
 * and stays backend-agnostic. New backends (SearXNG, Keenable, ...) implement
 * `WebSearchProvider` and register here, without changes downstream.
 *
 * The stable contract is `Search.API.BriefResult[]` (`src/modules/google/search.types.ts`),
 * the same shape the Google tRPC procedure returns today.
 */

export type WebSearchProviderId = 'google-cse'; // one id per backend, extends per PR

export interface WebSearchRequest {
  query: string;
  items: number;
  restrictToDomain?: string | null;
}

export interface WebSearchResults {
  pages: Search.API.BriefResult[];
}

export interface WebSearchProvider {
  /** Open string id (registry keys on it; stale persisted selections fall back to the default). Known ids: WebSearchProviderId. */
  id: string;
  /** True when the provider holds the configuration it needs (client-side keys or server conf). */
  isConfigured(): boolean;
  search(request: WebSearchRequest): Promise<WebSearchResults>;
}

const registry = new Map<string, WebSearchProvider>();

/** Built-ins register here; future providers add one line (or self-register from their module). */
registerSearchProvider(webSearchProviderGoogleCse);

export function registerSearchProvider(provider: WebSearchProvider): void {
  if (registry.has(provider.id))
    console.warn(`[DEV] search.provider: id '${provider.id}' is already registered, overwriting`);
  registry.set(provider.id, provider);
}

export function getSearchProvider(providerId: string): WebSearchProvider | undefined {
  return registry.get(providerId);
}

/**
 * The active provider, from settings. Unknown or stale selections (persisted
 * state may outlive a removed backend) fall back to the default provider.
 */
export function getActiveSearchProvider(): WebSearchProvider {
  const { searchBackend } = useSearchStore.getState();
  return registry.get(searchBackend) ?? registry.get(DEFAULT_SEARCH_PROVIDER_ID)!;
}
