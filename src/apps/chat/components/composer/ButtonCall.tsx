import * as React from 'react';

import { Box, Button, IconButton, Tooltip } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import CallIcon from '@mui/icons-material/Call';


const callConversationLegend =
  <Box sx={{ px: 1, py: 0.75, lineHeight: '1.5rem' }}>
    Quick call regarding this chat
  </Box>;

export function ButtonCall(props: { isMobile?: boolean, disabled?: boolean, onClick: () => void, sx?: SxProps }) {
  return props.isMobile ? (
    <IconButton variant='soft' color='primary' disabled={props.disabled} onClick={props.onClick} sx={props.sx}>
      <CallIcon />
    </IconButton>
  ) : (
    <Tooltip variant='solid' arrow placement='right' title={callConversationLegend}>
      <Button variant='soft' color='primary' disabled={props.disabled} onClick={props.onClick} endDecorator={<CallIcon />} sx={props.sx}>
        Call
      </Button>
    </Tooltip>
  );
}