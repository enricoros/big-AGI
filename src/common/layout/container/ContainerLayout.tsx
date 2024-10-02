import * as React from 'react';

import { Box, Container } from '@mui/joy';

import { themeBgApp } from '~/common/app.theme';


export function ContainerLayout(props: { children?: React.ReactNode }) {
  return <>

    {/* Headers as needed */}

    <Container disableGutters>
      <Box sx={{
        backgroundColor: themeBgApp,
        display: 'flex', flexDirection: 'column',
        minHeight: '100dvh',
      }}>

        {props.children}

      </Box>
    </Container>

    {/* Footers as needed */}

  </>;
}