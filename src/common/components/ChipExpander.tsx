import * as React from 'react';

import { Chip, chipClasses } from '@mui/joy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';


const _chipExpanderSx = {
  px: 1.5,
  [`& .${chipClasses.endDecorator}`]: {
    transition: 'transform 0.2s',
  } as const,
  [`&[aria-expanded='true'] .${chipClasses.endDecorator}`]: {
    transform: 'rotate(-180deg)',
  } as const,
} as const;


export function ChipExpander(props: {
  text: React.ReactNode,
  expanded: boolean,
  size?: 'sm' | 'md' | 'lg',
  onToggleExpanded?: () => void
}) {
  return (
    <Chip
      variant={props.expanded ? 'solid' : 'outlined'}
      size={props.size}
      onClick={props.onToggleExpanded}
      endDecorator={<KeyboardArrowDownIcon />}
      aria-expanded={props.expanded}
      sx={_chipExpanderSx}
    >
      {props.text}
    </Chip>
  );
}