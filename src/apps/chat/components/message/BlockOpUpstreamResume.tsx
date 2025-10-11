import * as React from 'react';

import { Box, Button, ButtonGroup, Tooltip, Typography } from '@mui/joy';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';

import type { DMessageGenerator } from '~/common/stores/chat/chat.message';


/**
 * FIXME: COMPLETE THIS
 */
export function BlockOpUpstreamResume(props: {
  upstreamHandle: Exclude<DMessageGenerator['upstreamHandle'], undefined>,
  onResume?: () => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
}) {

  // state
  const [isResuming, setIsResuming] = React.useState(false);
  const [isCancelling, setIsCancelling] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // handlers

  const handleResume = React.useCallback(async () => {
    if (!props.onResume) return;
    setError(null);
    setIsResuming(true);
    try {
      await props.onResume();
    } catch (err: any) {
      setError(err?.message || 'Resume failed');
    } finally {
      setIsResuming(false);
    }
  }, [props]);

  const handleCancel = React.useCallback(async () => {
    if (!props.onCancel) return;
    setError(null);
    setIsCancelling(true);
    try {
      await props.onCancel();
    } catch (err: any) {
      setError(err?.message || 'Cancel failed');
    } finally {
      setIsCancelling(false);
    }
  }, [props]);

  const handleDelete = React.useCallback(async () => {
    if (!props.onDelete) return;
    setError(null);
    setIsDeleting(true);
    try {
      await props.onDelete();
    } catch (err: any) {
      setError(err?.message || 'Delete failed');
    } finally {
      setIsDeleting(false);
    }
  }, [props]);

  return (
    <Box
      sx={{
        mt: 1,
        mx: 1.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <ButtonGroup>
        {props.onResume && (
          <Tooltip title='Resume generation from last checkpoint'>
            <Button
              disabled={isResuming || isCancelling || isDeleting}
              loading={isResuming}
              startDecorator={<PlayArrowRoundedIcon sx={{ color: 'success.solidBg' }} />}
              onClick={handleResume}
            >
              Resume
            </Button>
          </Tooltip>
        )}

        {props.onCancel && (
          <Tooltip title='Cancel the response generation'>
            <Button
              disabled={isResuming || isCancelling || isDeleting}
              loading={isCancelling}
              // startDecorator={<CancelIcon />}
              onClick={handleCancel}
            >
              Cancel
            </Button>
          </Tooltip>
        )}

        {props.onDelete && (
          <Tooltip title='Delete the stored response'>
            <Button
              loading={isDeleting}
              // startDecorator={<DeleteIcon />}
              onClick={handleDelete}
              disabled={isResuming || isCancelling || isDeleting}
            >
              Delete
            </Button>
          </Tooltip>
        )}
      </ButtonGroup>

      {error && (
        <Typography level='body-xs' color='danger' sx={{ fontSize: '0.75rem' }}>
          {error}
        </Typography>
      )}

      <Typography level='body-xs' sx={{ fontSize: '0.65rem', opacity: 0.6 }}>
        Response ID: {props.upstreamHandle.responseId.slice(0, 12)}...
      </Typography>
    </Box>
  );
}
