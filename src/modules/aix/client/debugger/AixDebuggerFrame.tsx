import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Card, Chip, Divider, Sheet, Typography } from '@mui/joy';

import { RenderCodeMemo } from '~/modules/blocks/code/RenderCode';

import { ChipToggleButton } from '~/common/components/ChipToggleButton';
import TimelapseIcon from '@mui/icons-material/Timelapse';

import type { AixClientDebugger } from './memstore-aix-client-debugger';
import { AixDebuggerMeasurementsTable } from './AixDebuggerMeasurementsTable';


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

  // state
  const [showParticles, setShowParticles] = React.useState(false); // hide by default (heavy)

  const handleToggleShowParticles = React.useCallback(() => {
    setShowParticles(on => !on);
  }, []);

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
        <Typography color='warning' variant='soft' level='title-sm' sx={_styles.sheetTitle}>
          <span>-&gt; Headers</span>
        </Typography>
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
      </Sheet>

      {/* Body */}
      <Sheet variant='outlined' color='primary' sx={_styles.requestSheet}>
        <Typography color='primary' variant='soft' level='title-sm' sx={_styles.sheetTitle}>
          <span>-&gt; Body</span>
          {frame.bodySize > 0 && <span>{frame.bodySize.toLocaleString()} bytes</span>}
        </Typography>
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

      {/* Particles List */}
      <Box mb={showParticles ? -2 : undefined} sx={_styles.particleNorminal}>
        <Typography level='title-sm'>
          Particles {frame.particles.length > 0 && `(${frame.particles.length})`}
          {!frame.isComplete && ' • Streaming...'}
        </Typography>
        <ChipToggleButton text='show particles' active={showParticles} onClick={handleToggleShowParticles} />
      </Box>
      {showParticles && (
        <Sheet variant='outlined' color='neutral' sx={_styles.requestSheetParticles}>
          {/* Zero state */}
          {!frame.particles.length && (
            <Typography>
              No particles received yet
            </Typography>
          )}

          {/* List of particles */}
          {frame.particles.map((particle, idx) => {

            // truncated preview of particle content
            let jsonPreview = '';
            try {
              const content = particle.content;
              jsonPreview = JSON.stringify(content).substring(0, 1024);
              if (jsonPreview.length >= 1024) jsonPreview += '...';
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
        </Sheet>
      )}
    </Box>
  );
}
