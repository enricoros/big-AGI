import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

export type BrowsePageTransform = 'html' | 'text' | 'markdown';

interface BrowseState {

  languageCodeForFilter: string;
  browseVoiceId: string;
  setBrowseVoiceId: (value: string) => void;
  setLanguageCodeForFilter: (value: string) => void;

}

export const useBrowseStore = create<BrowseState>()(
  persist(
    (set) => ({
      languageCodeForFilter: '',
      browseVoiceId: '',
      setBrowseVoiceId: (browseVoiceId: string) => set(() => ({ browseVoiceId })),
      setLanguageCodeForFilter: (languageCodeForFilter: string) => set(() => ({ languageCodeForFilter })),
    }),
    {
      name: 'app-module-browse',
    },
  ),
);

export function useBrowseVoiceId(): [string, (value: string) => void] {
  return useBrowseStore(useShallow(state => [state.browseVoiceId, state.setBrowseVoiceId]))
}

export function useLanguageCodeForFilter(): [string, (value: string) => void] {
  return useBrowseStore(useShallow(state => [state.languageCodeForFilter, state.setLanguageCodeForFilter]))
}

export function getBrowseVoiceId() {
  return useBrowseStore.getState().browseVoiceId
}