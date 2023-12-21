import * as React from 'react';

import { Box, Container, ListDivider, Sheet, Typography } from '@mui/joy';

import { PersonaCreator } from './PersonaCreator';
import ScienceIcon from '@mui/icons-material/Science';


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
          AI Personas Creator
        </Typography>

        <ListDivider sx={{ my: 2 }} />

        <PersonaCreator />

      </Container>

    </Sheet>
  );
}