import * as React from 'react';

import { IconButton, Snackbar, SnackbarTypeMap } from '@mui/joy';
import CloseIcon from '@mui/icons-material/Close';

import { SnackbarMessage, useSnackbarsStore } from '~/common/components/useSnackbarsStore';


const defaultTypeConfig: {
  [key in SnackbarMessage['type']]: (Partial<SnackbarTypeMap['props']> & {
    clickAway: boolean,
    closeButton: boolean;
  })
} = {
  success: {
    color: 'success',
    variant: 'soft',
    autoHideDuration: 5000, //5000,
    clickAway: false,
    closeButton: false,
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
  const { activeSnackbar, closeSnackbar } = useSnackbarsStore();

  // Memoize the rendered snack bars to prevent unnecessary re-renders
  const memoizedSnackbar = React.useMemo(() => {
    if (!activeSnackbar)
      return null;

    const { key, message, type, startDecorator } = activeSnackbar;

    const config = {
      ...defaultTypeConfig[type],
      // ...activeSnackbar.configOverrides,
    };

    return (
      <Snackbar
        key={key}
        open
        color={config.color}
        variant={config.variant}
        autoHideDuration={config.autoHideDuration ?? null}
        animationDuration={200}
        invertedColors
        anchorOrigin={{ vertical: 'bottom', horizontal: type === 'issue' ? 'center' : 'right' }}
        onClose={(_event, reason) => {
          if (reason === 'timeout' || ((reason === 'clickaway' || reason === 'escapeKeyDown') && config.clickAway)) {
            closeSnackbar();
          }
        }}
        startDecorator={startDecorator}
        endDecorator={!config.closeButton ? undefined : (
          <IconButton
            onClick={closeSnackbar}
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
  }, [activeSnackbar, closeSnackbar]);

  return <>
    {props.children}
    {memoizedSnackbar}
  </>;
};