import * as React from 'react';

import { Button, IconButton } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import FormatPaintTwoToneIcon from '@mui/icons-material/FormatPaintTwoTone';


export function ButtonOptionsDraw(props: { isMobile?: boolean, onClick: () => void, sx?: SxProps }) {
  return props.isMobile ? (
    <IconButton variant='soft' color='warning' onClick={props.onClick} sx={props.sx}>
      <FormatPaintTwoToneIcon />
    </IconButton>
  ) : (
    <Button variant='soft' color='warning' onClick={props.onClick} sx={props.sx}>
      Options
    </Button>
  );
}