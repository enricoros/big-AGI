import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, ButtonGroup, FormControl, Radio, RadioGroup, Typography } from '@mui/joy';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { ScrollToBottomButton } from '~/common/scroll-to-bottom/ScrollToBottomButton';

import { beamControlsSx } from './BeamPaneScatter';


const beamGatherControlsSx: SxProps = {
  ...beamControlsSx,

  // style
  borderTop: '1px solid',
  borderTopColor: 'neutral.outlinedBorder',

  // the fact that this works, means we got the CSS and layout right
  position: 'sticky',
  bottom: 0,

  // layout
  display: 'flex',
  alignItems: 'center',
  // display: 'grid',
  // gridTemplateColumns: 'repeat(auto-fit, minmax(max(200px, 100%/4), 1fr))',
  // gridAutoFlow: 'row dense',
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
        <Box sx={{ my: 'auto' }}>
          <ScrollToBottomButton inline />
        </Box>
        <div>
          <Typography level='h4' component='h2'>
            <AutoAwesomeOutlinedIcon sx={{ fontSize: '1rem' }} /> Merge
          </Typography>

          <Typography level='body-sm'>
            Combine {gatherCount > 1 ? `the ${gatherCount} replies` : 'the replies'}
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

      {/*{gatherEnabled && (*/}
      {/*  // <FormControl sx={{ mx: 'auto' }}>*/}
      {/*  //   <FormLabelStart title={`Candidates ${gatherEnabled ? ` (${props.gatherCount})` : ''}`} />*/}
      <RadioGroup size='sm' orientation={props.isMobile ? 'vertical' : 'horizontal'} sx={{ mx: 'auto' }}>
        <Radio value='one' label={<Typography startDecorator={<AutoAwesomeRoundedIcon />}>Chooose</Typography>} />
        {/*<Radio value='many' label={<Typography startDecorator={<AutoAwesomeRoundedIcon />}>Improve</Typography>} />*/}
        <Radio value='all' label={<Typography startDecorator={<AutoAwesomeRoundedIcon />}>Fuse</Typography>} />
        <Radio value='manual' label='Manual' />
      </RadioGroup>
      {/*// </FormControl>*/}
      {/*)}*/}

      <Button variant='solid' color='neutral' onClick={props.onClose} sx={{ ml: 'auto', minWidth: 100 }}>
        Close
      </Button>

    </Box>
  );
}