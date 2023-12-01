import * as React from 'react';
import { useRouter } from 'next/router';

import { Container, Sheet } from '@mui/joy';

import { AppCallQueryParams } from '~/common/app.routes';
import { InlineError } from '~/common/components/InlineError';

import { CallUI } from './CallUI';
import { CallWizard } from './CallWizard';


export function AppCall() {
  // external state
  const { query } = useRouter();

  // derived state
  const { conversationId, personaId } = query as any as AppCallQueryParams;
  const validInput = !!conversationId && !!personaId;

  return (
    <Sheet variant='solid' color='neutral' invertedColors sx={{
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      flexGrow: 1,
      overflowY: 'auto',
      minHeight: 96,
    }}>

      <Container maxWidth='sm' sx={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center',
        minHeight: '80dvh', justifyContent: 'space-evenly',
        gap: { xs: 2, md: 4 },
      }}>

        {!validInput && <InlineError error={`Something went wrong. ${JSON.stringify(query)}`} />}

        {validInput && (
          <CallWizard conversationId={conversationId}>
            <CallUI conversationId={conversationId} personaId={personaId} />
          </CallWizard>
        )}

      </Container>

    </Sheet>
  );
}