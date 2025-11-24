import * as React from 'react';

import { Alert, IconButton } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import { Is, isBrowser, isPwa } from '~/common/util/pwaUtils';
import { useUICounter } from '~/common/stores/store-ui';


/**
 * Detects if a mobile PWA is running in Desktop Mode (which causes layout issues).
 * This happens when Chrome's "Request Desktop Site" is enabled on mobile devices.
 *
 * Shows a dismissible warning when:
 * - App is running as a PWA (standalone mode)
 * - Device OS is mobile (iOS or Android)
 * - Viewport width is >= 900px (indicating desktop mode override)
 */
export function usePWADesktopModeWarning() {

  // state
  const [hideWarning, setHideWarning] = React.useState(false);

  // external state
  const { novel: lessThanFive, touch } = useUICounter('acknowledge-pwa-desktop-mode-warning', 5);

  // detect PWA in desktop mode
  const isInDesktopMode = React.useMemo(() => {
    if (!isBrowser) return false;

    // if PWA
    const isInPwaMode = isPwa();
    if (!isInPwaMode) return false;

    // if OS is mobile
    const isMobileOS = Is.OS.iOS || Is.OS.Android;
    if (!isMobileOS) return false;

    // Check if viewport width suggests desktop mode (>= 900px)
    // This matches the mobile breakpoint used in useMatchMedia.ts
    return window.matchMedia('(min-width: 900px)').matches;
  }, []);

  const showWarning = isInDesktopMode && !hideWarning && lessThanFive;

  return React.useMemo(() => showWarning ? (
    <Alert
      size='lg'
      variant='soft'
      color='warning'
      startDecorator={<WarningRoundedIcon />}
      endDecorator={
        <IconButton color='warning'>
          <CloseRoundedIcon onClick={() => {
            setHideWarning(true);
            touch();
          }} />
        </IconButton>
      }
    >
      This Browser is running in Desktop Mode, which may cause layout issues.<br />
      To fix: Close this app, open Chrome, visit this site, disable &quot;Desktop site&quot; in the menu, then reopen the app.
    </Alert>
  ) : null, [showWarning, touch]);
}
