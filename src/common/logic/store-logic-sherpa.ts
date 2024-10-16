import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

import { Release } from '~/common/app.release';
import { reconfigureBackendModels } from '~/common/logic/reconfigureBackendModels';


// Sherpa State: navigation thought the app, remembers the counters for progressive disclosure of complex features

interface SherpaStore {

  usageCount: number;

  lastLlmReconfigHash: string;
  lastSeenNewsVersion: number;

  chatComposerPrefill: string | null; // if not null, the composer will load this text at startup
  setChatComposerPrefill: (text: string | null) => void;

}

export const useLogicSherpaStore = create<SherpaStore>()(
  persist(
    (set) => ({

      usageCount: 0,

      lastLlmReconfigHash: '',
      lastSeenNewsVersion: 0,

      chatComposerPrefill: null,
      setChatComposerPrefill: (text) => set({ chatComposerPrefill: text }),

    }),
    {
      name: 'app-state',
    },
  ),
);

// increment the usage count
useLogicSherpaStore.setState((state) => ({ usageCount: (state.usageCount || 0) + 1 }));


/// News Navigation

export function shallRedirectToNews() {
  const { lastSeenNewsVersion, usageCount } = useLogicSherpaStore.getState();

  // first time user - ignore the news up to the next refresh
  if (lastSeenNewsVersion === 0) {
    markNewsAsSeen();
    return false;
  }

  // if the news is outdated and the user has used the app a few times, show the news
  const isNewsOutdated = (lastSeenNewsVersion || 0) < Release.Monotonics.NewsVersion;
  return isNewsOutdated && usageCount >= 3;
}

export function markNewsAsSeen() {
  useLogicSherpaStore.setState({ lastSeenNewsVersion: Release.Monotonics.NewsVersion });
}


// Reconfgure Backend Models

export async function sherpaReconfigureBackendModels() {
  return reconfigureBackendModels(
    useLogicSherpaStore.getState().lastLlmReconfigHash,
    (hash: string) => useLogicSherpaStore.setState({ lastLlmReconfigHash: hash }),
  );
}


// Chat Composer Prefill

export const setComposerStartupText = (text: string | null) => {
  useLogicSherpaStore.getState().setChatComposerPrefill(text);
};

export const useComposerStartupText = (): [string | null, (text: string | null) => void] => {
  return useLogicSherpaStore(useShallow(state => [state.chatComposerPrefill, state.setChatComposerPrefill]));
};
