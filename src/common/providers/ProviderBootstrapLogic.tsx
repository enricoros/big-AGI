import * as React from 'react';

import { navigateToNews } from '~/common/app.routes';
import { useNextLoadProgress } from '~/common/components/useNextLoadProgress';


import { markNewsAsSeen, shallRedirectToNews } from '../../apps/news/news.version';


export function ProviderBootstrapLogic(props: { children: React.ReactNode }) {

  // wire-up the NextJS router to a top-level loading bar - this will alleviate
  // the perceived delay on the first 'backend' (provider) capabiliies load
  useNextLoadProgress();

  // NOTE: just a pass-through for now. Will be used for the following:
  //  - loading the latest news (see ChatPage -> useRedirectToNewsOnUpdates)
  //  - loading the commander
  //  - ...
  const isRedirecting = React.useMemo(() => {

    // redirect to the news page if the news is outdated
    let doRedirect = shallRedirectToNews();
    if (doRedirect) {
      markNewsAsSeen();
      void navigateToNews();
    }

    // redirect to the commander if the app is running on mobile
    // if (!doRedirect && getIsMobile()) {
    //   doRedirect = true;
    //   void showCommander();
    // }

    return doRedirect;
  }, []);

  return /*isRedirecting ? null :*/ props.children;
}