import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, ButtonGroup, FormControl, Radio, RadioGroup, Typography } from '@mui/joy';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';

import { beamControlsSx } from './BeamPaneScatter';


const beamGatherControlsSx: SxProps = {
  ...beamControlsSx,

  // style
  borderTop: '1px solid',
  borderTopColor: 'neutral.outlinedBorder',

  // layout
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--Pad_2)',
};

export function BeamPaneGather(props: {
  isMobile: boolean,
  gatherCount: number
  gatherEnabled: boolean,
  gatherBusy: boolean,
  onStart: () => void,
  onStop: () => void,
  onClose: () => void,
}) {
  const { gatherCount, gatherEnabled, gatherBusy } = props;

  return (
    <Box sx={beamGatherControlsSx}>

      {/* Title */}
      <Box sx={{ display: 'flex', gap: 'var(--Pad_2)', my: 'auto' }}>
        {/*<Typography level='h4'>*/}
        {/*  <ChatBeamIcon sx={{ animation: `${animationColorDarkerRainbow} 2s linear 2.66` }} />*/}
        {/*</Typography>*/}
        <div>
          <Typography level='h4' component='h2'>
            Merge
          </Typography>

          <Typography level='body-sm'>
            Combine the replies
          </Typography>
        </div>
      </Box>


      {/* Algo */}
      {false && <FormControl disabled={!gatherEnabled}>
        {!props.isMobile && <FormLabelStart title={`Beam Fusion${gatherEnabled ? ` (${props.gatherCount})` : ''}`} />}
        <ButtonGroup disabled={!gatherEnabled} variant='soft' color='success'>
          <Button
            sx={{
              // fontWeight: isActive ? 'xl' : 400, /* reset, from 600 */
              // backgroundColor: isActive ? 'background.popup' : undefined,
              // maxWidth: '3rem',
            }}
          >
            test
          </Button>
          <Button variant='solid'>
            ya
          </Button>
          <Button>
            ya
          </Button>
        </ButtonGroup>
      </FormControl>}

      {gatherEnabled && (
        <FormControl sx={{mx: 'auto'}}>
          <FormLabelStart title={`Candidates ${gatherEnabled ? ` (${props.gatherCount})` : ''}`} />
          <RadioGroup size='sm' defaultValue='outlined' orientation='horizontal'>
            <Radio value='one' label='Choose' />
            <Radio value='many' label='Improve' />
            <Radio value='all' label='Fuse' />
          </RadioGroup>
        </FormControl>
      )}

      <Button variant='solid' color='neutral' onClick={props.onClose} sx={{ ml: 'auto', minWidth: 100 }}>
        Close
      </Button>

    </Box>
  );
}