import * as React from 'react';

import { Box, IconButton, Tooltip } from '@mui/joy';
import { ColorPaletteProp, SxProps, VariantProp } from '@mui/joy/styles/types';
import AutoModeIcon from '@mui/icons-material/AutoMode';


const micContinuationLegend =
  <Box sx={{ px: 1, py: 0.75, lineHeight: '1.5rem' }}>
    Voice Continuation
  </Box>;


export const ButtonMicContinuationMemo = React.memo(ButtonMicContinuation);

function ButtonMicContinuation(props: { variant: VariantProp, color: ColorPaletteProp, onClick: () => void, sx?: SxProps }) {
  return <Tooltip placement='bottom' title={micContinuationLegend}>
    <IconButton variant={props.variant} color={props.color} onClick={props.onClick} sx={props.sx}>
      <AutoModeIcon />
    </IconButton>
  </Tooltip>;
}