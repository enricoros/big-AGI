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

import { BEAM_GATHER_COLOR } from './beam.config';
import { beamControlsSx } from './BeamPaneScatter';


const beamGatherControlsSx: SxProps = {
  ...beamControlsSx,

  // style
  borderTop: '1px solid',
  borderTopColor: 'neutral.outlinedBorder',

  // layout
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  columnGap: 'var(--Pad_2)',
  rowGap: 'var(--Pad)',
  py: 'calc(2 * var(--Pad) / 3)',
};

const desktopBeamControlsSx: SxProps = {
  ...beamGatherControlsSx,

  // undo the larger mobile padding
  rowGap: 'var(--Pad_2)',

  // the fact that this works, means we got the CSS and layout right
  position: 'sticky',
  bottom: 0,
};


export function BeamPaneGather(props: {
  gatherBusy: boolean,
  gatherCount: number
  gatherEnabled: boolean,
  isMobile: boolean,
  mergeLlmComponent: React.ReactNode,
  mergeLlmVendorIcon?: React.FunctionComponent<SvgIconProps>,
  onStart: () => void,
  onStop: () => void,
  onClose: () => void,
}) {
  const { gatherCount, gatherEnabled, gatherBusy } = props;

  const Icon = props.mergeLlmVendorIcon || (gatherBusy ? AutoAwesomeIcon : AutoAwesomeOutlinedIcon);

  return (
    <Box sx={props.isMobile ? beamGatherControlsSx : desktopBeamControlsSx}>


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
          {['Guided', 'Auto'].map((n, idx) => {
            const isActive = idx === 0; //fasn === props.rayCount;
            return (
              <Button
                key={n}
                color={isActive ? BEAM_GATHER_COLOR : 'neutral'}
                // size='sm'
                sx={{
                  // backgroundColor: isActive ? 'background.popup' : undefined,
                  backgroundColor: isActive ? `${BEAM_GATHER_COLOR}.softBg` : 'background.popup',
                  fontWeight: isActive ? 'xl' : 400, /* reset, from 600 */
                  // width: '3.125rem',
                  // minHeight: '2.25rem',
                }}
              >
                {n}
              </Button>
            );
          })}
        </ButtonGroup>
      </FormControl>

      {/* Method (Radio)*/}
      {/*<FormControl>*/}
      {/*  <FormLabelStart title={<><AutoAwesomeRoundedIcon sx={{ fontSize: 'md', mr: 0.5 }} />Method</>} sx={{ mb: '0.25rem' /* orig: 6px } />*!/*/}
      {/*  <RadioGroup orientation={props.isMobile ? 'vertical' : 'horizontal'}>*/}
      {/*    <Radio color={BEAM_GATHER_COLOR} value='one' label='Guided' />*/}
      {/*    <Radio color={BEAM_GATHER_COLOR} value='many' label={<Typography>Fusion</Typography>} />*/}
      {/*    /!*<Radio value='one' label={<Typography startDecorator={<AutoAwesomeRoundedIcon />}>Chooose</Typography>} />*!/*/}
      {/*    /!*<Radio value='many' label={<Typography startDecorator={<AutoAwesomeRoundedIcon />}>Improve</Typography>} />*!/*/}
      {/*    /!*<Radio value='all' label={<Typography startDecorator={<AutoAwesomeRoundedIcon />}>Fuse</Typography>} />*!/*/}
      {/*    /!*<Radio value='manual' label='Manual' />*!/*/}
      {/*  </RadioGroup>*/}
      {/*</FormControl>*/}

      {/* LLM */}
      <Box sx={{ my: '-0.25rem', minWidth: 190, maxWidth: 220 }}>
        {props.mergeLlmComponent}
      </Box>

      {/* Start / Stop buttons */}
      {!gatherBusy ? (
        <Button
          // key='gather-start' // used for animation triggering, which we don't have now
          variant='solid' color={BEAM_GATHER_COLOR}
          disabled={!gatherEnabled || gatherBusy} loading={gatherBusy}
          endDecorator={<MergeRoundedIcon />}
          onClick={props.onStart}
          sx={{ minWidth: 120 }}
        >
          Merge
        </Button>
      ) : (
        <Button
          // key='gather-stop'
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