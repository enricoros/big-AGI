import * as React from 'react';

import { Box, Button, Card, CardContent } from '@mui/joy';
import ConstructionIcon from '@mui/icons-material/Construction';

import { DallESettings } from '~/modules/t2i/dalle/DallESettings';
import { ProdiaSettings } from '~/modules/t2i/prodia/ProdiaSettings';

import type { TextToImageProvider } from '~/common/components/useCapabilities';

import { ProviderSelect } from './components/ProviderSelect';


export function TextToImage(props: {
  providers: TextToImageProvider[],
  activeProviderId: string | null,
  setActiveProviderId: (providerId: (string | null)) => void
}) {

  // state
  const [showProviderSettings, setShowProviderSettings] = React.useState(false);


  // derived state
  const { provider, ProviderConfig } = React.useMemo(() => {
    const provider = props.providers.find(provider => provider.id === props.activeProviderId);
    const ProviderConfig: React.FC | null = provider?.vendor === 'openai' ? DallESettings : provider?.vendor === 'prodia' ? ProdiaSettings : null;
    return {
      provider,
      ProviderConfig,
    };
  }, [props.providers, props.activeProviderId]);
  const settingsShown = showProviderSettings && !!ProviderConfig;


  const handleToggleProviderSettings = React.useCallback(() => {
    setShowProviderSettings(on => !on);
  }, [setShowProviderSettings]);


  return <Box sx={{ display: 'flex', flexDirection: 'column' }}>

    {/* Service */}
    <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2 }}>
      <ProviderSelect {...props} />
      <Button
        variant={settingsShown ? 'solid' : 'outlined'}
        endDecorator={<ConstructionIcon />}
        onClick={handleToggleProviderSettings}
      >
        Options
      </Button>
    </Box>

    {/* Service Settings */}
    {settingsShown && (
      <Card variant='outlined' sx={{ my: 1, borderTopColor: 'primary.softActiveBg' }}>
        <CardContent sx={{ gap: 2 }}>
          <ProviderConfig />
        </CardContent>
      </Card>
    )}

  </Box>;
}