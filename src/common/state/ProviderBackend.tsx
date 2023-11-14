import * as React from 'react';

import { useBackendCapsLoader } from '~/modules/backend/state-backend';

import { apiQuery } from '~/common/util/trpc.client';


export function ProviderBackend(props: { children: React.ReactNode }) {

  // external state
  const [loaded, setCapabilties] = useBackendCapsLoader();


  // load from the backend
  const { data: capabilities } = apiQuery.backend.listCapabilities.useQuery(undefined, {
    staleTime: 1000 * 60 * 60 * 24, // 1 day
  });

  // update the state
  React.useEffect(() => {
    if (capabilities)
      setCapabilties(capabilities);
  }, [capabilities, setCapabilties]);


  // block rendering until the capabilities are loaded
  return !loaded ? null : props.children;
}