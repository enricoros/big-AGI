import * as React from 'react';

import { Box, Card, CardContent } from '@mui/joy';

import { DallESettings } from '~/modules/t2i/dalle/DallESettings';
import { ProdiaSettings } from '~/modules/t2i/prodia/ProdiaSettings';

import type { TextToImageProvider } from '~/common/components/useCapabilities';

import { ProviderSelect } from './components/ProviderSelect';


export function TextToImage(props: {
  providers: TextToImageProvider[],
  activeProviderId: string | null,
  setActiveProviderId: (providerId: (string | null)) => void
}) {


  // derived state
  const { provider, ProviderConfig } = React.useMemo(() => {
    const provider = props.providers.find(provider => provider.id === props.activeProviderId);
    const ProviderConfig: React.FC | null = provider?.vendor === 'openai' ? DallESettings : provider?.vendor === 'prodia' ? ProdiaSettings : null;
    return {
      provider,
      ProviderConfig,
    };
  }, [props.providers, props.activeProviderId]);


  return <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

    <Box sx={{ display: 'flex', gap: 3 }}>
      <ProviderSelect {...props} />
    </Box>

    {!!ProviderConfig &&
      <Card variant='outlined'>
        <CardContent sx={{ gap: 2 }}>
          <ProviderConfig />
        </CardContent>
      </Card>}

  </Box>;
}