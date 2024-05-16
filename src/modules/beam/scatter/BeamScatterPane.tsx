import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, ButtonGroup, FormControl, Typography } from '@mui/joy';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { animationColorBeamScatter } from '~/common/util/animUtils';

import type { BeamStoreApi } from '../store-beam.hooks';
import { BEAM_BTN_SX, SCATTER_COLOR, SCATTER_RAY_PRESETS } from '../beam.config';
import { BeamScatterDropdown } from './BeamScatterPaneDropdown';
import { beamPaneSx } from '../BeamCard';


const scatterPaneSx: SxProps = {
  ...beamPaneSx,
  backgroundColor: 'background.popup',

  // [desktop] scatter: primary-chan shadow
  // boxShadow: '0px 6px 12px -8px rgb(var(--joy-palette-primary-darkChannel) / 35%)',
  // boxShadow: '0px 16px 16px -24px rgb(var(--joy-palette-primary-darkChannel) / 35%)',
  boxShadow: '0px 6px 16px -12px rgb(var(--joy-palette-primary-darkChannel) / 50%)',
  // boxShadow: '0px 8px 20px -16px rgb(var(--joy-palette-primary-darkChannel) / 30%)',
};

const mobileScatterPaneSx: SxProps = scatterPaneSx;

const desktopScatterPaneSx: SxProps = {
  ...scatterPaneSx,

  // the fact that this works, means we got the CSS and layout right
  position: 'sticky',
  top: 0,
};


export function BeamScatterPane(props: {
  beamStore: BeamStoreApi
  isMobile: boolean,
  rayCount: number,
  setRayCount: (n: number) => void,
  startEnabled: boolean,
  startBusy: boolean,
  onStart: () => void,
  onStop: () => void,
  onExplainerShow: () => any,
}) {

  const dropdownMemo = React.useMemo(() => (
    <BeamScatterDropdown
      beamStore={props.beamStore}
      onExplainerShow={props.onExplainerShow}
    />
  ), [props.beamStore, props.onExplainerShow]);

  return (
    <Box sx={props.isMobile ? mobileScatterPaneSx : desktopScatterPaneSx}>

      {/* Title */}
      <Box>
        <Typography
          level='h4' component='h3'
          endDecorator={dropdownMemo}
          // sx={{ my: 0.25 }}
        >
          {props.startBusy
            ? <AutoAwesomeIcon sx={{ fontSize: '1rem', mr: 0.625, animation: `${animationColorBeamScatter} 2s linear infinite` }} />
            : <AutoAwesomeOutlinedIcon sx={{ fontSize: '1rem', mr: 0.625 }} />}Beam
        </Typography>
        <Typography level='body-sm' sx={{ whiteSpace: 'nowrap' }}>
          Explore different replies
          {/* Explore the solution space */}
        </Typography>
      </Box>

      {/* Ray presets */}
      <FormControl sx={{ my: '-0.25rem' }}>
        <FormLabelStart title='Beam Count' sx={/*{ mb: '0.25rem' }*/ undefined} />
        <ButtonGroup variant='outlined'>
          {SCATTER_RAY_PRESETS.map((n) => {
            const isActive = n === props.rayCount;
            return (
              <Button
                key={n}
                // variant={isActive ? 'solid' : undefined}
                color={isActive ? SCATTER_COLOR : 'neutral'}
                // color='neutral'
                size='sm'
                onClick={() => props.setRayCount(n)}
                sx={{
                  // backgroundColor: isActive ? 'background.popup' : undefined,
                  backgroundColor: isActive ? `${SCATTER_COLOR}.softBg` : 'background.popup',
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
          variant='solid' color={SCATTER_COLOR}
          disabled={!props.startEnabled || props.startBusy} loading={props.startBusy}
          endDecorator={<PlayArrowRoundedIcon />}
          onClick={props.onStart}
          sx={BEAM_BTN_SX}
        >
          Start
        </Button>
      ) : (
        <Button
          // key='scatter-stop'
          variant='solid' color='danger'
          endDecorator={<StopRoundedIcon />}
          onClick={props.onStop}
          sx={BEAM_BTN_SX}
        >
          Stop
          {/*{props.rayCount > props.raysReady && ` (${props.rayCount - props.raysReady})`}*/}
        </Button>
      )}

    </Box>
  );
}