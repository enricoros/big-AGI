import * as React from 'react';

import { useKnowledgeOfBackendCaps } from '~/modules/backend/store-backend-capabilities';

import { apiQuery } from '~/common/util/trpc.client';
import { preloadTiktokenLibrary } from '~/common/util/token-counter';


// configuration
const BACKEND_WARNING_TIMEOUT = 5000;


/**
 * Note: we used to have a NoSSR wrapper inside the AppLayout component (which was delaying rendering 1 cycle),
 * however this wrapper is now providing the same function, given the network roundtrip.
 */
export function ProviderBackendCapabilities(props: { children: React.ReactNode }) {

  // state
  const [backendTimeout, setBackendTimeout] = React.useState(false);

  // external state
  const [haveCapabilities, storeBackendCapabilities] = useKnowledgeOfBackendCaps();


  // fetch capabilities
  const { data } = apiQuery.backend.listCapabilities.useQuery(undefined, {
    staleTime: 1000 * 60 * 60 * 24, // 1 day
  });


  // [effect] copy from the backend capabilities payload to the frontend state store
  React.useEffect(() => {
    if (data)
      storeBackendCapabilities(data);
  }, [data, storeBackendCapabilities]);

  // [effect] warn if the backend is not available
  React.useEffect(() => {
    if (!haveCapabilities) {
      const timeout = setTimeout(() => setBackendTimeout(true), BACKEND_WARNING_TIMEOUT);
      return () => clearTimeout(timeout);
    }
  }, [haveCapabilities]);

  // [effect] then preload the Tiktoken library right when proceeding to the UI
  React.useEffect(() => {
    // large WASM payload, so fire/forget
    if (haveCapabilities)
      void preloadTiktokenLibrary();
  }, [haveCapabilities]);


  // create components after the capabilities are loaded
  return haveCapabilities ? props.children
    : backendTimeout ? <div style={{ textAlign: 'center', marginBlock: '3rem' }}>Cannot esablish a connection with the application server.</div>
      : null;
}