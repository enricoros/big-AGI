import * as React from 'react';
import { useRouter } from 'next/router';

import { markNewsAsSeen, shallRedirectToNews } from '../../apps/news/news.version';

import { autoConfInitiateConfiguration } from '~/common/logic/autoconf';
import { navigateToNews, ROUTE_APP_CHAT } from '~/common/app.routes';
import { useNextLoadProgress } from '~/common/components/useNextLoadProgress';


export function ProviderBootstrapLogic(props: { children: React.ReactNode }) {

  // external state
  const { route, events } = useRouter();

  // wire-up the NextJS router to a loading bar to be displayed while routes change
  useNextLoadProgress(route, events);


  // [bootup] logic
  const isOnChat = route === ROUTE_APP_CHAT;
  const doRedirectToNews = isOnChat && shallRedirectToNews();

  // [autoconf] initiate the llm auto-configuration process if on the chat
  const doAutoConf = isOnChat && !doRedirectToNews;
  React.useEffect(() => {
    doAutoConf && autoConfInitiateConfiguration();
  }, [doAutoConf]);


  // redirect Chat -> News if fresh news
  const isRedirecting = React.useMemo(() => {
    if (doRedirectToNews) {
      // the async is important (esp. on strict mode second pass)
      navigateToNews().then(() => markNewsAsSeen());
      return true;
    }
    return false;
  }, [doRedirectToNews]);


  return isRedirecting ? null : props.children;
}