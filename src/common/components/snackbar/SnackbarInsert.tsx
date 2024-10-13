import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { IconButton, Snackbar, SnackbarTypeMap } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

import { SNACKBAR_ANIMATION_DURATION, SnackbarMessage, useSnackbarsStore } from './useSnackbarsStore';


const defaultTypeConfig: {
  [key in SnackbarMessage['type']]: (Partial<SnackbarTypeMap['props']> & {
    clickAway: boolean,
    closeButton: boolean;
  })
} = {
  'success': {
    color: 'success',
    variant: 'soft',
    autoHideDuration: 5000,
    clickAway: false,
    closeButton: true,
  },
  'info': {
    color: 'primary',
    variant: 'soft',
    autoHideDuration: 2000,
    clickAway: false,
    closeButton: true,
  },
  'issue': {
    color: 'warning',
    variant: 'solid',
    autoHideDuration: null, // Will not auto-hide
    clickAway: false,
    closeButton: true,
  },
  'center-title': {
    color: 'neutral',
    variant: 'plain',
    autoHideDuration: 2000,
    clickAway: false,
    closeButton: false,
    anchorOrigin: { vertical: 'top', horizontal: 'center' },
  },
  'precondition-fail': {
    color: 'warning',
    variant: 'outlined',
    autoHideDuration: 2000,
    clickAway: false,
    closeButton: true,
  },
};

const typeDefaultSx: SxProps = {
  border: '1px solid',
};

const typeTitleSx: SxProps = {
  '--Snackbar-inset': '64px',
  borderRadius: 'md',
  boxShadow: 'md',
  backgroundColor: 'background.popup',
  // bgcolor: `rgba(${theme.vars.palette.background.popup} / 0.5)`,
  // backdropFilter: 'blur(6px)',
  // '--Snackbar-padding': config.closeButton ? '0.5rem' : '1rem',
};


/**
 * Simple cycler through the snackbars.
 */
export function SnackbarInsert() {

  // external state
  const { activeMessage, activeSnackbarOpen, animateCloseSnackbar } = useSnackbarsStore();

  // create a
  const config = React.useMemo(() => activeMessage ? ({
    ...defaultTypeConfig[activeMessage.type],
    ...activeMessage.overrides,
    ...(activeMessage.closeButton === undefined ? {} : { closeButton: activeMessage.closeButton }),
  }) : null, [activeMessage]);

  if (!activeMessage || !config)
    return null;

  return (
    <Snackbar
      key={activeMessage.key}
      open={activeSnackbarOpen}
      color={config.color}
      variant={config.variant}
      autoHideDuration={config.autoHideDuration ?? null}
      animationDuration={SNACKBAR_ANIMATION_DURATION}
      invertedColors={config.closeButton}
      anchorOrigin={config.anchorOrigin || { vertical: 'bottom', horizontal: 'right' }}
      onClose={(_event, reason) => {
        if (reason === 'timeout' || ((reason === 'clickaway' || reason === 'escapeKeyDown') && config.clickAway)) {
          animateCloseSnackbar();
        }
      }}
      startDecorator={config.startDecorator}
      endDecorator={!config.closeButton ? undefined : (
        <IconButton
          onClick={animateCloseSnackbar}
          size='sm'
          sx={{ my: '-0.4rem' }}
        >
          <CloseRoundedIcon />
        </IconButton>
      )}
      sx={activeMessage.type === 'center-title' ? typeTitleSx : typeDefaultSx}
    >
      {activeMessage.message}
    </Snackbar>
  );
}
