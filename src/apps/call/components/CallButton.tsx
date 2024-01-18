import * as React from 'react';

import { Box, ColorPaletteProp, IconButton, Typography, VariantProp } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';


/**
 * Large button to operate the call, e.g.
 *  --------
 *  |  🎤  |
 *  | Mute |
 *  --------
 */
export function CallButton(props: {
  Icon: React.FC, text: string,
  variant?: VariantProp, color?: ColorPaletteProp, disabled?: boolean,
  onClick?: () => void,
  sx?: SxProps,
}) {
  return (
    <Box
      onClick={() => !props.disabled && props.onClick?.()}
      sx={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: { xs: 1, md: 2 },
      }}
    >

      <IconButton
        disabled={props.disabled} variant={props.variant || 'solid'} color={props.color}
        sx={{
          '--IconButton-size': { xs: '4.2rem', md: '5rem' },
          borderRadius: '50%',
          // boxShadow: 'lg',
          ...props.sx,
        }}>
        <props.Icon />
      </IconButton>

      <Typography level='title-md' variant={props.disabled ? 'soft' : undefined}>
        {props.text}
      </Typography>

    </Box>
  );
}