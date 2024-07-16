import * as React from 'react';

import { Box, Container, Typography } from '@mui/joy';


export function AppSmallContainer({ title, description, children }: {
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ flexGrow: 1, overflowY: 'auto', p: { xs: 3, md: 6 } }}>

      <Container disableGutters maxWidth='md' sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

        <Box sx={{ mb: 2 }}>
          <Typography level='h1' sx={{ mb: 1 }}>{title}</Typography>
          <Typography>{description}</Typography>
        </Box>

        {children}

      </Container>

    </Box>
  );
}
