import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { IconButton } from '@mui/joy';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import MenuIcon from '@mui/icons-material/Menu';

import { LayoutSidebarRight } from '~/common/components/icons/LayoutSidebarRight';

import { optimaExitChromeless, optimaOpenDrawer, optimaOpenPanel } from './useOptima';


const buttonSx: SxProps = {
  position: 'fixed',
  top: '0.5rem',
  zIndex: 25,
  // backdropFilter: 'blur(8px)',
  backgroundColor: 'background.surface',
  boxShadow: 'md',
  borderRadius: '50%',
} as const;


export function ChromelessFloatingButtons() {
  return <>

    {/* Left — where the drawer toggle usually is */}
    <IconButton aria-label='Open Drawer' variant='soft' onClick={optimaOpenDrawer} style={{ left: '0.5rem' }} sx={buttonSx}>
      <MenuIcon />
    </IconButton>

    {/* Center — exit chromeless (styled like the scroll-to-bottom button) */}
    <IconButton aria-label='Exit Chrome-less' variant='soft' onClick={optimaExitChromeless} sx={buttonSx} style={{ left: '50%', transform: 'translateX(-50%)' }}>
      <FullscreenExitIcon />
    </IconButton>

    {/* Right — where the panel toggle usually is */}
    <IconButton aria-label='Open Menu' variant='soft' onClick={optimaOpenPanel} style={{ right: '0.5rem' }} sx={buttonSx}>
      <LayoutSidebarRight />
    </IconButton>

  </>;
}
