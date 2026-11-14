import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { WebSearchProviderId } from './search.provider';

/** The default web search provider, also the fallback for unknown or stale selections. Single source for the id. */
export const DEFAULT_SEARCH_PROVIDER_ID: WebSearchProviderId = 'google-cse';

/**
 * Web search provider selection (issue #536).
 *
 * Kept as its own store, separate from the Google credentials store, so existing
 * persisted Google settings are untouched by the provider layer. The value is a
 * provider id as registered in `search.provider.ts`; unknown or stale values
 * (e.g. a removed backend) fall back to the default at lookup time.
 */
interface ModuleSearchStore {

  searchBackend: string;
  setSearchBackend: (providerId: string) => void;

}

export const useSearchStore = create<ModuleSearchStore>()(
  persist(
    (set) => ({

      searchBackend: DEFAULT_SEARCH_PROVIDER_ID,
      setSearchBackend: (providerId: string) => set({ searchBackend: providerId }),

    }),
    {
      name: 'app-module-search',
    }),
);
