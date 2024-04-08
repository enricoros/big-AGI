// NOTE: this is a separate file to help with bundle tracing, as it's included by the ProviderBootstrapLogic (i.e. by All pages)

// update this variable every time you want to broadcast a new version to clients
import { useAppStateStore } from '~/common/state/store-appstate';


export const incrementalNewsVersion: number = 15;


export function shallRedirectToNews() {
  const { usageCount, lastSeenNewsVersion } = useAppStateStore.getState();
  const isNewsOutdated = (lastSeenNewsVersion || 0) < incrementalNewsVersion;
  return isNewsOutdated && usageCount > 2;
}

export function markNewsAsSeen() {
  const { setLastSeenNewsVersion } = useAppStateStore.getState();
  setLastSeenNewsVersion(incrementalNewsVersion);
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
