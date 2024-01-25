import * as React from 'react';

import { Box, Button, Card, CardContent } from '@mui/joy';
import ConstructionIcon from '@mui/icons-material/Construction';

import { DallESettings } from '~/modules/t2i/dalle/DallESettings';
import { ProdiaSettings } from '~/modules/t2i/prodia/ProdiaSettings';

import type { TextToImageProvider } from '~/common/components/useCapabilities';

import { ProviderSelect } from './components/ProviderSelect';
import { PromptDesigner } from './components/PromptDesigner';


export function TextToImage(props: {
  isMobile: boolean,
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


  return <>

    <Box sx={{ flex: 0, display: 'grid' }}>

      {/* Service / Options Button */}
      <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1 }}>
        <ProviderSelect {...props} />
        <Button
          variant={settingsShown ? 'solid' : 'outlined'}
          color={settingsShown ? 'primary' : 'neutral'}
          endDecorator={<ConstructionIcon />}
          onClick={handleToggleProviderSettings}
          sx={{ backgroundColor: settingsShown ? undefined : 'background.surface' }}
        >
          Options
        </Button>
      </Box>

      {/* Options */}
      {settingsShown && (
        <Card variant='outlined' sx={{ my: 1, borderTopColor: 'primary.softActiveBg' }}>
          <CardContent sx={{ gap: 2 }}>
            <ProviderConfig />
          </CardContent>
        </Card>
      )}

    </Box>


    {/* Main */}
    <Box sx={{
      flexGrow: 1,
      // overflowY: 'auto',
      border: '1px solid blue',
    }}>

      <Box sx={{
        my: 'auto',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 4,
        border: '1px solid red',
        minHeight: '300px',
      }}>
        a
      </Box>

    </Box>

    {/* Prompt Designer */}
    <PromptDesigner isMobile={props.isMobile} />

  </>;
}