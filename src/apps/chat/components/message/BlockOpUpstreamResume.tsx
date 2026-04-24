import * as React from 'react';
import TimeAgo from 'react-timeago';

import { Box, Button, ButtonGroup, Tooltip, Typography } from '@mui/joy';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';

import type { DMessageGenerator } from '~/common/stores/chat/chat.message';


const ARM_TIMEOUT_MS = 4000;


/**
 * FIXME: COMPLETE THIS
 */
export function BlockOpUpstreamResume(props: {
  upstreamHandle: Exclude<DMessageGenerator['upstreamHandle'], undefined>,
  pending?: boolean; // true while the message is actively streaming; labels the Delete button as "Stop"
  onResume?: () => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
}) {

  // state
  const [isResuming, setIsResuming] = React.useState(false);
  const [isCancelling, setIsCancelling] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteArmed, setDeleteArmed] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // expiration: boolean is evaluated at render (may lag briefly if nothing re-renders past expiry).
  // TimeAgo handles its own tick for the label; the button's disabled state is the only consumer of this flag.
  const { expiresAt /*, runId = ''*/ } = props.upstreamHandle;
  // const isExpired = expiresAt != null && Date.now() > expiresAt;

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

  // Two-click arm: first click arms (visible red "Confirm?"), second click (within ARM_TIMEOUT_MS) executes.
  const handleDelete = React.useCallback(async () => {
    if (!props.onDelete) return;
    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }
    setDeleteArmed(false);
    setError(null);
    setIsDeleting(true);
    try {
      await props.onDelete();
    } catch (err: any) {
      setError(err?.message || 'Delete failed');
    } finally {
      setIsDeleting(false);
    }
  }, [deleteArmed, props]);

  // Auto-disarm after ARM_TIMEOUT_MS so the armed state can't leak into a later session
  React.useEffect(() => {
    if (!deleteArmed) return;
    const t = setTimeout(() => setDeleteArmed(false), ARM_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [deleteArmed]);


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
              startDecorator={<PlayArrowRoundedIcon color='success' />}
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
          <Tooltip title={deleteArmed ? 'Click again to confirm - cancels the run upstream (no resume after)' : (props.pending ? 'Stop this response and cancel the upstream run' : 'Cancel the upstream run')}>
            <Button
              loading={isDeleting}
              color={deleteArmed ? 'danger' : 'neutral'}
              variant={deleteArmed ? 'solid' : 'outlined'}
              startDecorator={<StopRoundedIcon />}
              onClick={handleDelete}
              disabled={isResuming || isCancelling || isDeleting}
            >
              {deleteArmed ? 'Confirm?' : (props.pending ? 'Stop' : 'Cancel')}
            </Button>
          </Tooltip>
        )}
      </ButtonGroup>

      {error && (
        <Typography level='body-xs' color='danger' sx={{ fontSize: '0.75rem' }}>
          {error}
        </Typography>
      )}

      {!!expiresAt && <Typography level='body-xs' sx={{ fontSize: '0.65rem', opacity: 0.6 }}>
        {/*Run ID: {runId.slice(0, 12)}...*/}
        {/*{!!expiresAt && <> · Expires <TimeAgo date={expiresAt} /></>}*/}
        Expires <TimeAgo date={expiresAt} />
      </Typography>}
    </Box>
  );
}
