import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, ButtonGroup, FormControl, SvgIconProps, Typography } from '@mui/joy';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import MergeRoundedIcon from '@mui/icons-material/MergeRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { ScrollToBottomButton } from '~/common/scroll-to-bottom/ScrollToBottomButton';
import { animationColorBeamGather } from '~/common/util/animUtils';
import { useScrollToBottom } from '~/common/scroll-to-bottom/useScrollToBottom';

import { BEAM_GATHER_COLOR } from '../beam.config';
import { beamPaneSx } from '../BeamCard';

import { beamFusionSpecs } from './beam.gather';


const mobileBeamGatherPane: SxProps = {
  ...beamPaneSx,
  borderTop: '1px solid',
  borderTopColor: 'neutral.outlinedBorder',

  // [mobile] larger gap in between rows, as on mobile we have a smaller gap
  rowGap: 'var(--Pad)',
};

const desktopBeamGatherPaneSx: SxProps = {
  ...beamPaneSx,
  borderTop: '1px solid',
  borderTopColor: 'neutral.outlinedBorder',

  // [desktop] keep visible at the bottom
  position: 'sticky',
  bottom: 0,
};


export function BeamGatherPane(props: {
  isMobile: boolean,
  gatherBusy: boolean,
  gatherCount: number,
  gatherEnabled: boolean,
  gatherLlmComponent: React.ReactNode,
  gatherLlmIcon?: React.FunctionComponent<SvgIconProps>,
  fusionIndex: number | null,
  setFusionIndex: (index: number | null) => void
  onStartFusion: () => void,
  onStopFusion: () => void,
}) {

  // external state
  const { setStickToBottom } = useScrollToBottom();

  // derived state
  const { gatherCount, gatherEnabled, gatherBusy, setFusionIndex } = props;

  const handleFusionActivate = React.useCallback((idx: number, shiftPressed: boolean) => {
    setStickToBottom(true);
    setFusionIndex((idx !== props.fusionIndex || !shiftPressed) ? idx : null);
  }, [props.fusionIndex, setFusionIndex, setStickToBottom]);


  const Icon = props.gatherLlmIcon || (gatherBusy ? AutoAwesomeIcon : AutoAwesomeOutlinedIcon);


  return (
    <Box sx={props.isMobile ? mobileBeamGatherPane : desktopBeamGatherPaneSx}>


      {/* Title */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, minWidth: 184 }}>
        <div>
          <Typography level='h4' component='h2'>
            <Icon sx={{ fontSize: '1rem', animation: gatherBusy ? `${animationColorBeamGather} 2s linear infinite` : undefined }} /> Merge
          </Typography>
          <Typography level='body-sm' sx={{ whiteSpace: 'nowrap' }}>
            Combine the {gatherCount > 1 ? `${gatherCount} replies` : 'replies'}
          </Typography>
        </div>
        <ScrollToBottomButton inline />
      </Box>

      {/* Method */}
      <FormControl sx={{ my: '-0.25rem' }}>
        <FormLabelStart title={<><AutoAwesomeOutlinedIcon sx={{ fontSize: 'md', mr: 0.5 }} />Method</>} sx={{ mb: '0.25rem' /* orig: 6px */ }} />
        <ButtonGroup variant='outlined'>
          {beamFusionSpecs.map((spec, idx) => {
            const isActive = idx === props.fusionIndex;
            return (
              <Button
                key={'gather-method-' + spec.fType}
                color={isActive ? BEAM_GATHER_COLOR : 'neutral'}
                onClick={event => handleFusionActivate(idx, !!event?.shiftKey)}
                // size='sm'
                sx={{
                  // backgroundColor: isActive ? 'background.popup' : undefined,
                  backgroundColor: isActive ? `${BEAM_GATHER_COLOR}.softBg` : 'background.popup',
                  fontWeight: isActive ? 'xl' : 400, /* reset, from 600 */
                  // minHeight: '2.25rem',
                }}
              >
                {spec.fLabel}
              </Button>
            );
          })}
        </ButtonGroup>
      </FormControl>

      {/* LLM */}
      <Box sx={{ my: '-0.25rem', minWidth: 190, maxWidth: 220 }}>
        {props.gatherLlmComponent}
      </Box>

      {/* Start / Stop buttons */}
      {!gatherBusy ? (
        <Button
          // key='gather-start' // used for animation triggering, which we don't have now
          variant='solid' color={BEAM_GATHER_COLOR}
          disabled={!gatherEnabled || gatherBusy} loading={gatherBusy}
          endDecorator={<MergeRoundedIcon />}
          onClick={props.onStartFusion}
          sx={{ minWidth: 120 }}
        >
          Merge
        </Button>
      ) : (
        <Button
          // key='gather-stop'
          variant='solid' color='danger'
          endDecorator={<StopRoundedIcon />}
          onClick={props.onStopFusion}
          sx={{ minWidth: 120 }}
        >
          Stop
        </Button>
      )}

    </Box>
  );
}