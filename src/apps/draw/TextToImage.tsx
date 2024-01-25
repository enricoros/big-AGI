import * as React from 'react';

import { Box } from '@mui/joy';

import type { TextToImageProvider } from '~/common/components/useCapabilities';

import { PromptDesigner } from './components/PromptDesigner';
import { ProviderConfigure } from './components/ProviderConfigure';


export function TextToImage(props: {
  isMobile: boolean,
  providers: TextToImageProvider[],
  activeProviderId: string | null,
  setActiveProviderId: (providerId: (string | null)) => void
}) {


  // usePluggableOptimaLayout(null, null, null, 'aa');

  return <>

    <ProviderConfigure
      providers={props.providers}
      activeProviderId={props.activeProviderId}
      setActiveProviderId={props.setActiveProviderId}
      sx={{
        p: { xs: 1, md: 2 },
      }}
    />

    {/* Placeholder */}
    <Box sx={{
      flexGrow: 1,
      overflowY: 'auto',
      backgroundColor: 'background.level2',
      // border: '1px solid blue',
      p: { xs: 1, md: 2 },
    }}>
      <Box sx={{
        my: 'auto',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 4,
        border: '1px solid red',
        minHeight: '300px',
      }} />
    </Box>

    <PromptDesigner
      isMobile={props.isMobile}
      sx={{
        borderTop: `1px solid`,
        borderTopColor: 'divider',
        p: { xs: 1, md: 2 },
      }}
    />

  </>;
}