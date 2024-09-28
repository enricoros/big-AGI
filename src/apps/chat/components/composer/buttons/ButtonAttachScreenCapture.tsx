import * as React from 'react';

import { Box, Button, IconButton, Tooltip } from '@mui/joy';
import ScreenshotMonitorIcon from '@mui/icons-material/ScreenshotMonitor';

import { Is } from '~/common/util/pwaUtils';
import { takeScreenCapture } from '~/common/util/screenCaptureUtils';


export const ButtonAttachScreenCaptureMemo = React.memo(ButtonAttachScreenCapture);

function ButtonAttachScreenCapture(props: { isMobile?: boolean, onAttachScreenCapture: (file: File) => void }) {

  // state
  const [capturing, setCapturing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // derived state
  const { onAttachScreenCapture } = props;


  const handleTakeScreenCapture = React.useCallback(async () => {
    setError(null);
    setCapturing(true);
    try {
      const file = await takeScreenCapture();
      file && onAttachScreenCapture(file);
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      setError(`Issue: ${message}`);
    }
    setCapturing(false);
  }, [onAttachScreenCapture]);


  return props.isMobile ? (
    <IconButton onClick={handleTakeScreenCapture}>
      <ScreenshotMonitorIcon />
    </IconButton>
  ) : (
    <Tooltip
      arrow disableInteractive placement='top-start'
      title={
        <Box sx={{ px: 1, py: 0.75, lineHeight: '1.5rem' }}>
          <b>Attach screen capture</b><br />
          {error || 'Attach the image of a window, a browser tab, or a screen'}
          {!error && Is.OS.MacOS && Is.Browser.Safari && (
            <Box sx={{ mt: 1 }}><b>Safari</b>: canceling the window selection may cause a 60-second delay.</Box>
          )}
        </Box>
      }
    >
      <Button
        fullWidth
        variant={capturing ? 'solid' : 'plain'}
        color={!!error ? 'danger' : 'neutral'}
        onClick={handleTakeScreenCapture}
        loading={capturing}
        loadingPosition={capturing ? 'start' : 'center'}
        startDecorator={<ScreenshotMonitorIcon />}
        sx={{ justifyContent: 'flex-start' }}
      >
        Screen
      </Button>
    </Tooltip>
  );
}
