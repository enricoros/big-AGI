import * as React from 'react';

import { Box, Card, Chip, Divider, Typography } from '@mui/joy';

import { ChipToggleButton } from '~/common/components/ChipToggleButton';
import TimelapseIcon from '@mui/icons-material/Timelapse';

import type { AixClientDebugger } from './memstore-aix-client-debugger';
import { AixDebuggerMeasurementsTable } from './AixDebuggerMeasurementsTable';


const _styles = {

  requestCard: {
    overflow: 'auto',
    boxShadow: 'inset 2px 0 4px -2px rgba(0, 0, 0, 0.2)',
    fontFamily: 'code',
    fontSize: 'xs',
    p: 1.5,
    gap: 1,
  } as const,

  requestCardText: {
    whiteSpace: 'pre',
  } as const,

  particleNorminal: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as const,

  particleAborted: {
    // ..._styles.particleNorminal,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    // change look
    backgroundColor: '#f9f9f9',
    borderLeft: '3px solid orange',
  } as const,

  pTime: {
    pl: 2,
    fontSize: 'xs',
    whiteSpace: 'nowrap',
  } as const,

} as const;


export function AixDebuggerFrame(props: {
  frame: AixClientDebugger.Frame;
}) {

  // state
  const [showParticles, setShowParticles] = React.useState(false); // hide by default (heavy)

  const handleToggleShowParticles = React.useCallback(() => {
    setShowParticles(on => !on);
  }, []);

  const { frame } = props;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

      {/* Frame Header */}
      <Box sx={{ fontSize: 'sm', display: 'grid', gridTemplateColumns: { xs: 'auto 1fr', md: 'auto 1fr auto 1fr' }, gap: 1, alignItems: 'center' }}>
        <Typography fontWeight='bold'>Request </Typography>
        <Typography fontWeight='bold'>{frame.id}</Typography>
        <div>Status:</div>
        <Chip variant='soft' color={frame.isComplete ? 'success' : 'warning'}>{frame.isComplete ? 'Complete' : 'In Progress'}</Chip>
        <div>Date</div>
        <div>{new Date(frame.timestamp).toLocaleString()}</div>
        <div>-&gt; URL:</div>
        <Chip>{frame.url || 'No URL data available'}</Chip>
        <div>Context:</div>
        <Chip>{frame.context.contextName}</Chip>
        <div>Reference:</div>
        <Chip>{frame.context.contextRef}</Chip>
      </Box>

      {/* Headers */}
      <Card variant='soft' color='warning' sx={_styles.requestCard}>
        <Typography color='warning' variant='soft' level='title-sm'>
          -&gt; Headers
        </Typography>
        <Divider />
        <Box sx={_styles.requestCardText}>
          {frame.headers || 'No headers data available'}
        </Box>
      </Card>

      {/* Body */}
      <Card variant='soft' color='primary' sx={_styles.requestCard}>
        <Typography color='primary' variant='soft' level='title-sm'>
          -&gt; Body
        </Typography>
        <Divider />
        <Box sx={_styles.requestCardText}>
          {frame.body || 'No headers data available'}
        </Box>
      </Card>

      {/* Performance Profiler */}
      <Card variant='soft' color='success' sx={_styles.requestCard}>
        <Typography color='success' variant='soft' level='title-sm' startDecorator={<TimelapseIcon />}>
          Internal Profiler:
        </Typography>
        {!!frame.profilerMeasurements?.length ? (
          <AixDebuggerMeasurementsTable measurements={frame.profilerMeasurements} />
        ) : (
          'No profiler measurements available. Note: profiling is not available in production.'
        )}
      </Card>

      {/* Particles List */}
      <Box mb={showParticles ? -2 : undefined} sx={_styles.particleNorminal}>
        <Typography level='title-sm'>
          Particles {frame.particles.length > 0 && `(${frame.particles.length})`}
          {!frame.isComplete && ' • Streaming...'}
        </Typography>
        <ChipToggleButton
          text='show particles'
          active={showParticles}
          onClick={handleToggleShowParticles}
        />
      </Box>
      {showParticles && <Card variant='soft' sx={_styles.requestCard}>

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

      </Card>}
    </Box>
  );
}
