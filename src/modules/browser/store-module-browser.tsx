import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

export type BrowsePageTransform = 'html' | 'text' | 'markdown';

interface BrowseState {

  browseVoiceId: string;
  setBrowseVoiceId: (value: string) => void;

}

export const useBrowseStore = create<BrowseState>()(
  persist(
    (set) => ({

      browseVoiceId: '',
      setBrowseVoiceId: (browseVoiceId: string) => set(() => ({ browseVoiceId })),

    }),
    {
      name: 'app-module-browse',
    },
  ),
);

export function useBrowseVoiceId(): [string, (value: string) => void] {
  return useBrowseStore(useShallow(state => [state.browseVoiceId, state.setBrowseVoiceId]))
}

export function getBrowseVoiceId() {
  return useBrowseStore.getState().browseVoiceId
}