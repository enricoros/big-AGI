import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Card, Chip, Divider, Sheet, Typography } from '@mui/joy';

import { RenderCodeMemo } from '~/modules/blocks/code/RenderCode';

import { ExpanderControlledBox } from '~/common/components/ExpanderControlledBox';
import { objectDeepCloneWithStringLimit } from '~/common/util/objectUtils';
import TimelapseIcon from '@mui/icons-material/Timelapse';

import type { AixClientDebugger } from './memstore-aix-client-debugger';
import { AixDebuggerMeasurementsTable } from './AixDebuggerMeasurementsTable';
import { useAixClientDebuggerStore } from './memstore-aix-client-debugger';


const _styles = {
  requestSheet: {
    // backgroundColor: 'background.popup',
    borderRadius: 'sm',
    boxShadow: 'md',
    // boxShadow: 'inset 2px 2px 4px -2px rgba(0, 0, 0, 0.2)',
    overflow: 'auto',
    // fontSize: 'calc(var(--joy-fontSize-xs) - 1px)',
    fontSize: 'xs',
  },

  sheetTitle: {
    px: 1.5,
    py: 0.75,
    fontSize: 'sm',
    display: 'flex',
    justifyContent: 'space-between',
  },

  sheetTitleClickable: {
    px: 1.5,
    py: 0.75,
    fontSize: 'sm',
    display: 'flex',
    justifyContent: 'space-between',
    cursor: 'pointer',
    userSelect: 'none',
  },

  requestSheetParticles: {
    // backgroundColor: 'background.popup',
    borderRadius: 'sm',
    // boxShadow: 'md',
    overflow: 'auto',
    p: 1,
    fontFamily: 'code',
    fontSize: 'xs',
    lineHeight: 'xl',
  },

  particleNorminal: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  particleAborted: {
    // ..._styles.particleNorminal,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    // change look
    backgroundColor: '#f9f9f9',
    borderLeft: '3px solid orange',
  },

  pTime: {
    pl: 1,
    whiteSpace: 'nowrap',
  },
} as const satisfies Record<string, SxProps>;


