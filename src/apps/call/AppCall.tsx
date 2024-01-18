import * as React from 'react';

import { Container, Sheet } from '@mui/joy';

import { AppCallQueryParams, useRouterQuery } from '~/common/app.routes';

import { CallWizard } from './CallWizard';
import { Contacts } from './Contacts';
import { Telephone } from './Telephone';


export function AppCall() {

  // external state
  const { conversationId, personaId: queryPersonaId } = useRouterQuery<Partial<AppCallQueryParams>>();

  // state
  const [personaId, setPersonaId] = React.useState<string | null>(queryPersonaId || null);


  // [effect] update to query params (shall be already initally loaded)
  React.useEffect(() => {
    if (queryPersonaId)
      setPersonaId(queryPersonaId);
  }, [queryPersonaId]);


  return (
    <Sheet variant='solid' color='neutral' invertedColors sx={{
      // take the full V-area (we're inside PageWrapper) and scroll as needed
      flex: 1,
      overflowY: 'auto',

      // container will take the full v-area
      display: 'grid',
    }}>

      <Container maxWidth='sm' sx={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-evenly',
        gap: { xs: 2, md: 4 },
      }}>

        {!personaId ? (
          <Contacts personaId={personaId} setPersonaId={setPersonaId} />
        ) : (
          <CallWizard conversationId={conversationId}>
            <Telephone conversationId={conversationId} personaId={personaId} />
          </CallWizard>
        )}

      </Container>

    </Sheet>
  );
}