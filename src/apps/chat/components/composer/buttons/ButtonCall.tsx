import * as React from 'react';

import { Box, Button, IconButton, Tooltip } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import CallIcon from '@mui/icons-material/Call';


const callConversationLegend =
  <Box sx={{ px: 1, py: 0.75, lineHeight: '1.5rem' }}>
    Quick call regarding this chat
  </Box>;

const mobileSx: SxProps = {
  mr: { xs: 1, md: 2 },
} as const;

const desktopSx: SxProps = {
  '--Button-gap': '1rem',
} as const;


export const ButtonCallMemo = React.memo(ButtonCall);

function ButtonCall(props: { isMobile?: boolean, disabled?: boolean, onClick: () => void }) {
  return props.isMobile ? (
    <IconButton variant='soft' color='primary' disabled={props.disabled} onClick={props.onClick} sx={mobileSx}>
      <CallIcon />
    </IconButton>
  ) : (
    <Tooltip disableInteractive variant='solid' arrow placement='right' title={callConversationLegend}>
      <Button variant='soft' color='primary' disabled={props.disabled} onClick={props.onClick} endDecorator={<CallIcon />} sx={desktopSx}>
        Call
      </Button>
    </Tooltip>
  );
}