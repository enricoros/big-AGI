import * as React from 'react';

import { Box } from '@mui/joy';

import { InlineError } from '~/common/components/InlineError';


export function Contacts(props: { personaId: string | null, setPersonaId: (personaId: string | null) => void }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-evenly' }}>
      <InlineError error='No Persona Selected' />
    </Box>
  );
}