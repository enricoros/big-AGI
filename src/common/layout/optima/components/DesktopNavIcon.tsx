import { Box, IconButton, styled } from '@mui/joy';

import { animationColorBeamScatterINV } from '~/common/util/animUtils';


export const DesktopNavGroupBox = styled(Box)({
  // flex column
  display: 'flex',
  flexDirection: 'column',
  flexWrap: 'wrap',
  justifyContent: 'center',
  alignItems: 'center',

  // nav items, reduce the marginBlock a little
  '--GroupMarginY': '0.125rem',

  // style
  // backgroundColor: 'rgba(0 0 0 / 0.5)',
  // borderRadius: '1rem',
  // paddingBlock: '0.5rem',
  // overflow: 'hidden',
});


export const navItemClasses = {
  typeMenu: 'NavButton-typeMenu',
  typeApp: 'NavButton-typeApp',
  typeLinkOrModal: 'NavButton-typeLink',
  dev: 'NavButton-dev',
  active: 'NavButton-active',
  paneOpen: 'NavButton-paneOpen',
  attractive: 'NavButton-attractive',
};

export const DesktopNavIcon = styled(IconButton)(({ theme }) => ({
  // --Bar is defined in InvertedBar
  '--MarginX': '0.25rem',

  // border: '1px solid red',
  marginBlock: 'var(--GroupMarginY)',
  //marginInline: .. not needd because we center the items
  padding: 0,

  [`&.${navItemClasses.typeApp},&.${navItemClasses.typeLinkOrModal}`]: {
    // NOTE: 1.5 would be 24px, the native icon size - maybe we should use that for the selected app?
    '--Icon-fontSize': '1.25rem',
  },

  // hamburger menu: quick rotate on click
  [`&.${navItemClasses.typeMenu}`]: {
    transition: 'rotate 0.6s',
    '&:active': {
      rotate: '90deg',
      transition: 'rotate 0.2s',
    },
  },

  [`&.${navItemClasses.typeApp}`]: {
    '--IconButton-size': 'calc(var(--Bar) - 2 * var(--MarginX))',
    transition: 'border-radius 0.4s, margin 0.2s, padding 0.2s', // background-color 0.3s, color 0.2s
  },

  [`&.${navItemClasses.typeApp}:hover`]: {
    backgroundColor: 'var(--variant-solidHoverBg)',
    // backgroundColor: theme.palette.neutral.softHoverBg,
    color: theme.palette.neutral.softColor,
  },

  // [`&.${navItemClasses.typeLinkOrModal}`]: {
  //   borderRadius: '50%',
  //   transition: 'font-size 5s, color 0.2s',
  // },

  // app active (non hover)
  // [`&.${navItemClasses.typeApp}.${navItemClasses.active}`]: {},

  // pane open: show a connected half
  [`&.${navItemClasses.paneOpen}`]: {
    // squircle animation
    borderStartStartRadius: 'calc(var(--IconButton-size) / 4)',
    borderEndStartRadius: 'calc(var(--IconButton-size) / 4)',
    borderStartEndRadius: 0,
    borderEndEndRadius: 0,
    marginLeft: 'calc(2 * var(--MarginX))',
    paddingRight: 'calc(2 * var(--MarginX))',
  },
  [`&.${navItemClasses.paneOpen}:hover`]: {
    borderRadius: 'var(--joy-radius-md, 0.5rem)',
    marginLeft: 0,
    paddingRight: 0,
  },

  // attractive: attract the user to click on this element
  [`&.${navItemClasses.attractive}`]: {
    '--Icon-fontSize': '2rem',
    animation: `${animationColorBeamScatterINV} 4s infinite`,
  },

  // debug: show a red outline
  [`&.${navItemClasses.dev}`]: {
    border: '2px dashed red',
  },

})) as typeof IconButton;