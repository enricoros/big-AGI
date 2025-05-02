import * as React from 'react';

import type { VariantProp } from '@mui/joy/styles/types';
import { Chip } from '@mui/joy';


const _chipTBSx = {
  px: 1.5,
  // [`&[aria-checked='true'] .${chipClasses.endDecorator}`]: {
  //   transform: 'rotate(-180deg)',
  // } as const,
} as const;


export function ChipToggleButton(props: {
  text: React.ReactNode,
  active?: boolean,
  disabled?: boolean,
  size?: 'sm' | 'md' | 'lg',
  variant?: VariantProp,
  onClick?: () => void
}) {
  return (
    <Chip
      disabled={props.disabled}
      variant={props.active ? 'solid' : props.variant || 'outlined'}
      size={props.size}
      onClick={props.onClick}
      aria-checked={props.active}
      sx={_chipTBSx}
    >
      {props.text}
    </Chip>
  );
}