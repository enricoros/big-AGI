import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, ButtonGroup, FormControl, Radio, RadioGroup } from '@mui/joy';

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
        <FormControl>
          <FormLabelStart title={`Beam Fusion${gatherEnabled ? ` (${props.gatherCount})` : ''}`} />
          <RadioGroup size='sm' defaultValue='outlined' orientation='horizontal'>
            <Radio value='one' label='Pick Top' />
            <Radio value='many' label='Improve Best' />
            <Radio value='all' label='Fuse All' />
          </RadioGroup>
        </FormControl>
      )}

      <Button variant='solid' color='neutral' onClick={props.onClose} sx={{ ml: 'auto', minWidth: 100 }}>
        Close
      </Button>

    </Box>
  );
}