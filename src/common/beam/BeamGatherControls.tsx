import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, ButtonGroup, FormControl, Typography } from '@mui/joy';

import { beamControlsSx } from './BeamScatterControls';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';


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

      {/* Algo */}
      <FormControl>
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

      <Typography sx={{ flex: 1, whiteSpace: 'break-spaces', border: '1px solid red' }}>
        {JSON.stringify(props)}
      </Typography>

      <Button variant='solid' color='neutral' onClick={props.onClose} sx={{ ml: 'auto', minWidth: 100 }}>
        Close
      </Button>

    </Box>
  );
}