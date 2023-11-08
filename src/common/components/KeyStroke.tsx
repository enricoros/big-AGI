import * as React from 'react';

import { Chip } from '@mui/joy';
import { SxProps } from '@mui/system';

/**
 * Shows a shortcut combo in a nicely presented dark box.
 */
export function KeyStroke(props: { combo: string, light?: boolean, sx?: SxProps }) {
  return (
    <Chip variant={props.light ? 'outlined' : 'solid'} color='neutral' sx={props.sx}>
      {props.combo}
    </Chip>
    // <Box sx={{
    //   position: 'relative', display: 'inline-block', px: 1, py: 0.5,
    //   bg: 'rgba(0,0,0,0.75)', color: 'white', borderRadius: 1,
    //   fontSize: 12, fontWeight: 500, lineHeight: 1, whiteSpace: 'nowrap',
    // }}>
    //   <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', bg: 'rgba(0,0,0,0.5)', borderRadius: 1 }} />
    //   {props.combo}
    // </Box>
  );
}