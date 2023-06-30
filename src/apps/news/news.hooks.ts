import * as React from 'react';
import { shallow } from 'zustand/shallow';
import { useRouter } from 'next/router';

import { useAppStateStore } from '~/common/state/store-appstate';

import { incrementalVersion } from './news.data';


export function useShowNewsOnUpdate() {
  const { push } = useRouter();
  const { usageCount, lastSeenNewsVersion } = useAppStateStore(state => ({
    usageCount: state.usageCount,
    lastSeenNewsVersion: state.lastSeenNewsVersion,
  }), shallow);
  React.useEffect(() => {
    const isNewsOutdated = (lastSeenNewsVersion || 0) < incrementalVersion;
    if (isNewsOutdated && usageCount > 2) {
      // Disable for now
      push('/news').then(() => null);
    }
  }, [lastSeenNewsVersion, push, usageCount]);
}

export function useMarkNewsAsSeen() {
  React.useEffect(() => {
    useAppStateStore.getState().setLastSeenNewsVersion(incrementalVersion);
  }, []);
}