import * as React from 'react';

import { useRouterQuery } from '~/common/app.routes';
import { Box } from '@mui/joy';

import { DrawHeading } from './components/DrawHeading';
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
      px: { xs: 3, md: 6 },
    }}>

      <DrawHeading />

      <TextToImage />

      <Gallery />

    </Box>
  );
}