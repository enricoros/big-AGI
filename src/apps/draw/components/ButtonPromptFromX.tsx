import * as React from 'react';

import { Button } from '@mui/joy';
import InsertPhotoOutlinedIcon from '@mui/icons-material/InsertPhotoOutlined';
import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined';

export function ButtonPromptFromX(props: { isMobile?: boolean, name: string, disabled?: boolean }) {
  return props.isMobile ? null : (
    <Button
      disabled={props.disabled}
      fullWidth variant='soft' color='neutral'
      startDecorator={props.name === 'Chats' ? <ChatOutlinedIcon /> : <InsertPhotoOutlinedIcon />}
      sx={{
        justifyContent: 'flex-start',
        transition: 'background-color 0.2s, color 0.2s',
        minWidth: 160,
      }}>
      {props.name}
    </Button>
  );
}