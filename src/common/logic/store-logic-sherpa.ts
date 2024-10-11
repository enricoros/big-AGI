import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

import { incrementalNewsVersion } from '../../apps/news/news.version';


// Sherpa State: navigation thought the app, remembers the counters for progressive disclosure of complex features

interface SherpaStore {

  usageCount: number;

  lastSeenNewsVersion: number;

  chatComposerPrefill: string | null; // if not null, the composer will load this text at startup
  setChatComposerPrefill: (text: string | null) => void;

}

export const useLogicSherpaStore = create<SherpaStore>()(
  persist(
    (set) => ({

      usageCount: 0,

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
  const isNewsOutdated = (lastSeenNewsVersion || 0) < incrementalNewsVersion;
  return isNewsOutdated && usageCount >= 3;
}

export function markNewsAsSeen() {
  useLogicSherpaStore.setState({ lastSeenNewsVersion: incrementalNewsVersion });
}


// Chat Composer Prefill

export const setComposerStartupText = (text: string | null) => {
  useLogicSherpaStore.getState().setChatComposerPrefill(text);
};

export const useComposerStartupText = (): [string | null, (text: string | null) => void] => {
  return useLogicSherpaStore(useShallow(state => [state.chatComposerPrefill, state.setChatComposerPrefill]));
};
