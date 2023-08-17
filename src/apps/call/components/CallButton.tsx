import * as React from 'react';

import { Box, ColorPaletteProp, IconButton, Typography, VariantProp } from '@mui/joy';

export function CallButton(props: {
  Icon: React.FC,
  text: string,
  disabled?: boolean,
  variant?: VariantProp,
  color?: ColorPaletteProp,
  onClick?: () => void
}) {
  return <Box onClick={() => !props.disabled && props.onClick?.()}
              sx={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: { xs: 1, md: 2 },
              }}>

    <IconButton
      disabled={props.disabled} variant={props.variant || 'solid'} color={props.color}
      sx={{
        '--IconButton-size': { xs: '4.2rem', md: '5rem' },
        borderRadius: '50%',
        // boxShadow: 'lg',
      }}>
      <props.Icon />
    </IconButton>

    <Typography level='title-md' variant={props.disabled ? 'soft' : undefined}>
      {props.text}
    </Typography>

  </Box>;
}