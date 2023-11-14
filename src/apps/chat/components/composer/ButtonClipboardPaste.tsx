import * as React from 'react';

import { Box, Button, IconButton, Tooltip } from '@mui/joy';
import ContentPasteGoIcon from '@mui/icons-material/ContentPasteGo';

import { KeyStroke } from '~/common/components/KeyStroke';


const pasteClipboardLegend =
  <Box sx={{ p: 1, lineHeight: 2 }}>
    <b>Paste as 📚 Markdown attachment</b><br />
    Also converts Code and Tables<br />
    <KeyStroke combo='Ctrl + Shift + V' />
  </Box>;

export function ButtonClipboardPaste(props: { isMobile: boolean, isDeveloperMode: boolean, onPaste: () => void }) {
  return props.isMobile ? (
    <IconButton onClick={props.onPaste}>
      <ContentPasteGoIcon />
    </IconButton>
  ) : (
    <Tooltip
      variant='solid' placement='top-start'
      title={pasteClipboardLegend}>
      <Button fullWidth variant='plain' color='neutral' startDecorator={<ContentPasteGoIcon />} onClick={props.onPaste}
              sx={{ justifyContent: 'flex-start' }}>
        {props.isDeveloperMode ? 'Paste code' : 'Paste'}
      </Button>
    </Tooltip>
  );
}