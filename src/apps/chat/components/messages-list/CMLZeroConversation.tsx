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
    maxWidth: 220,
    p: 2,
    // backgroundColor: 'background.popup',
    borderRadius: 'xl',

    display: 'flex',
    flexDirection: 'column',
    gap: 1.5,
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
        <Typography level='body-xs'>
          Please <>select a conversation</> from
          the left pane, <>branch</> a chat,
          or create a new one.
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