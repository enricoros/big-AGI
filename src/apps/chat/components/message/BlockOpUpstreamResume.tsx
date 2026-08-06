import * as React from 'react';
import TimeAgo from 'react-timeago';

import { Box, Button, ButtonGroup, Tooltip, Typography } from '@mui/joy';
import DownloadIcon from '@mui/icons-material/Download';
import LinkOffRoundedIcon from '@mui/icons-material/LinkOffRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';

import type { AixReattachMode } from '~/modules/aix/client/aix.client';

import type { DMessageGenerator } from '~/common/stores/chat/chat.message';


const ARM_TIMEOUT_MS = 4000;


/**
 * Resume controls for an upstream-stored run.
 *  - Resume:  SSE replay (live deltas) - canonical path. Always offered when onResume exists.
 *  - Recover: one-shot JSON GET - shown only for vendors that benefit from it (Gemini Interactions).
 *  - Detach:  abort the local fetch but leave the upstream run alive. Visible only when a resume
 *             is in-flight (`inFlightMode != null`). Resume/Recover stay available afterwards.
 *  - Stop:    terminate the upstream run + delete the resource.
 *
 * IMPORTANT: in-flight state is owned by the parent (`inFlightMode` + `onDetach`) so it survives
 * remounts that happen while a long-running stream is active (e.g. Deep Research).
 */
export function BlockOpUpstreamResume(props: {
  upstreamHandle: Exclude<DMessageGenerator['upstreamHandle'], undefined>,
  pending?: boolean; // true iff a local in-flight op (initial POST or resume); drives the state machine + hides the expiry footer
  inFlightMode?: AixReattachMode; // set by the parent while a resume is in flight; drives the loading/Detach UI
  onResume?: (mode: AixReattachMode) => void | Promise<void>;
  onDetach?: () => void;
  onDelete?: () => void | Promise<void>;
}) {

  // local state - only for short-lived ops the parent doesn't own
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteArmed, setDeleteArmed] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // expiration: boolean is evaluated at render (may lag briefly if nothing re-renders past expiry).
  const { expiresAt /*, runId = ''*/ } = props.upstreamHandle;

  // State machine - mutually exclusive triplet (idle | initial-POST | resume | recover):
  //  - Idle           : !pending                     - run not active locally (incl. post-reload, since
  //                                                    chats.converters.ts clears pendingIncomplete on hydrate).
  //  - Initial POST   : pending && !inFlightMode     - first generation streaming.
  //  - Resume replay  : pending && mode='replay'     - we own this resume cycle.
  //  - Recover snap   : pending && mode='snapshot'   - we own this snapshot fetch.
  //
  // Visibility matrix (see BlockOpUpstreamResume props doc):
  //                       Resume   Recover   Detach   Cancel
  //   Idle                  ✅       ✅¹       —       ✅
  //   Initial POST          —        —         —       ✅
  //   Resume in flight      —        —         ✅      ✅
  //   Recover in flight     —        ✅²       —       —
  //   ¹ only for Gemini Interactions  ² with loading spinner
  const isReplaying = props.inFlightMode === 'replay';
  const isSnapshotting = props.inFlightMode === 'snapshot';
  const isIdle = !props.pending;

  const canRecoverVendor = props.upstreamHandle.uht === 'vnd.gem.interactions';
  const showResume = isIdle && !!props.onResume;
  const showRecover = (isIdle || isSnapshotting) && !!props.onResume && canRecoverVendor;
  const showDetach = isReplaying && !!props.onDetach;
  const showCancel = !isSnapshotting && !!props.onDelete;

  // handlers

  const handleResume = React.useCallback((mode: AixReattachMode) => {
    if (!props.onResume) return;
    setError(null);
    // fire-and-forget: parent owns the promise lifecycle and the abort controller.
    // If it rejects, the parent surfaces the error via its own UI; we stay silent.
    Promise.resolve(props.onResume(mode)).catch(() => { /* parent handles */ });
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
        {showResume && (
          <Tooltip title='Resume by re-streaming from the upstream run'>
            <Button
              disabled={isDeleting}
              startDecorator={<PlayArrowRoundedIcon color='success' />}
              onClick={() => handleResume('replay')}
            >
              Resume
            </Button>
          </Tooltip>
        )}

        {showRecover && (
          <Tooltip title='Fetch the result without streaming - recovers stuck or hung runs'>
            <Button
              disabled={isDeleting}
              loading={isSnapshotting}
              loadingPosition='start'
              startDecorator={<DownloadIcon />}
              onClick={() => handleResume('snapshot')}
            >
              Recover
            </Button>
          </Tooltip>
        )}

        {showDetach && (
          <Tooltip title='Close this connection only - the upstream run keeps going. Click Resume or Recover later to fetch results.'>
            <Button
              disabled={isDeleting}
              startDecorator={<LinkOffRoundedIcon />}
              onClick={props.onDetach}
            >
              Detach
            </Button>
          </Tooltip>
        )}

        {showCancel && (
          <Tooltip title={deleteArmed ? 'Click again to confirm - cancels the upstream run and clears the handle' : 'Cancel the upstream run'}>
            <Button
              loading={isDeleting}
              color={deleteArmed ? 'danger' : 'neutral'}
              variant={deleteArmed ? 'solid' : 'outlined'}
              startDecorator={<StopRoundedIcon />}
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {deleteArmed ? 'Confirm?' : 'Cancel'}
            </Button>
          </Tooltip>
        )}
      </ButtonGroup>

      {error && (
        <Typography level='body-xs' color='danger' sx={{ fontSize: '0.75rem' }}>
          {error}
        </Typography>
      )}

      {!props.pending && !!expiresAt && <Typography level='body-xs' sx={{ fontSize: '0.65rem', opacity: 0.6 }}>
        {/*Run ID: {runId.slice(0, 12)}...*/}
        {/*{!!expiresAt && <> · Expires <TimeAgo date={expiresAt} /></>}*/}
        Expires <TimeAgo date={expiresAt} />
      </Typography>}
    </Box>
  );
}
