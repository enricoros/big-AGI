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

  // layout
  display: 'flex',
  alignItems: 'center',
  // display: 'grid',
  // gridTemplateColumns: 'repeat(auto-fit, minmax(max(200px, 100%/4), 1fr))',
  // gridAutoFlow: 'row dense',
  gap: 'var(--Pad_2)',
};

const desktopBeamControlsSx: SxProps = {
  ...beamGatherControlsSx,

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
  onStart: () => void,
  onStop: () => void,
  onClose: () => void,
}) {
  const { gatherCount, gatherEnabled, gatherBusy } = props;

  return (
    <Box sx={props.isMobile ? beamGatherControlsSx : desktopBeamControlsSx}>

      {/* Title */}
      <Box sx={{ display: 'flex', gap: 'var(--Pad_2)', my: 'auto' }}>
        {/*<Typography level='h4'>*/}
        {/*  <ChatBeamIcon sx={{ animation: `${animationColorDarkerRainbow} 2s linear 2.66` }} />*/}
        {/*</Typography>*/}
        <div>
          <Typography level='h4' component='h2'>
            <AutoAwesomeOutlinedIcon sx={{ fontSize: '1rem' }} /> Merge
          </Typography>

          <Typography level='body-sm'>
            Combine the {gatherCount > 1 ? `${gatherCount} replies` : 'replies'}
          </Typography>
        </div>
        <Box sx={{ my: 'auto' }}>
          <ScrollToBottomButton inline />
        </Box>
      </Box>

      {/* LLM cell */}
      <Box sx={{ display: 'flex', gap: 'calc(var(--Pad) / 2)', alignItems: 'center', justifyContent: props.isMobile ? undefined : 'center' }}>
        {props.mergeLlmComponent}
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