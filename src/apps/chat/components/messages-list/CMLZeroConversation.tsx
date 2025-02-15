import * as React from 'react';

import { Box, Button, Sheet, Typography } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';


const _styles = {
  center: {
    mx: 'auto',
    mt: 6.5, // roughly matches the 'AI Persona' buttons
    // my: 'auto',
  } as const,

  sheet: {
    p: 1.5,
    borderRadius: 'sm',
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  } as const,

  button: {
    // width: '100%',
    border: '1px solid',
    borderColor: 'neutral.outlinedBorder',
    borderRadius: 'sm',
    justifyContent: 'start',
  } as const,
} as const;


export function CMLZeroConversation(props: {
  onConversationNew: (forceNoRecycle: boolean, isIncognito: boolean) => void,
}) {
  return (
    <Box sx={_styles.center}>
      <Sheet
        variant='outlined'
        sx={_styles.sheet}
      >
        <Typography level='body-sm'>
          Please select or create<br />
          a conversation.
        </Typography>
        <Button
          variant='soft'
          onClick={() => props.onConversationNew(true, false)}
          startDecorator={<AddIcon />}
          sx={_styles.button}
        >
          New chat
        </Button>
      </Sheet>
    </Box>
  );
}