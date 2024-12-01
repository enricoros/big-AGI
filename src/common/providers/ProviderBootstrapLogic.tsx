import * as React from 'react';
import { useRouter } from 'next/router';

import { markNewsAsSeen, shallRedirectToNews, sherpaReconfigureBackendModels, sherpaStorageMaintenanceNoChats_delayed } from '~/common/logic/store-logic-sherpa';
import { navigateToNews, ROUTE_APP_CHAT } from '~/common/app.routes';
import { preloadTiktokenLibrary } from '~/common/tokens/tokens.text';
import { useNextLoadProgress } from '~/common/components/useNextLoadProgress';


export function ProviderBootstrapLogic(props: { children: React.ReactNode }) {

  // external state
  const { route, events } = useRouter();

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
  const launchPreload = isOnChat && !isRedirectingToNews;
  const launchAutoConf = isOnChat && !isRedirectingToNews;
  const launchStorageGC = true;


  // [preload] kick-off a preload of the Tiktoken library right when proceeding to the UI
  React.useEffect(() => {
    if (!launchPreload) return;

    void preloadTiktokenLibrary(); // fire/forget (large WASM payload)

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
