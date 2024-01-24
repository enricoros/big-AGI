import * as React from 'react';

import { ColorPaletteProp, FormControl, IconButton, Typography, VariantProp } from '@mui/joy';
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
    <FormControl
      onClick={() => !props.disabled && props.onClick?.()}
      sx={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: { xs: 1, md: 2 },
      }}
    >

      <IconButton
        aria-label={props.text}
        variant={props.variant || 'solid'} color={props.color}
        disabled={props.disabled}
        sx={{
          '--IconButton-size': { xs: '4.2rem', md: '5rem' },
          borderRadius: '50%',
          // boxShadow: 'lg',
          ...props.sx,
        }}
      >
        <props.Icon />
      </IconButton>

      <Typography aria-hidden level='title-md' variant={props.disabled ? 'soft' : undefined}>
        {props.text}
      </Typography>

    </FormControl>
  );
}