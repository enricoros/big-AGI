import * as React from 'react';

import type { SxProps, VariantProp } from '@mui/joy/styles/types';
import { Chip } from '@mui/joy';

import { Is } from '~/common/util/pwaUtils';
import { hideOnMobile } from '~/common/app.theme';


export function platformAwareKeystrokes(text: string) {
  return Is.OS.MacOS
    ? text
      .replaceAll('Ctrl', '⌃' /* Control */)
      .replaceAll('Alt', '⌥' /* Option */)
      .replaceAll('Shift', '⇧')
    // Optional: Replace "Enter" with "Return" if you want to align with Mac keyboard labeling
    // .replaceAll('Enter', 'Return')
    : text;
}

/**
 * Shows a shortcut combo in a nicely presented dark box.
 */
export function KeyStroke(props: {
  combo: string,
  variant?: VariantProp,
  sx?: SxProps,
}) {
  return (
    <Chip
      size='md'
      variant={props.variant}
      color='neutral'
      sx={props.sx ? { ...hideOnMobile, ...props.sx } : hideOnMobile}
    >
      {platformAwareKeystrokes(props.combo)}
    </Chip>
    // <Box sx={{
    //   position: 'relative', display: 'inline-block', px: 1, py: 0.5,
    //   bg: 'rgba(0,0,0,0.75)', color: 'white', borderRadius: 1,
    //   fontSize: 12, fontWeight: 'md', lineHeight: 1, whiteSpace: 'nowrap',
    // }}>
    //   <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', bg: 'rgba(0,0,0,0.5)', borderRadius: 1 }} />
    //   {props.combo}
    // </Box>
  );
}