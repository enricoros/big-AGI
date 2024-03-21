import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, IconButton, Tooltip } from '@mui/joy';
import { ChatBeamIcon } from '~/common/components/icons/ChatBeamIcon';


const beamLegend =
  <Box sx={{ px: 1, py: 0.75, lineHeight: '1.5rem' }}>
    Combine the answers from multiple models
  </Box>;

const mobileSx: SxProps = {
  mr: { xs: 1, md: 2 },
};

const desktopSx: SxProps = {
  '--Button-gap': '1rem',
};


export const ButtonBeamMemo = React.memo(ButtonBeam);

function ButtonBeam(props: { isMobile?: boolean, disabled?: boolean, onClick: () => void }) {
  return props.isMobile ? (
    <IconButton variant='soft' color='primary' disabled={props.disabled} onClick={props.onClick} sx={mobileSx}>
      <ChatBeamIcon />
    </IconButton>
  ) : (
    <Tooltip disableInteractive variant='solid' arrow placement='right' title={beamLegend}>
      <Button variant='soft' color='success' disabled={props.disabled} onClick={props.onClick} endDecorator={<ChatBeamIcon />} sx={desktopSx}>
        Beam
      </Button>
    </Tooltip>
  );
}