import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Box, Typography } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

import { BeamStoreApi, useBeamStore } from '~/common/beam/store-beam.hooks';
import { ConfirmationModal } from '~/common/components/ConfirmationModal';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { KeyStroke } from '~/common/components/KeyStroke';
import { ShortcutKeyName, useGlobalShortcut } from '~/common/components/useGlobalShortcut';

import { FadeInButton } from './ChatDrawerItem';
import { animationColorBeamGather, animationColorBeamScatter, animationEnterBelow } from '~/common/util/animUtils';


export function ChatBarAltBeam(props: {
  beamStore: BeamStoreApi,
}) {

  // state
  const [showCloseConfirmation, setShowCloseConfirmation] = React.useState(false);


  // external beam state
  const { closebeam, isScattering, isGathering, readyGather } = useBeamStore(props.beamStore, useShallow((store) => ({
    // state
    isScattering: store.isScattering,
    isGathering: store.isGathering,
    readyGather: store.readyGather, // Assuming this state exists and is a number
    // actions
    closebeam: store.close,
  })));


  // closure handlers

  const requiresConfirmation = isScattering || isGathering || readyGather > 0;
  const handleCloseBeam = React.useCallback(() => {
    if (requiresConfirmation)
      setShowCloseConfirmation(true);
    else
      closebeam();
  }, [requiresConfirmation, closebeam]);

  const handleCloseConfirmation = React.useCallback(() => {
    closebeam();
    setShowCloseConfirmation(false);
  }, [closebeam]);

  const handleCloseDenial = React.useCallback(() => {
    setShowCloseConfirmation(false);
  }, []);


  // intercept esc this beam is focused
  useGlobalShortcut(ShortcutKeyName.Esc, false, false, false, handleCloseBeam);


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

      <GoodTooltip usePlain title={<Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>Close Beam Mode <KeyStroke combo='Esc' /></Box>}>
        <FadeInButton aria-label='Close' size='sm' onClick={handleCloseBeam}>
          <CloseRoundedIcon />
        </FadeInButton>
      </GoodTooltip>

      {/* Confirmation Modal */}
      {showCloseConfirmation && (
        <ConfirmationModal
          open
          onClose={handleCloseDenial}
          onPositive={handleCloseConfirmation}
          lowStakes
          noTitleBar
          confirmationText='Are you sure you want to close Beam Mode? Unsaved text will be lost.'
          positiveActionText='Yes, close'
        />
      )}
    </Box>
  );
}
