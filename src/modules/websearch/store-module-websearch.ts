import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { WebSearchProviderId } from './search.types';


interface WebSearchStore {
  providerId: WebSearchProviderId;
  setProviderId: (providerId: WebSearchProviderId) => void;
  contextApiKey: string;
  setContextApiKey: (contextApiKey: string) => void;
  contextRestrictToDomain: string;
  setContextRestrictToDomain: (contextRestrictToDomain: string) => void;
}

export const useWebSearchStore = create<WebSearchStore>()(
  persist(
    (set) => ({
      providerId: 'google',
      setProviderId: (providerId) => set({ providerId }),
      contextApiKey: '',
      setContextApiKey: (contextApiKey) => set({ contextApiKey }),
      contextRestrictToDomain: '',
      setContextRestrictToDomain: (contextRestrictToDomain) => set({ contextRestrictToDomain }),
    }),
    { name: 'app-module-web-search' },
  ),
);
