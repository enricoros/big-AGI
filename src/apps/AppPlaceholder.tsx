import * as React from 'react';

import { Box, Typography } from '@mui/joy';

import { capitalizeFirstLetter } from '~/common/util/textUtils';
import { useRouterRoute } from '~/common/app.routes';


/**
 * https://github.com/enricoros/big-AGI/issues/299
 */
export function AppPlaceholder(props: {
  title?: string | null,
  text?: React.ReactNode,
  children?: React.ReactNode,
}) {

  // external state
  const route = useRouterRoute();

  // derived state
  const placeholderAppName = props.title || capitalizeFirstLetter(route.replace('/', '') || 'Home');

  return (
    <Box sx={{
      flexGrow: 1,
      overflowY: 'auto',
      p: { xs: 3, md: 6 },
      border: '1px solid blue',
    }}>

      {(props.title !== null || !!props.text) && (
        <Box sx={{
          my: 'auto',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 4,
          border: '1px solid red',
        }}>

          <Typography level='h1'>
            {placeholderAppName}
          </Typography>
          {!!props.text && (
            <Typography>
              {props.text}
            </Typography>
          )}

        </Box>
      )}

      {props.children}

    </Box>
  );
}