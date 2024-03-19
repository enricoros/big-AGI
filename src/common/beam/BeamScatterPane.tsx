import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, ButtonGroup, FormControl, Typography } from '@mui/joy';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { animationColorBeamScatter } from '~/common/util/animUtils';

import { BEAM_SCATTER_COLOR, SCATTER_RAY_PRESETS } from './beam.config';


// [shared] scatter/gather pane style
export const beamPaneSx: SxProps = {
  // style
  backgroundColor: 'background.surface', // background.popup
  boxShadow: 'md',
  p: 'var(--Pad)',
  // py: 'calc(2 * var(--Pad) / 3)',
  zIndex: 1, // cast shadow on the rays/fusion

  // layout
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--Pad_2)',
};

const desktopBeamScatterPaneSx: SxProps = {
  ...beamPaneSx,

  // the fact that this works, means we got the CSS and layout right
  position: 'sticky',
  top: 0,
};


export function BeamScatterPane(props: {
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
    <Box sx={props.isMobile ? beamPaneSx : desktopBeamScatterPaneSx}>

      {/* Title */}
      <Box>
        <Typography
          level='h4' component='h2'
          onDoubleClick={props.onExplainerShow/* Undocumented way to re-run the wizard, for now */}
        >
          {props.startBusy
            ? <AutoAwesomeIcon sx={{ fontSize: '1rem', animation: `${animationColorBeamScatter} 2s linear infinite` }} />
            : <AutoAwesomeOutlinedIcon sx={{ fontSize: '1rem' }} />} Beam
        </Typography>
        <Typography level='body-sm' sx={{ whiteSpace: 'nowrap' }}>
          Explore the solution space
        </Typography>
      </Box>

      {/* Ray presets */}
      <FormControl sx={{ my: '-0.25rem' }}>
        <FormLabelStart title='Beam Count' sx={{ mb: '0.25rem' /* orig: 6px */ }} />
        <ButtonGroup variant='outlined'>
          {SCATTER_RAY_PRESETS.map((n) => {
            const isActive = n === props.rayCount;
            return (
              <Button
                key={n}
                // variant={isActive ? 'solid' : undefined}
                color={isActive ? BEAM_SCATTER_COLOR : 'neutral'}
                // color='neutral'
                size='sm'
                onClick={() => props.setRayCount(n)}
                sx={{
                  // backgroundColor: isActive ? 'background.popup' : undefined,
                  backgroundColor: isActive ? `${BEAM_SCATTER_COLOR}.softBg` : 'background.popup',
                  fontWeight: isActive ? 'xl' : 400, /* reset, from 600 */
                  width: '3.125rem',
                }}
              >
                {`x${n}`}
              </Button>
            );
          })}
        </ButtonGroup>
      </FormControl>

      {/* Start / Stop buttons */}
      {!props.startBusy ? (
        <Button
          // key='scatter-start' // used for animation triggering, which we don't have now
          variant='solid' color={BEAM_SCATTER_COLOR}
          disabled={!props.startEnabled || props.startBusy} loading={props.startBusy}
          endDecorator={<PlayArrowRoundedIcon />}
          onClick={props.onStart}
          sx={{ minWidth: 120 }}
        >
          Start
        </Button>
      ) : (
        <Button
          // key='scatter-stop'
          variant='solid' color='danger'
          endDecorator={<StopRoundedIcon />}
          onClick={props.onStop}
          sx={{ minWidth: 120 }}
        >
          Stop
        </Button>
      )}

    </Box>
  );
}