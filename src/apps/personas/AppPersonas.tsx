import * as React from 'react';

import { Box, Container, ListDivider, Sheet, Typography } from '@mui/joy';

import { YTPersonaCreator } from './YTPersonaCreator';
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
          Advanced AI Personas
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <Typography>
            Experimental
          </Typography>
          <ScienceIcon color='primary' />
        </Box>

        <ListDivider sx={{ my: 2 }} />

        <YTPersonaCreator />

      </Container>

    </Sheet>
  );
}