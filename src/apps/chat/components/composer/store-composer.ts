import { create } from 'zustand';
import { persist } from 'zustand/middleware';


/// Composer Store

interface ComposerStore {

  startupText: string | null; // if not null, the composer will load this text at startup
  setStartupText: (text: string | null) => void;

}

const useComposerStore = create<ComposerStore>()(
  persist((set, _get) => ({

      startupText: null,
      setStartupText: (text: string | null) => set({ startupText: text }),

    }),
    {
      name: 'app-composer',
      version: 1,
    }),
);

export const setComposerStartupText = (text: string | null) =>
  useComposerStore.getState().setStartupText(text);

export const useComposerStartupText = (): [string | null, (text: string | null) => void] => {
  const text = useComposerStore(state => state.startupText);
  return [text, useComposerStore.getState().setStartupText];
};