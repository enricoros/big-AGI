import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

export type BrowsePageTransform = 'html' | 'text' | 'markdown';

interface BrowseState {

  browseVoiceId: number;
  setBrowseVoiceId: (value: number) => void;

}

export const useBrowseStore = create<BrowseState>()(
  persist(
    (set) => ({

      browseVoiceId: NaN,
      setBrowseVoiceId: (browseVoiceId: number) => set(() => ({ browseVoiceId })),

    }),
    {
      name: 'app-module-browse',
    },
  ),
);

export function useBrowseVoiceId(): [number, (value: number) => void] {
  return useBrowseStore(useShallow(state => [state.browseVoiceId, state.setBrowseVoiceId]))
}

export function getBrowseVoiceId() {
  return useBrowseStore.getState().browseVoiceId
}