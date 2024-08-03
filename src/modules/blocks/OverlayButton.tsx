import type { SxProps } from '@mui/joy/styles/types';
import { IconButton, styled } from '@mui/joy';


export const overlayButtonsClassName = 'overlay-buttons';

export const overlayButtonsSx: SxProps = {
  // stick to the top-right corner
  position: 'absolute',
  top: 0,
  right: 0,
  zIndex: 2, // top of message and its chips

  // stype
  p: 0.5,

  // layout
  display: 'flex',
  flexDirection: 'row',
  gap: 1,

  // faded-out defaults
  opacity: 'var(--AGI-overlay-start-opacity, 0)',
  pointerEvents: 'none',
  transition: 'opacity 0.2s cubic-bezier(.17,.84,.44,1)',
  // buttongroup: background
  // '& > div > button': {
  //   backgroundColor: 'background.surface',
  //   backdropFilter: 'blur(12px)',
  // },
};

export const overlayButtonsActiveSx = {
  opacity: 1,
  pointerEvents: 'auto',
};


export const OverlayButton = styled(IconButton)(({ theme, variant }) => ({
  backgroundColor: variant === 'outlined' ? theme.palette.background.surface : undefined,
  '--Icon-fontSize': theme.fontSize.lg,
})) as typeof IconButton;
