import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Box, Button, Divider, FormControl, FormLabel, Option, Select, Typography } from '@mui/joy';
import ClearAllIcon from '@mui/icons-material/ClearAll';

import { GoodModal } from '~/common/components/modals/GoodModal';

import { AixDebuggerFrame } from './AixDebuggerFrame';
import { aixClientDebuggerActions, useAixClientDebuggerStore } from './memstore-aix-client-debugger';


export function AixDebuggerDialog(props: {
  onClose: () => void;
}) {

  // external state - we subscribe to Any update - it's a temp debugger anyway
  const { frames, activeFrameId, maxFrames } = useAixClientDebuggerStore(useShallow((state) => ({
    frames: state.frames,
    activeFrameId: state.activeFrameId,
    maxFrames: state.maxFrames,
  })));

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
      title='AIX API Debugger'
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

        {/* History Size Preferenes */}
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
              No API requests recorded yet
            </Typography>
            <Typography sx={{ mt: 1 }}>
              Make a request with the AI to see it here
            </Typography>
          </>}
          {!activeFrame && (
            <Typography>
              Select a request to view details
            </Typography>
          )}
        </Box>
      )}

      {/* Frame viewer */}
      {!!activeFrame && (
        <Box sx={{ overflow: 'hidden' }}>
          <AixDebuggerFrame frame={activeFrame} />
        </Box>
      )}

    </GoodModal>
  );
}
