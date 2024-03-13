import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Box, Typography } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

import { BeamStoreApi, useBeamStore } from '~/common/beam/store-beam.hooks';

import { FadeInButton } from './ChatDrawerItem';
import { animationColorBeamGather, animationColorBeamScatter, animationEnterBelow } from '~/common/util/animUtils';


export function ChatBarAltBeam(props: {
  beamStore: BeamStoreApi,
}) {

  const { closebeam, isScattering, isGathering } = useBeamStore(props.beamStore, useShallow((store) => ({
    // state
    isScattering: store.isScattering,
    isGathering: store.isGathering,
    // actions
    closebeam: store.close,
  })));

  return (
    <Box sx={{ display: 'flex', gap: { xs: 1, md: 3 }, alignItems: 'center' }}>

      {/*<ChatBeamIcon sx={{ fontSize: 'md' }} />*/}

      <Typography level='title-md'>
        <Box
          component='span'
          sx={
            isGathering ? { animation: `${animationColorBeamGather} 3s infinite, ${animationEnterBelow} 0.6s`, px: 1.5, py: 0.5 }
              : isScattering ? { animation: `${animationColorBeamScatter} 5s infinite, ${animationEnterBelow} 0.6s` }
                : { fontWeight: 'lg' }
          }>
          {isGathering ? 'Merging...' : isScattering ? 'Beaming...' : 'Beam'}
        </Box>
        {(!isGathering && !isScattering) && ' Mode'}
      </Typography>

      <FadeInButton aria-label='Close' size='sm' onClick={closebeam}>
        <CloseRoundedIcon />
      </FadeInButton>

    </Box>
  );
}
