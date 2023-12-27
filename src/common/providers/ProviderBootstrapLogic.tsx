import * as React from 'react';

import { isBrowser } from '~/common/util/pwaUtils';
import { isMobileQuery } from '~/common/components/useMatchMedia';


export function ProviderBootstrapLogic(props: { children: React.ReactNode }) {

  // NOTE: just a pass-through for now. Will be used for the following:
  //  - loading the latest news (see ChatPage -> useRedirectToNewsOnUpdates)
  //  - loading the commander
  //  - ...

  // boot-up logic. this is not updated at route changes, but only at app startup
  React.useEffect(() => {
    const isMobile = isBrowser ? window.matchMedia(isMobileQuery()).matches : false;
    if (isMobile) {
      // TODO: the app booted in mobile mode
    }
  }, []);

  return props.children;
}