import type { SxProps } from '@mui/joy/styles/types';

import { animationColorRainbow } from '~/common/util/animUtils';


export const messageAsideColumnSx: SxProps = {
  // make this stick to the top of the screen
  position: 'sticky',
  top: '0.25rem',

  // style
  // filter: 'url(#agi-holographic)',

  // flexBasis: 0, // this won't let the item grow
  minWidth: { xs: 50, md: 64 },
  maxWidth: 80,
  textAlign: 'center',
  // layout
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 0.25, // 2024-08-24: added, space the avatar icon from the label

  // when with the 'edit-button' class
  '&.msg-edit-button': {
    gap: 0.25,
  },
};

export const messageZenAsideColumnSx: SxProps = {
  ...messageAsideColumnSx,
  minWidth: undefined,
  maxWidth: undefined,
  mx: -1,
};

export const messageAvatarLabelSx: SxProps = {
  overflowWrap: 'anywhere',
};

export const messageAvatarLabelAnimatedSx: SxProps = {
  animation: `${animationColorRainbow} 5s linear infinite`,
  // Extra hinting... but looks weird
  // fontStyle: 'italic',
};

// Mobile-specific: Compact sticky header bar
// Note: backgroundColor is set dynamically in the component based on message role
export const messageMobileHeaderSx: SxProps = {
  position: 'sticky',
  top: 0,
  zIndex: 2, // on top of the textarea outline when editing

  minHeight: '2.5rem', // 40px, while the rendercode buttons have 44 (4 + 36 + 4), but this doesn't feel small
  pl: 1.5,
  pr: 1,
  mx: -0.5,
  mb: 0.125,

  display: 'flex',
  alignItems: 'center',
  gap: 1,
};

// Edit controls bar when in Beam
export const messageEditBeamControlsTopSx: SxProps = {
  ...messageMobileHeaderSx,
  top: '3rem',
  backgroundColor: 'warning.softHoverBg',
  justifyContent: 'flex-end',
};
