// NOTE: this is a separate file to help with bundle tracing, as it's included by the ProviderBootstrapLogic (i.e. by All pages)

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { useAppStateStore } from '~/common/state/store-appstate';


// update this variable every time you want to broadcast a new version to clients
export const incrementalNewsVersion: number = 16.1; // not notifying for 1.16.5


interface NewsState {
  lastSeenNewsVersion: number;
}

export const useAppNewsStateStore = create<NewsState>()(
  persist(
    (set) => ({
      lastSeenNewsVersion: 0,
    }),
    {
      name: 'app-news',
    },
  ),
);


export function shallRedirectToNews() {
  const { lastSeenNewsVersion } = useAppNewsStateStore.getState();
  const { usageCount } = useAppStateStore.getState();
  const isNewsOutdated = (lastSeenNewsVersion || 0) < incrementalNewsVersion;
  return isNewsOutdated && usageCount > 2;
}

export function markNewsAsSeen() {
  useAppNewsStateStore.setState({ lastSeenNewsVersion: incrementalNewsVersion });
}


// NOTE: moved to the ProviderBootstrapLogic, and to the functions above - we used to have hoooks for switching to the news
/*export function useRedirectToNewsOnUpdates() {
  React.useEffect(() => {
    const { usageCount, lastSeenNewsVersion } = useAppStateStore.getState();
    const isNewsOutdated = (lastSeenNewsVersion || 0) < incrementalVersion;
    if (isNewsOutdated && usageCount > 2)
      return runWhenIdle(navigateToNews, 20000);
  }, []);
}*/
