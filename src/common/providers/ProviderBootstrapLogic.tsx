import * as React from 'react';

import { getIsMobile } from '~/common/components/useMatchMedia';
import { useNextLoadProgress } from '~/common/components/useNextLoadProgress';


export function ProviderBootstrapLogic(props: { children: React.ReactNode }) {

  // wire-up the NextJS router to a top-level loading bar - this will alleviate
  // the perceived delay on the first 'backend' (provider) capabiliies load
  useNextLoadProgress();

  // NOTE: just a pass-through for now. Will be used for the following:
  //  - loading the latest news (see ChatPage -> useRedirectToNewsOnUpdates)
  //  - loading the commander
  //  - ...

  // boot-up logic. this is not updated at route changes, but only at app startup
  React.useEffect(() => {
    if (getIsMobile()) {
      // TODO: the app booted in mobile mode
    }
  }, []);

  return props.children;
}