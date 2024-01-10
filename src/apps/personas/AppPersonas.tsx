import * as React from 'react';

import { Container, ListDivider, Sheet, Typography } from '@mui/joy';

import { themeBgApp } from '~/common/app.theme';

import { PersonaCreator } from './PersonaCreator';
import { Creator } from './creator/Creator';


export function AppPersonas() {
  return (
    <Sheet sx={{
      flexGrow: 1,
      overflowY: 'auto',
      backgroundColor: themeBgApp,
      p: { xs: 3, md: 6 },
    }}>

      <Container disableGutters maxWidth='md' sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>

        <Typography level='title-lg' sx={{ textAlign: 'center' }}>
          AI Personas Creator
        </Typography>

        <ListDivider sx={{ my: 2 }} />

        <Creator />

      </Container>

    </Sheet>
  );
}