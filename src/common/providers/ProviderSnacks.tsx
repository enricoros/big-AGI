import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { IconButton, Snackbar, SnackbarTypeMap } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

import { SNACKBAR_ANIMATION_DURATION, SnackbarMessage, useSnackbarsStore } from '../components/useSnackbarsStore';


const defaultTypeConfig: {
  [key in SnackbarMessage['type']]: (Partial<SnackbarTypeMap['props']> & {
    clickAway: boolean,
    closeButton: boolean;
  })
} = {
  success: {
    color: 'success',
    variant: 'soft',
    autoHideDuration: 5000,
    clickAway: false,
    closeButton: true,
  },
  issue: {
    color: 'warning',
    variant: 'solid',
    autoHideDuration: null, // Will not auto-hide
    clickAway: false,
    closeButton: true,
  },
  title: {
    color: 'neutral',
    variant: 'plain',
    autoHideDuration: 2000,
    clickAway: false,
    closeButton: false,
    anchorOrigin: { vertical: 'top', horizontal: 'center' },
  },
};

const titleSx: SxProps = {
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
export const ProviderSnacks = (props: { children: React.ReactNode }) => {

  // external state
  const { activeSnackbar, activeSnackbarOpen, animateCloseSnackbar } = useSnackbarsStore();

  // Memoize the rendered snack bars to prevent unnecessary re-renders
  const memoizedSnackbar = React.useMemo(() => {
    if (!activeSnackbar)
      return null;

    const { key, message, type, closeButton, overrides } = activeSnackbar;

    const config = {
      ...defaultTypeConfig[type],
      ...overrides,
      ...(closeButton === undefined ? {} : { closeButton }),
    };

    return (
      <Snackbar
        key={key}
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
        sx={type === 'title' ? titleSx : undefined}
      >
        {message}
      </Snackbar>
    );
  }, [activeSnackbar, activeSnackbarOpen, animateCloseSnackbar]);

  return <>
    {props.children}
    {memoizedSnackbar}
  </>;
};