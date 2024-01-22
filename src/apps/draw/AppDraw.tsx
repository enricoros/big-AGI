import * as React from 'react';

import { Box } from '@mui/joy';

import { useCapabilityTextToImage } from '~/modules/t2i/t2i.client';
import { useRouterQuery } from '~/common/app.routes';

import { DrawHeading } from './components/DrawHeading';
import { DrawUnconfigured } from './components/DrawUnconfigured';
import { Gallery } from './Gallery';
import { TextToImage } from './TextToImage';


export interface AppDrawIntent {
  backTo: 'app-chat';
}


export function AppDraw() {

  // state
  const [drawIntent, setDrawIntent] = React.useState<AppDrawIntent | null>(null);

  // external state
  const query = useRouterQuery<Partial<AppDrawIntent>>();
  const { activeProviderId, mayWork, providers, setActiveProviderId } = useCapabilityTextToImage();


  // [effect] set intent from the query parameters
  React.useEffect(() => {
    if (query.backTo) {
      setDrawIntent({
        backTo: query.backTo || 'app-chat',
      });
    }
  }, [query]);

  // const hasIntent = !!drawIntent && !!drawIntent.backTo;

  return (
    <Box sx={{
      // take the full V-area (we're inside PageWrapper) and scroll as needed
      flexGrow: 1,
      overflowY: 'auto',

      // contents margin
      display: 'flex', flexDirection: 'column',
      p: { xs: 3, md: 6 },
      gap: { xs: 3, md: 6 },
    }}>

      <DrawHeading />

      {!mayWork && <DrawUnconfigured />}

      {mayWork && (
        <TextToImage
          providers={providers}
          activeProviderId={activeProviderId}
          setActiveProviderId={setActiveProviderId}
        />
      )}

      <Gallery />

    </Box>
  );
}