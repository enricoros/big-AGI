import * as React from 'react';
import { useRouter } from 'next/router';

import { getChatTokenCountingMethod } from '../../apps/chat/store-app-chat';

import { logger } from '~/common/logger/logger.client';
import { markNewsAsSeen, shallRedirectToNews, sherpaReconfigureBackendModels, sherpaStorageMaintenanceNoChats_delayed } from '~/common/logic/store-logic-sherpa';
import { navigateToNews, ROUTE_APP_CHAT } from '~/common/app.routes';
import { preloadTiktokenLibrary } from '~/common/tokens/tokens.text';
import { useClientLoggerInterception } from '~/common/logger/hooks/useClientLoggerInterception';
import { useNextLoadProgress } from '~/common/components/useNextLoadProgress';


export function ProviderBootstrapLogic(props: { children: React.ReactNode }) {

  // external state
  const { route, events } = useRouter();

  // AUTO-LOG events from this scope on; note that we are past the Sherpas
  useClientLoggerInterception(true, false);

  // wire-up the NextJS router to a loading bar to be displayed while routes change
  useNextLoadProgress(route, events);


  // [boot-up] logic
  const isOnChat = route === ROUTE_APP_CHAT;
  const doRedirectToNews = isOnChat && shallRedirectToNews();


  // redirect Chat -> News if fresh news
  const isRedirectingToNews = React.useMemo(() => {
    if (doRedirectToNews) {
      navigateToNews().then(() => markNewsAsSeen()).catch(console.error);
      return true;
    }
    return false;
  }, [doRedirectToNews]);


  // decide what to launch
  const launchPreload = isOnChat && !isRedirectingToNews && getChatTokenCountingMethod() === 'accurate'; // only preload if using TikToken by default
  const launchAutoConf = isOnChat && !isRedirectingToNews;
  const launchStorageGC = true;


  // [preload] kick-off a preload of the Tiktoken library right when proceeding to the UI
  React.useEffect(() => {
    if (!launchPreload) return;

    void preloadTiktokenLibrary() // fire/forget (large WASM payload)
      .catch(err => {
        // Suppress WebAssembly loading errors - app will fall back to approximate counting
        // These commonly occur when users navigate away or have slow connections
        logger.debug('Tiktoken preload failed (expected on slow/interrupted loads)', err, 'client', {
          skipReporting: true, // Don't send to PostHog - this is a benign error
        });
      });

  }, [launchPreload]);

  // [autoconf] initiate the llm auto-configuration process if on the chat
  React.useEffect(() => {
    if (!launchAutoConf) return;

    void sherpaReconfigureBackendModels(); // fire/forget (background server-driven model reconfiguration)

  }, [launchAutoConf]);

  // storage maintenance and garbage collection
  React.useEffect(() => {
    if (!launchStorageGC) return;

    const timeout = setTimeout(sherpaStorageMaintenanceNoChats_delayed, 1000);
    return () => clearTimeout(timeout);

  }, [launchStorageGC]);

  //
  // Render Gates
  //

  if (isRedirectingToNews)
    return null;

  return props.children;
}
