import * as React from 'react';

import { Box, Button, Divider, FormControl, FormLabel, Link, Option, Select, Switch, Typography } from '@mui/joy';
import ClearAllIcon from '@mui/icons-material/ClearAll';

import { GoodModal } from '~/common/components/modals/GoodModal';
import { KeyStroke } from '~/common/components/KeyStroke';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useUIPreferencesStore } from '~/common/stores/store-ui';

import { AixDebuggerFrame } from './AixDebuggerFrame';
import { aixClientDebuggerActions, useAixClientDebuggerStore } from './memstore-aix-client-debugger';


// configuration
const DEBUGGER_DEBOUNCE_MS = 1000 / 5; // 5Hz


function _getStoreSnapshot() {
  const state = useAixClientDebuggerStore.getState();
  return {
    frames: state.frames,
    activeFrameId: state.activeFrameId,
    maxFrames: state.maxFrames,
  }
}


/**
 * Prevent UI performance issues from high-frequency updates.
 */
function useDebouncedAixDebuggerStore() {

  // state with initial value from store
  const [debouncedState, setDebouncedState] = React.useState(_getStoreSnapshot);

  React.useEffect(() => {
    let lastUpdate = Date.now();
    let updateTimerId: ReturnType<typeof setTimeout> | null = null;

    function performUpdate() {
      setDebouncedState(_getStoreSnapshot);
      updateTimerId = null;
      lastUpdate = Date.now();
    }

    // subscribe to store changes
    const unsubscribe = useAixClientDebuggerStore.subscribe(() => {
      if (!updateTimerId) {
        const elapsedSinceLastUpdate = Date.now() - lastUpdate;
        const delayMs = Math.max(0, DEBUGGER_DEBOUNCE_MS - elapsedSinceLastUpdate);
        if (delayMs === 0)
          performUpdate();
        else
          updateTimerId = setTimeout(performUpdate, delayMs);
      }
    });

    return () => {
      unsubscribe();
      if (updateTimerId)
        clearTimeout(updateTimerId);
    };
  }, []); // no dependencies - subscription handles all changes

  return debouncedState;
}


export function AixDebuggerDialog(props: {
  onClose: () => void;
}) {

  // external state
  const isMobile = useIsMobile();
  const aixInspector = useUIPreferencesStore(state => state.aixInspector);
  const { frames, activeFrameId, maxFrames } = useDebouncedAixDebuggerStore();

  // derived state
  const activeFrame = frames.find(f => f.id === activeFrameId) ?? null;


  // handlers

  const handleSetMaxFrames = React.useCallback((value: number) => {
    aixClientDebuggerActions().setMaxFrames(value);
  }, []);

  const handleSetActiveFrame = React.useCallback((value: number | null) => {
    aixClientDebuggerActions().setActiveFrame(value);
  }, []);


  return (
    <GoodModal
      open
      onClose={props.onClose}
      title={isMobile ? 'AI Inspector' :
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          AI Request Inspector
          <KeyStroke size='sm' variant='soft' combo='Ctrl + Shift + A' />
        </Box>
      }
      titleStartDecorator={
        <Switch
          checked={aixInspector}
          onChange={useUIPreferencesStore.getState().toggleAixInspector}
          sx={{ mr: 1 }}
        />
      }
      autoOverflow
      fullscreen={isMobile || 'button'}
      sx={{ maxWidth: undefined }}
    >

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>

        {/* Request Switcher */}
        <FormControl sx={{ flex: 1, minWidth: 0 }}>
          <FormLabel>Select Request</FormLabel>
          <Select
            size='sm'
            variant='outlined'
            value={activeFrameId}
            onChange={(_, value) => handleSetActiveFrame(value)}
            placeholder='No requests available'
            disabled={!frames.length}
            sx={{ backgroundColor: 'background.popup' }}
          >
            {frames.map((frame) => {
              const label = `Request #${frame.id} - ${frame.context.contextName}`;
              return (
                <Option key={frame.id} value={frame.id} label={label + (frame.isComplete ? ` (${frame.particles.length})` : ' (Running)')}>
                  <div>{label} - {frame.particles.length} pts.</div>
                  <Box component='span' sx={{ marginLeft: 'auto', fontSize: 'xs' }}>{new Date(frame.timestamp).toLocaleTimeString()}</Box>
                </Option>
              );
            })}
          </Select>
        </FormControl>

        {/* History Size Preferences */}
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
          <FormControl>
            <FormLabel>History Size</FormLabel>
            <Select
              size='sm'
              value={maxFrames}
              onChange={(_, value) => value !== null && handleSetMaxFrames(value)}
              sx={{ backgroundColor: 'background.popup' }}
            >
              <Option value={5}>Keep 5 requests</Option>
              <Option value={10}>Keep 10 requests</Option>
              <Option value={20}>Keep 20 requests</Option>
              <Option value={50}>Keep 50 requests</Option>
            </Select>
          </FormControl>

          {/* Clear History */}
          <Button
            size='sm'
            color='danger'
            onClick={aixClientDebuggerActions().clearHistory}
            startDecorator={<ClearAllIcon />}
            disabled={frames.length === 0}
          >
            Clear History
          </Button>
        </Box>
      </Box>

      <Divider />

      {/* Zero State */}
      {(!frames.length || !activeFrame) && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
          {!frames.length && <>
            <Typography level='title-lg'>
              {aixInspector ? 'Ready to capture' : 'AI Request Inspector'}
            </Typography>
            <Typography level='body-sm' sx={{ mt: 2, maxWidth: 468, textAlign: 'center' }}>
              {aixInspector
                ? 'Your next AI request will be captured here.'
                : <>
                    <Link
                      component='button'
                      level='body-sm'
                      onClick={useUIPreferencesStore.getState().toggleAixInspector}
                    >
                      Turn on inspector
                    </Link> to see the exact requests to AI models.
                  </>}
            </Typography>
          </>}
          {!activeFrame && !!frames.length && (
            <Typography level='body-sm'>
              Select a request to view details
            </Typography>
          )}
        </Box>
      )}

      {/* Frame viewer */}
      {!!activeFrame && (
        <Box sx={{ overflow: 'auto' }}>
          <AixDebuggerFrame frame={activeFrame} />
        </Box>
      )}

    </GoodModal>
  );
}