export function AixDebuggerFrame(props: {
  frame: AixClientDebugger.Frame;
}) {

  // state: section open/close is kept in the debugger store so it persists across frame switches
  const { showHeaders, showBody, showParticles, toggleOpenState } = useAixClientDebuggerStore(useShallow(state => ({
    showHeaders: !!state.openStates.headers,
    showBody: !!state.openStates.body,
    showParticles: !!state.openStates.particles,
    toggleOpenState: state.toggleOpenState,
  })));

  const handleToggleShowHeaders = React.useCallback(() => toggleOpenState('headers'), [toggleOpenState]);
  const handleToggleShowBody = React.useCallback(() => toggleOpenState('body'), [toggleOpenState]);
  const handleToggleShowParticles = React.useCallback(() => toggleOpenState('particles'), [toggleOpenState]);

  const { frame } = props;

  const contextName = frame.context?.contextName || '';
  const isConversation = contextName === 'conversation';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--Card-padding, 1rem)' }}>
      {/* Frame Header */}
      <Box sx={{ fontSize: 'sm', display: 'grid', gridTemplateColumns: { xs: 'auto 1fr', md: 'auto auto auto auto' }, gap: 0.5, alignItems: 'center' }}>
        <div>Request</div>
        <Box fontWeight='md'>#{frame.id}</Box>
        <div>Status:</div>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Chip variant={frame.transport !== 'csf' ? undefined : 'solid'} color={frame.transport === 'csf' ? 'primary' : 'success'}>
            {frame.transport === 'csf' ? 'Direct Connection' : 'Edge Server'}
          </Chip>
          <Chip variant={frame.isComplete ? undefined : 'solid'} color={frame.isComplete ? 'success' : 'warning'}>
            {frame.isComplete ? 'Done' : 'In Progress'}
          </Chip>
        </Box>
        <div>Date</div>
        <div>{new Date(frame.timestamp).toLocaleString()}</div>
        <div>-&gt; URL:</div>
        <div className='agi-ellipsize'>{decodeURIComponent(frame.url) || 'No URL data available'}</div>
        <div>Context:</div>
        <Chip variant={isConversation ? 'soft' : 'solid'} color='primary'>
          {contextName}
        </Chip>
        <div>Reference:</div>
        <div>{frame.context.contextRef}</div>
      </Box>

      {/* Headers */}
      <Sheet variant='outlined' color='warning' sx={_styles.requestSheet}>
        <Typography color='warning' variant='soft' level='title-sm' sx={_styles.sheetTitleClickable} onClick={handleToggleShowHeaders}>
          <span>-&gt; Headers</span>
          <Box component='span' typography='body-xs'>{showHeaders ? 'hide' : 'show headers'}</Box>
        </Typography>
        <ExpanderControlledBox expanded={showHeaders}>
          <Divider />
          {frame.headers ? (
            <RenderCodeMemo
              semiStableId={`aix-dbg-headers-${frame.id}`}
              title='json'
              code={frame.headers}
              isPartial={false}
              renderHideTitle
              optimizeLightweight
            />
          ) : (
            <Box sx={_styles.sheetTitle}>No headers data available</Box>
          )}
        </ExpanderControlledBox>
      </Sheet>

      {/* Body */}
      <Sheet variant='outlined' color='primary' sx={_styles.requestSheet}>
        <Typography color='primary' variant='soft' level='title-sm' sx={_styles.sheetTitleClickable} onClick={handleToggleShowBody}>
          <span>-&gt; Body</span>
          {frame.bodySize > 0 && <span>{frame.bodySize.toLocaleString()} bytes</span>}
        </Typography>
        <ExpanderControlledBox expanded={showBody}>
          <Divider />
          {frame.body ? (
            <RenderCodeMemo
              semiStableId={`aix-dbg-body-${frame.id}`}
              title='json'
              code={frame.body}
              isPartial={false}
              renderHideTitle
              optimizeLightweight
            />
          ) : (
            <Box sx={_styles.sheetTitle}>Waiting for transmitted body data...</Box>
          )}
        </ExpanderControlledBox>
      </Sheet>

      {/* Particles List */}
      <Sheet variant='outlined' sx={_styles.requestSheet}>
        <Typography level='title-sm' variant='soft' color='neutral' sx={_styles.sheetTitleClickable} onClick={handleToggleShowParticles}>
          <span>&lt;- Particles {!frame.isComplete && ' - In Progress...'}{frame.particles.length > 0 && ` (${frame.particles.length})`}</span>
          <Box component='span' typography='body-xs'>{showParticles ? 'hide' : 'show particles'}</Box>
        </Typography>
        {showParticles && <Sheet variant='plain' sx={_styles.requestSheetParticles}>
          {/* Zero state */}
          {!frame.particles.length && <div>No particles received yet</div>}

          {/* List of particles */}
          {frame.particles.map((particle, idx) => {

            // preview of particle content: preserve structure, trim long string fields
            let jsonPreview = '';
            try {
              jsonPreview = JSON.stringify(objectDeepCloneWithStringLimit(particle.content, 'aix-debugger-particle', 64));
            } catch (e) {
              jsonPreview = 'Error parsing content';
            }

            return (
              <Box key={idx} sx={particle.isAborted ? _styles.particleAborted : _styles.particleNorminal}>
                <Box className='agi-ellipsize'>
                  <span style={{ opacity: 0.5 }}>{idx + 1}:</span> {particle.isAborted ? ' (Aborted)' : ''} {jsonPreview}
                </Box>
                <Box sx={_styles.pTime}>
                  {new Date(particle.timestamp).toLocaleTimeString()}
                </Box>
              </Box>
            );
          })}
        </Sheet>}
      </Sheet>

      {/* Performance Profiler */}
      {!!frame.profilerMeasurements?.length && (
        <Sheet variant='outlined' color='neutral' sx={_styles.requestSheet}>
          <Typography level='title-sm' startDecorator={<TimelapseIcon />} sx={{ ..._styles.sheetTitle, justifyContent: undefined }}>
            Internal Profiler:
          </Typography>
          {!!frame.profilerMeasurements?.length ? (
            <AixDebuggerMeasurementsTable measurements={frame.profilerMeasurements} />
          ) : (
            'No profiler measurements available. Note: profiling is not available in production.'
          )}
        </Sheet>
      )}
    </Box>
  );
}
