import * as React from 'react';

import { Box, IconButton } from '@mui/joy';
import { ColorPaletteProp, VariantProp } from '@mui/joy/styles/types';
import MicIcon from '@mui/icons-material/Mic';

import { GoodTooltip } from '~/common/components/GoodTooltip';
import { KeyStroke } from '~/common/components/KeyStroke';


const micLegend =
  <Box sx={{ px: 1, py: 0.75, lineHeight: '1.5rem' }}>
    Voice input<br />
    <KeyStroke combo='Ctrl + M' sx={{ mt: 1, mb: 0.5 }} />
  </Box>;


export const ButtonMicMemo = React.memo(ButtonMic);

function ButtonMic(props: { variant: VariantProp, color: ColorPaletteProp, noBackground?: boolean, onClick: () => void }) {
  return <GoodTooltip placement='top' title={micLegend}>
    <IconButton variant={props.variant} color={props.color} onClick={props.onClick} sx={props.noBackground ? { background: 'none' } : {}}>
      <MicIcon />
    </IconButton>
  </GoodTooltip>;
}