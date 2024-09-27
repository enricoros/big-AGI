import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Button, ColorPaletteProp } from '@mui/joy';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';


/**
 * Simple button to 'Show more' or 'Show less' content
 */
export function ToggleExpansionButton(props: {
  color?: ColorPaletteProp;
  isCollapsed: boolean;
  onToggle: () => void;
  sx: SxProps;
}) {
  return (
    <div style={{ lineHeight: 1 /* Absorbs some weird height issue since the parent has an extended line height (lineHeightChatTextMd) */ }}>
      <Button
        variant='soft'
        color={props.color}
        size='sm'
        onClick={props.onToggle}
        startDecorator={props.isCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
        sx={props.sx}
      >
        {props.isCollapsed ? 'Show more' : 'Show less'}
      </Button>
    </div>
  );
}