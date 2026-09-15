import { create } from 'zustand';
import { persist } from 'zustand/middleware';


/**
 * Shared Jina AI (Reader r.jina.ai / Search s.jina.ai) settings.
 * Single key, consumed by both the Browse module (browse-jina dialect) and
 * the Search module (jina provider). Server-side equivalent: JINA_API_KEY env.
 */

interface ModuleJinaStore {

  jinaApiKey: string;
  setJinaApiKey: (key: string) => void;

}

export const useJinaStore = create<ModuleJinaStore>()(
  persist(
    (set) => ({

      jinaApiKey: '',
      setJinaApiKey: (jinaApiKey: string) => set({ jinaApiKey }),

    }),
    {
      name: 'app-module-jina',
    },
  ),
);

// Jina keys look like 'jina_xxxxxxxx...'; be lenient on length, strict on prefix
export const isValidJinaApiKey = (apiKey?: string) => !!apiKey && apiKey.trim().startsWith('jina_') && apiKey.trim().length >= 10;
