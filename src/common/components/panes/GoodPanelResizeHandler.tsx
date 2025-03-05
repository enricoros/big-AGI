import { Box, styled } from '@mui/joy';


export const PanelResizeInset = styled(Box)({
  width: '100%',
  height: '100%',

  // 4px
  minWidth: '0.25rem',
  minHeight: '0.25rem',

  // 0px
  // minWidth: 0,
  // minHeight: 0,

  // backgroundColor: 'var(--joy-palette-divider)',
  transition: 'background-color 0.1s',
  '&:hover': {
    backgroundColor: 'var(--joy-palette-primary-solidBg)',
  },
});
