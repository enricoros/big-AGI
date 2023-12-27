import * as React from 'react';


export function ProviderBootstrapLogic(props: { children: React.ReactNode }) {

  // NOTE: just a pass-through for now. Will be used for the following:
  //  - loading the latest news (see ChatPage -> useRedirectToNewsOnUpdates)
  //  - loading the commander
  //  - ...

  // startup logic
  // React.useEffect(() => {
  // }, []);

  return props.children;
}