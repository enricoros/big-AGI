import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, ButtonGroup, FormControl, Typography } from '@mui/joy';

import { beamControlsSx } from './BeamScatterControls';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';


const beamGatherControlsSx: SxProps = {
  ...beamControlsSx,
  borderTop: '1px solid',
  borderTopColor: 'neutral.outlinedBorder',
};

export function BeamGatherControls(props: {
  isMobile: boolean,
  gatherEnabled: boolean,
  gatherBusy: boolean,
  onStart: () => void,
  onStop: () => void,
  onClose: () => void
}) {

  return (
    <Box sx={beamGatherControlsSx}>

      {/* Title */}
      <Box sx={{ display: 'flex', gap: 'var(--Pad_2)', my: 'auto', border: '2px solid red' }}>
        {/*<Typography level='h4'>*/}
        {/*  <ChatBeamIcon sx={{ animation: `${animationColorDarkerRainbow} 2s linear 2.66` }} />*/}
        {/*</Typography>*/}
        <div>
          <Typography level='h4' component='h2'>
            {/*big-AGI · */}
            Gather
          </Typography>

          <Typography level='body-sm'>
            Test
          </Typography>
        </div>
      </Box>

      <Box sx={{ whiteSpace: 'break-spaces', border: '2px solid red' }}>
        {JSON.stringify(props)}
      </Box>

      {/* Algo */}
      <FormControl sx={{ flex: 1, display: 'flex', justifyContent: 'space-between' /* gridColumn: '1 / -1' */ }}>
        {!props.isMobile && <FormLabelStart title='Beam Fusion' />}

        <ButtonGroup variant='soft' color='success'>
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

          {/*{[2, 4, 8].map((n) => {*/}
          {/*  const isActive = n === props.rayCount;*/}
          {/*  return (*/}
          {/*    <Button*/}
          {/*      key={n}*/}
          {/*      // variant={isActive ? 'solid' : undefined}*/}
          {/*      color='neutral'*/}
          {/*      onClick={() => props.setRayCount(n)}*/}
          {/*    >*/}
          {/*      {`x${n}`}*/}
          {/*    </Button>*/}
          {/*  );*/}
          {/*})}*/}
        </ButtonGroup>
      </FormControl>


      <Button variant='solid' color='neutral' onClick={props.onClose} sx={{ ml: 'auto', minWidth: 100 }}>
        Close
      </Button>

    </Box>
  );
}