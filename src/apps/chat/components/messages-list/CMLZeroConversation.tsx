import * as React from 'react';

import { Alert, Button } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';


export function CMLZeroConversation(props: {
  onConversationNew: (forceNoRecycle: boolean, isIncognito: boolean) => void,
}) {
  return (
    <Alert
      variant='soft'
      startDecorator={
        <Button
          variant='soft'
          onClick={() => props.onConversationNew(true, false)}
          startDecorator={<AddIcon />}
          sx={{
            border: '1px solid',
            borderColor: 'primary.outlinedBorder',
            borderRadius: 'sm',
          }}
        >
          New chat
        </Button>
      }
      sx={{
        m: 2,
        // justifyContent: 'center',
      }}
    >
      Please select or create a conversation.
    </Alert>
  );
}