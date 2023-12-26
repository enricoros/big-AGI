import * as React from 'react';

import { Box, Container } from '@mui/joy';


export function PlainLayout(props: { children?: React.ReactNode }) {
  return <>

    {/* Headers as needed */}

    <Container disableGutters>
      <Box sx={{
        display: 'flex', flexDirection: 'column',
        minHeight: '100dvh',
      }}>

        {props.children}

      </Box>
    </Container>

    {/* Footers as needed */}

  </>;
}