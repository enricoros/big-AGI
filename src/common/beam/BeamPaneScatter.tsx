import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, ButtonGroup, FormControl, Typography } from '@mui/joy';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { animationColorBeamGather, animationEnterBelow } from '~/common/util/animUtils';

import { SCATTER_RAY_PRESETS } from './beam.config';


export const beamControlsSx: SxProps = {
  // style
  // borderRadius: 'md',
  // backgroundColor: 'background.popup',
  backgroundColor: 'background.surface',
  boxShadow: 'md',
  px: 'var(--Pad)',
  py: 'calc(2 * var(--Pad) / 3)',
  zIndex: 1, // stay on top of messages, for shadow to cast on it
};

const beamScatterControlsSx: SxProps = {
  ...beamControlsSx,

  // layout: max 2 cols (/3 with gap) of min 200px per col
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(max(200px, 100%/3), 1fr))',
  gridAutoFlow: 'row dense',
  gap: 'var(--Pad_2)',

  // '& > *': { border: '1px solid red' },
};

const desktopBeamScatterControlsSx: SxProps = {
  ...beamScatterControlsSx,

  // the fact that this works, means we got the CSS and layout right
  position: 'sticky',
  top: 0,
};


export function BeamPaneScatter(props: {
  isMobile: boolean,
  rayCount: number,
  setRayCount: (n: number) => void,
  startEnabled: boolean,
  startBusy: boolean,
  onStart: () => void,
  onStop: () => void,
  onExplainerShow: () => any
}) {

  return (
    <Box sx={props.isMobile ? beamScatterControlsSx : desktopBeamScatterControlsSx}>

      {/* Title Cell */}
      <Box sx={{ my: 'auto' }}>
        <Typography
          level='h4' component='h2'
          onDoubleClick={props.onExplainerShow/* Undocumented way to re-run the wizard, for now */}
        >
          {props.startBusy
            ? <AutoAwesomeIcon sx={{ fontSize: '1rem', animation: `${animationColorBeamGather} 2s linear infinite` }} />
            : <AutoAwesomeOutlinedIcon sx={{ fontSize: '1rem' }} />} Beam

          {/*<ChatBeamIcon*/}
          {/*  sx={{*/}
          {/*    fontSize: '1rem',*/}
          {/*    ...props.startBusy && { animation: `${animationBeamGatherColor} 2s linear infinite` },*/}
          {/*  }} /> Beam*/}
        </Typography>
        <Typography level='body-sm'>
          Explore the solution space
        </Typography>
      </Box>

      {/* Count and Start cell */}
      <FormControl sx={{ flex: 1, display: 'flex', justifyContent: 'space-between' /* gridColumn: '1 / -1' */ }}>
        {!props.isMobile && <FormLabelStart title='Beam Count' />}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

          {/* xN buttons */}
          <ButtonGroup variant='outlined' sx={{ flex: 1, display: 'flex', '& > *': { flex: 1 } }}>
            {SCATTER_RAY_PRESETS.map((n) => {
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