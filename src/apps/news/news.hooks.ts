import * as React from 'react';

import { navigateToNews } from '~/common/app.routes';
import { useAppStateStore } from '~/common/state/store-appstate';

import { incrementalVersion } from './news.data';


export function useRedirectToNewsOnUpdates() {
  React.useEffect(() => {
    const { usageCount, lastSeenNewsVersion } = useAppStateStore.getState();
    const isNewsOutdated = (lastSeenNewsVersion || 0) < incrementalVersion;
    if (isNewsOutdated && usageCount > 2) {
      // Disable for now
      void navigateToNews();
    }
  }, []);
}

export function useMarkNewsAsSeen() {
  React.useEffect(() => {
    useAppStateStore.getState().setLastSeenNewsVersion(incrementalVersion);
  }, []);
}