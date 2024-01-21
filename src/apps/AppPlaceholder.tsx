import * as React from 'react';

import { Box, Typography } from '@mui/joy';

import { capitalizeFirstLetter } from '~/common/util/textUtils';
import { useRouterRoute } from '~/common/app.routes';


/**
 * https://github.com/enricoros/big-AGI/issues/299
 */
export function AppPlaceholder(props: { text?: string }) {

  // external state
  const route = useRouterRoute();

  // derived state
  const placeholderAppName = capitalizeFirstLetter(route.replace('/', '') || 'Home');

  return (
    <Box sx={{
      flexGrow: 1,
      overflowY: 'auto',
      p: { xs: 3, md: 6 },
      border: '1px solid blue',
    }}>

      <Box sx={{
        my: 'auto',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 4,
        border: '1px solid red',
      }}>

        <Typography level='h1'>
          {placeholderAppName}
        </Typography>
        <Typography>
          {props.text || 'Intelligent applications to help you learn, think, and do'}
        </Typography>

      </Box>

    </Box>
  );
}