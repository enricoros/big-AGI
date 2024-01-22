import * as React from 'react';

import { Box } from '@mui/joy';

import type { TextToImageProvider } from '~/common/components/useCapabilities';

import { ProviderSelect } from './components/ProviderSelect';


export function TextToImage(props: {
  providers: TextToImageProvider[],
  activeProviderId: string | null,
  setActiveProviderId: (providerId: (string | null)) => void
}) {


  // derived state
  const { provider } = React.useMemo(() => {
    const provider = props.providers.find(provider => provider.id === props.activeProviderId);
    return {
      provider,
    };
  }, [props.providers, props.activeProviderId]);


  return <>

    {/* Service selector */}
    <Box sx={{ display: 'flex', gap: 2 }}>
      <ProviderSelect {...props} />
    </Box>

    {/* Service configuration (Globals) */}
    {JSON.stringify(provider)}


  </>;
}