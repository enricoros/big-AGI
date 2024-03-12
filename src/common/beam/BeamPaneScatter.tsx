import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, ButtonGroup, FormControl, Typography } from '@mui/joy';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { animationEnterBelow } from '~/common/util/animUtils';

import { CONTROLS_RAY_PRESETS } from './BeamRayGrid';


export const beamControlsSx: SxProps = {
  // style
  // borderRadius: 'md',
  // backgroundColor: 'background.popup',
  backgroundColor: 'background.surface',
  boxShadow: 'md',
  p: 'var(--Pad)',
  zIndex: 1, // stay on top of messages, for shadow to cast on it
};

const beamScatterControlsSx: SxProps = {
  ...beamControlsSx,

  // layout: max 2 cols (/3 with gap) of min 200px per col
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(max(200px, 100%/4), 1fr))',
  gridAutoFlow: 'row dense',
  gap: 'var(--Pad_2)',

  // '& > *': { border: '1px solid red' },
};


export function BeamPaneScatter(props: {
  isMobile: boolean,
  llmComponent: React.ReactNode,
  rayCount: number,
  setRayCount: (n: number) => void,
  startEnabled: boolean,
  startBusy: boolean
  onStart: () => void,
  onStop: () => void,
}) {

  return (
    <Box sx={beamScatterControlsSx}>

      {/* Title */}
      <Box sx={{ display: 'flex', gap: 'var(--Pad_2)', my: 'auto' }}>
        {/*<Typography level='h4'>*/}
        {/*  <ChatBeamIcon sx={{ animation: `${animationColorDarkerRainbow} 2s linear 2.66` }} />*/}
        {/*</Typography>*/}
        <div>
          <Typography level='h4' component='h2'>
            {/*big-AGI · */}
            Beam
          </Typography>

          <Typography level='body-sm'>
            Combine the smarts of models
          </Typography>
        </div>
      </Box>

      {/* LLM cell */}
      <Box sx={{ display: 'flex', gap: 'calc(var(--Pad) / 2)', alignItems: 'center', justifyContent: props.isMobile ? undefined : 'center' }}>
        {props.llmComponent}
      </Box>

      {/* Count and Start cell */}
      <FormControl sx={{ flex: 1, display: 'flex', justifyContent: 'space-between' /* gridColumn: '1 / -1' */ }}>
        {!props.isMobile && <FormLabelStart title='Beam Count' />}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

          {/* xN buttons */}
          <ButtonGroup variant='outlined' sx={{ flex: 1, display: 'flex', '& > *': { flex: 1 } }}>
            {CONTROLS_RAY_PRESETS.map((n) => {
              const isActive = n === props.rayCount;
              return (
                <Button
                  key={n}
                  // variant={isActive ? 'solid' : undefined}
                  color='neutral'
                  onClick={() => props.setRayCount(n)}
                  sx={{
                    fontWeight: isActive ? 'xl' : 400, /* reset, from 600 */
                    backgroundColor: isActive ? 'background.popup' : undefined,
                    maxWidth: '3rem',
                  }}
                >
                  {`x${n}`}
                </Button>
              );
            })}
          </ButtonGroup>

          {!props.startBusy ? (
            // Start
            <Button
              variant='solid' color='success'
              disabled={!props.startEnabled || props.startBusy} loading={props.startBusy}
              endDecorator={<PlayArrowRoundedIcon />}
              onClick={props.onStart}
              sx={{ ml: 'auto', minWidth: 80, animation: `${animationEnterBelow} 0.1s ease-out` }}
            >
              Start
            </Button>
          ) : (
            // Stop
            <Button
              variant='solid' color='danger'
              endDecorator={<StopRoundedIcon />}
              onClick={props.onStop}
              sx={{ ml: 'auto', minWidth: 80, animation: `${animationEnterBelow} 0.1s ease-out` }}
            >
              Stop
            </Button>
          )}
        </Box>
      </FormControl>

    </Box>
  );
}