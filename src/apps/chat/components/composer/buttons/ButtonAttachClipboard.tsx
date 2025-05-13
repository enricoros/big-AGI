import * as React from 'react';

import { Box, Button, ColorPaletteProp, IconButton, Tooltip } from '@mui/joy';
import ContentPasteGoIcon from '@mui/icons-material/ContentPasteGo';

import { KeyStroke } from '~/common/components/KeyStroke';
import { buttonAttachSx } from '~/common/components/ButtonAttachFiles';


export const ButtonAttachClipboardMemo = React.memo(ButtonAttachClipboard);

function ButtonAttachClipboard(props: {
  color?: ColorPaletteProp,
  isMobile?: boolean,
  disabled?: boolean,
  fullWidth?: boolean,
  noToolTip?: boolean,
  onAttachClipboard: () => void,
}) {
  return props.isMobile ? (
    <IconButton color={props.color} disabled={props.disabled} onClick={props.onAttachClipboard}>
      <ContentPasteGoIcon />
    </IconButton>
  ) : (
    <Tooltip arrow disableInteractive placement='top-start' title={props.noToolTip ? null : (
      <Box sx={buttonAttachSx.tooltip}>
        <b>Attach clipboard 📚</b><br />
        Auto-converts to the best types<br />
        <KeyStroke combo='Ctrl + Shift + V' sx={{ mt: 1, mb: 0.5 }} />
      </Box>
    )}>
      <Button
        variant={props.color ? 'soft' : 'plain'}
        color={props.color || 'neutral'}
        disabled={props.disabled}
        fullWidth={props.fullWidth}
        startDecorator={<ContentPasteGoIcon />}
        onClick={props.onAttachClipboard}
        sx={buttonAttachSx.desktop}
      >
        Paste
      </Button>
    </Tooltip>
  );
}
