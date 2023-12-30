import * as React from 'react';

import { Button, IconButton } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import FormatPaintIcon from '@mui/icons-material/FormatPaint';


export function ButtonOptionsDraw(props: { isMobile?: boolean, onClick: () => void, sx?: SxProps }) {
  return props.isMobile ? (
    <IconButton variant='soft' color='warning' onClick={props.onClick} sx={props.sx}>
      <FormatPaintIcon />
    </IconButton>
  ) : (
    <Button variant='soft' color='warning' onClick={props.onClick} sx={props.sx}>
      Options
    </Button>
  );
}