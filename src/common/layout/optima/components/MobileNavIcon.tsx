import { Box, IconButton, styled } from '@mui/joy';


export const MobileNavGroupBox = styled(Box)({
  // layout
  flex: 1,
  minHeight: 'var(--Bar)',

  // contents
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'wrap',
  justifyContent: 'space-evenly',
  alignItems: 'center',

  // style
  // backgroundColor: 'rgba(0 0 0 / 0.5)', // darken bg

  // debug
  // '& > *': { border: '1px solid red' },
});

export const mobileNavItemClasses = {
  typeApp: 'NavButton-typeApp',
  active: 'NavButton-active',
};

export const MobileNavIcon = styled(IconButton)(({ theme }) => ({

  // custom vars
  '--MarginY': '0.5rem',
  '--ExtraPadX': '1rem',

  // IconButton customization
  '--Icon-fontSize': '1.25rem',
  '--IconButton-size': 'calc(var(--Bar) - 2 * var(--MarginY))',
  paddingInline: 'var(--ExtraPadX)',
  border: 'none',

  [`&.${mobileNavItemClasses.typeApp}:hover`]: {
    backgroundColor: 'var(--variant-solidHoverBg)',
    // backgroundColor: theme.palette.neutral.softHoverBg,
    color: theme.palette.neutral.softColor,
  },

  // app active (non hover)
  // [`&.${mobileNavItemClasses.typeApp}.${mobileNavItemClasses.active}`]: {
  //   backgroundColor: ...
  // },

})) as typeof IconButton;