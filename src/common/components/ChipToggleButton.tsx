import * as React from 'react';

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
  size?: 'sm' | 'md' | 'lg',
  onClick?: () => void
}) {
  return (
    <Chip
      variant={props.active ? 'solid' : 'outlined'}
      size={props.size}
      onClick={props.onClick}
      aria-checked={props.active}
      sx={_chipTBSx}
    >
      {props.text}
    </Chip>
  );
}