import * as React from 'react';

import { Container, Sheet } from '@mui/joy';

import type { DConversationId } from '~/common/state/store-chats';
import { useRouterQuery } from '~/common/app.routes';

import { CallWizard } from './CallWizard';
import { Contacts } from './Contacts';
import { Telephone } from './Telephone';
import { useAppCallStore } from './state/store-app-call';


/**
 * Used to define the intent of the call from other apps (via query params) or
 * from the contacts list (via the 'call' button).
 */
export interface AppCallIntent {
  conversationId: DConversationId | null;
  personaId: string;
  backTo: 'app-chat' | 'app-call-contacts';
}


export function AppCall() {

  // state
  const [callIntent, setCallIntent] = React.useState<AppCallIntent | null>(null);

  // external state
  const grayUI = useAppCallStore(state => state.grayUI);
  const query = useRouterQuery<Partial<AppCallIntent>>();


  // [effect] set intent from the query parameters
  React.useEffect(() => {
    if (query.personaId) {
      setCallIntent({
        conversationId: query.conversationId ?? null,
        personaId: query.personaId,
        backTo: query.backTo || 'app-chat',
      });
    }
  }, [query.backTo, query.conversationId, query.personaId]);


  const hasIntent = !!callIntent && !!callIntent.personaId;

  return (
    <Sheet
      variant={grayUI ? 'solid' : 'soft'}
      invertedColors={grayUI ? true : undefined}
      sx={{
        // take the full V-area (we're inside PageWrapper) and scroll as needed
        flexGrow: 1,
        overflowY: 'auto',

        // container will take the full v-area
        display: 'grid',
      }}>

      <Container
        maxWidth={hasIntent ? 'sm' : 'md'}
        sx={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: hasIntent ? 'space-evenly' : undefined,
          gap: hasIntent ? 1 : undefined,
          // shall force the contacts or telephone to stay within the container
          overflowY: hasIntent ? 'hidden' : undefined,
        }}>

        {!hasIntent ? (
          <Contacts setCallIntent={setCallIntent} />
        ) : (
          <CallWizard conversationId={callIntent.conversationId}>
            <Telephone callIntent={callIntent} backToContacts={() => setCallIntent(null)} />
          </CallWizard>
        )}

      </Container>

    </Sheet>
  );
}