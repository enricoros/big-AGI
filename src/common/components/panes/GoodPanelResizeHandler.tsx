import { Box, styled } from '@mui/joy';

import { themeBgApp } from '~/common/app.theme';


export const PanelResizeInset = styled(Box)({
  backgroundColor: themeBgApp,
  width: '100%',
  height: '100%',
  minWidth: '0.25rem',
  minHeight: '0.25rem',
  transition: 'background-color 0.2s',
  '&:hover': {
    backgroundColor: 'var(--joy-palette-primary-solidBg)',
  },
});
