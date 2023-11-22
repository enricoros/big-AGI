import * as React from 'react';

import { IconButton, Snackbar, SnackbarTypeMap } from '@mui/joy';
import CloseIcon from '@mui/icons-material/Close';

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

    const { key, message, type, autoHideDuration, startDecorator } = activeSnackbar;

    const config = {
      ...defaultTypeConfig[type],
      autoHideDuration: autoHideDuration ?? defaultTypeConfig[type].autoHideDuration,
      startDecorator: startDecorator ?? defaultTypeConfig[type].startDecorator,
    };

    return (
      <Snackbar
        key={key}
        open={activeSnackbarOpen}
        color={config.color}
        variant={config.variant}
        autoHideDuration={config.autoHideDuration ?? null}
        animationDuration={SNACKBAR_ANIMATION_DURATION}
        invertedColors
        anchorOrigin={{ vertical: 'bottom', horizontal: type === 'issue' ? 'center' : 'right' }}
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
            <CloseIcon />
          </IconButton>
        )}
        sx={{
          // '--Snackbar-padding': config.closeButton ? '0.5rem' : '1rem',
        }}
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