import * as React from 'react';

import type { VariantProp } from '@mui/joy/styles/types';
import { Chip } from '@mui/joy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';


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
  showCollapseCaret?: boolean,
  variant?: VariantProp,
  onClick?: () => void
}) {
  return (
    <Chip
      disabled={props.disabled}
      variant={props.active ? 'solid' : props.variant || 'outlined'}
      size={props.size}
      onClick={props.onClick}
      endDecorator={(props.showCollapseCaret && props.active) ? <KeyboardArrowDownIcon /> : undefined}
      aria-checked={props.active}
      sx={_chipTBSx}
    >
      {props.text}
    </Chip>
  );
}