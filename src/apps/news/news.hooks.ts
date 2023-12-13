import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { navigateToNews } from '~/common/app.routes';
import { useAppStateStore } from '~/common/state/store-appstate';

import { incrementalVersion } from './news.data';


export function useShowNewsOnUpdate() {
  const { usageCount, lastSeenNewsVersion } = useAppStateStore(state => ({
    usageCount: state.usageCount,
    lastSeenNewsVersion: state.lastSeenNewsVersion,
  }), shallow);
  React.useEffect(() => {
    const isNewsOutdated = (lastSeenNewsVersion || 0) < incrementalVersion;
    if (isNewsOutdated && usageCount > 2) {
      // Disable for now
      void navigateToNews();
    }
  }, [lastSeenNewsVersion, usageCount]);
}

export function useMarkNewsAsSeen() {
  React.useEffect(() => {
    useAppStateStore.getState().setLastSeenNewsVersion(incrementalVersion);
  }, []);
}