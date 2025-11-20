import * as React from 'react';

import { Alert, IconButton, Typography } from '@mui/joy';
import CloseIcon from '@mui/icons-material/Close';

import { isMobilePwaInDesktopMode } from './pwaUtils';


/**
 * Hook that detects and displays a warning when a mobile PWA is running in Desktop Mode.
 * The warning is dismissible and remembers the user's choice via sessionStorage.
 */
export function usePwaDesktopModeWarning(): React.JSX.Element | null {
  const [isWarningDismissed, setIsWarningDismissed] = React.useState(false);
  const [shouldShowWarning, setShouldShowWarning] = React.useState(false);

  // Check if we should show the warning
  React.useEffect(() => {
    // Check if already dismissed in this session
    const dismissed = sessionStorage.getItem('pwa-desktop-mode-warning-dismissed') === 'true';
    if (dismissed) {
      setIsWarningDismissed(true);
      return;
    }

    // Detect the condition
    const isInDesktopMode = isMobilePwaInDesktopMode();
    setShouldShowWarning(isInDesktopMode);
  }, []);

  const handleDismiss = React.useCallback(() => {
    sessionStorage.setItem('pwa-desktop-mode-warning-dismissed', 'true');
    setIsWarningDismissed(true);
  }, []);

  // Don't show if dismissed or condition not met
  if (isWarningDismissed || !shouldShowWarning) {
    return null;
  }

  return (
    <Alert
      variant="soft"
      color="warning"
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        borderRadius: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
      endDecorator={
        <IconButton
          variant="plain"
          size="sm"
          color="warning"
          onClick={handleDismiss}
          aria-label="Dismiss warning"
        >
          <CloseIcon />
        </IconButton>
      }
    >
      <div>
        <Typography level="title-sm" color="warning" sx={{ fontWeight: 'bold' }}>
          Desktop Mode Detected
        </Typography>
        <Typography level="body-sm" color="warning">
          Your PWA is running in Desktop Mode, which may cause layout issues. To fix: Close this app, open Chrome, visit this site, disable &ldquo;Desktop site&rdquo; in the menu (⋮), then reopen the app.
        </Typography>
      </div>
    </Alert>
  );
}
