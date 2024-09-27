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
