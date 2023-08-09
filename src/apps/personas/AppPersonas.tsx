import * as React from 'react';

import { Container, ListDivider, Sheet, Typography } from '@mui/joy';

import { YTPersonaCreator } from './YTPersonaCreator';


export function AppPersonas() {
  return (
    <Sheet sx={{
      flexGrow: 1,
      overflowY: 'auto',
      backgroundColor: 'background.level1',
      p: { xs: 3, md: 6 },
    }}>

      <Container disableGutters maxWidth='md' sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>

        <Typography level='title-lg' sx={{ textAlign: 'center' }}>
          Advanced AI Personas
        </Typography>

        <ListDivider sx={{ my: 3 }} />

        <YTPersonaCreator />

      </Container>

    </Sheet>
  );
}