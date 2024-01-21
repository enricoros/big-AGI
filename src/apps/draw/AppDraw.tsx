import * as React from 'react';

import { useRouterQuery } from '~/common/app.routes';
import { Box, Chip, IconButton, Typography } from '@mui/joy';
import FormatPaintIcon from '@mui/icons-material/FormatPaint';

import { T2ISettings } from '~/modules/t2i/T2ISettings';

import { AppPlaceholder } from '../AppPlaceholder';
import { niceShadowKeyframes } from '../call/Contacts';


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

      // container will take the full v-area
      px: { xs: 3, md: 6 },
      // display: 'grid',
    }}>

      {/* Header "Call AGI" */}
      <Box sx={{
        my: 6,
        display: 'flex', alignItems: 'center',
        gap: 3,
      }}>
        <IconButton
          variant='soft' color='success'
          sx={{
            '--IconButton-size': { xs: '4.2rem', md: '5rem' },
            borderRadius: '50%',
            pointerEvents: 'none',
            backgroundColor: 'background.popup',
            animation: `${niceShadowKeyframes} 5s infinite`,
          }}>
          <FormatPaintIcon />
        </IconButton>

        <Box>
          <Typography level='title-lg'>
            Draw with AI
          </Typography>
          <Typography level='title-sm' sx={{ mt: 1 }}>
            Turn your ideas into images
          </Typography>
          <Chip variant='outlined' size='sm' sx={{ px: 1, py: 0.5, mt: 0.25, ml: -1, textWrap: 'wrap' }}>
            Multi-models, AI assisted
          </Chip>
        </Box>
      </Box>

      <T2ISettings />

      <AppPlaceholder text='Drawing App is under development. v1.12 or v1.13.' />

    </Box>
  );
}