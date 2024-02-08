import * as React from 'react';

import { useBackendCapsKnowledge } from '~/modules/backend/state-backend';

import { apiQuery } from '~/common/util/trpc.client';
import { preloadTiktokenLibrary } from '~/common/util/token-counter';


/**
 * Note: we used to have a NoSSR wrapper inside the AppLayout component (which was delaying rendering 1 cycle),
 * however this wrapper is now providing the same function, given the network roundtrip.
 */
export function ProviderBackendAndNoSSR(props: { children: React.ReactNode }) {

  // external state
  const [haveCapabilities, setCapabilties] = useBackendCapsKnowledge();

  // load from the backend
  const { data: capabilities } = apiQuery.backend.listCapabilities.useQuery(undefined, {
    staleTime: 1000 * 60 * 60 * 24, // 1 day
  });


  // [effect] copy from the backend (capabilities) to the state (setCapabilties)
  React.useEffect(() => {
    if (capabilities)
      setCapabilties(capabilities);
  }, [capabilities, setCapabilties]);


  // [effect] in parallel preload the Tiktoken library - large WASM payload, so fire/forget
  React.useEffect(() => {
    void preloadTiktokenLibrary();
  }, []);


  // block rendering until the capabilities are loaded
  return !haveCapabilities ? null : props.children;
}