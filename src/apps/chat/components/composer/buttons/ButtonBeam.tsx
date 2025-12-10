import * as React from 'react';

import type { ColorPaletteProp, SxProps } from '@mui/joy/styles/types';
import { Box, Button, IconButton, Tooltip } from '@mui/joy';

import { ChatBeamIcon } from '~/common/components/icons/ChatBeamIcon';
import { KeyStroke } from '~/common/components/KeyStroke';
import { animationEnterBelow } from '~/common/util/animUtils';
import { getBeamShortcut, KeyboardPreset } from '~/common/util/keyboardUtils';
import { useUIPreferencesStore } from '~/common/stores/store-ui';

const mobileSx: SxProps = {
  mr: { xs: 1, md: 2 },
};

const desktopSx: SxProps = {
  '--Button-gap': '1rem',
  backgroundColor: 'background.popup',
  // border: '1px solid',
  // borderColor: 'primary.outlinedBorder',
  boxShadow: '0 4px 16px -4px rgb(var(--joy-palette-primary-mainChannel) / 10%)',
  animation: `${animationEnterBelow} 0.1s ease-out`,
};


function DesktopLegend(props: { hasContent: boolean, keyboardPreset: KeyboardPreset }) {
  const beamShortcut = getBeamShortcut(props.keyboardPreset);

  if (!props.hasContent) {
    return (
      <Box sx={{ px: 1, py: 0.75, lineHeight: '1.5rem' }}>
        Enter the text to Beam, then press this
      </Box>
    );
  }

  return (
    <Box sx={{ px: 1, py: 0.75, lineHeight: '1.5rem' }}>
      Combine the answers from multiple models
      {beamShortcut && <>
        <br />
        <KeyStroke combo={beamShortcut} sx={{ mt: 0.5, mb: 0.25 }} />
      </>}
    </Box>
  );
}


export const ButtonBeamMemo = React.memo(ButtonBeam);

function ButtonBeam(props: {
  isMobile?: boolean,
  color?: ColorPaletteProp,
  disabled?: boolean,
  hasContent?: boolean,
  onClick: () => void,
}) {
  const keyboardPreset = useUIPreferencesStore(state => state.keyboardPreset);

  return props.isMobile ? (
    <IconButton variant='outlined' color={props.color ?? 'primary'} disabled={props.disabled} onClick={props.onClick} sx={mobileSx}>
      <ChatBeamIcon />
    </IconButton>
  ) : (
    <Tooltip disableInteractive variant='solid' arrow placement='right' title={<DesktopLegend hasContent={!!props.hasContent} keyboardPreset={keyboardPreset} />}>
      <Button variant='soft' color={props.color ?? 'primary'} disabled={props.disabled} onClick={props.onClick} endDecorator={<ChatBeamIcon />} sx={desktopSx}>
        Beam
      </Button>
    </Tooltip>
  );
}