import * as React from 'react';

import { ListItemButton, ListItemDecorator } from '@mui/joy';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import FullscreenIcon from '@mui/icons-material/Fullscreen';

import { optimaToggleChromeless, useOptimaChromeless } from './useOptima';


export function ChromelessItemButton() {
  const isChromeless = useOptimaChromeless();
  return (
    <ListItemButton onClick={optimaToggleChromeless}>
      <ListItemDecorator>{isChromeless ? <FullscreenExitIcon /> : <FullscreenIcon />}</ListItemDecorator>
      {isChromeless ? 'Exit Focus-mode' : 'Focus mode'}
    </ListItemButton>
  );
}
