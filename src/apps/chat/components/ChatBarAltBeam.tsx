import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Box, IconButton, Typography } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded';

import { BeamStoreApi, useBeamStore } from '~/modules/beam/store-beam.hooks';

import { ConfirmationModal } from '~/common/components/ConfirmationModal';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { KeyStroke } from '~/common/components/KeyStroke';
import { ShortcutKeyName, useGlobalShortcuts } from '~/common/components/useGlobalShortcuts';
import { animationBackgroundBeamGather, animationColorBeamScatterINV, animationEnterBelow } from '~/common/util/animUtils';


export function ChatBarAltBeam(props: {
  beamStore: BeamStoreApi,
  isMobile?: boolean
}) {

  // state
  const [showCloseConfirmation, setShowCloseConfirmation] = React.useState(false);


  // external beam state
  const { isScattering, isGatheringAny, requiresConfirmation, setIsMaximized, terminateBeam } = useBeamStore(props.beamStore, useShallow((store) => ({
    // state
    isScattering: store.isScattering,
    isGatheringAny: store.isGatheringAny,
    requiresConfirmation: store.isScattering || store.isGatheringAny || store.raysReady > 0,
    // actions
    setIsMaximized: store.setIsMaximized,
    terminateBeam: store.terminateKeepingSettings,
  })));


  // closure handlers

  const handleCloseBeam = React.useCallback(() => {
    if (requiresConfirmation)
      setShowCloseConfirmation(true);
    else
      terminateBeam();
  }, [requiresConfirmation, terminateBeam]);

  const handleCloseConfirmation = React.useCallback(() => {
    terminateBeam();
    setShowCloseConfirmation(false);
  }, [terminateBeam]);

  const handleCloseDenial = React.useCallback(() => {
    setShowCloseConfirmation(false);
  }, []);

  const handleMaximizeBeam = React.useCallback(() => {
    setIsMaximized(true);
  }, [setIsMaximized]);


  // intercept esc this beam is focused
  useGlobalShortcuts([[ShortcutKeyName.Esc, false, false, false, handleCloseBeam]]);


  return (
    <Box sx={{ display: 'flex', gap: { xs: 1, md: 2 }, alignItems: 'center' }}>

      {/* Title & Status */}
      <Typography level='title-md'>
        <Box
          component='span'
          sx={
            isGatheringAny ? { animation: `${animationBackgroundBeamGather} 3s infinite, ${animationEnterBelow} 0.6s`, px: 1.5, py: 0.5 }
              : isScattering ? { animation: `${animationColorBeamScatterINV} 5s infinite, ${animationEnterBelow} 0.6s` }
                : { fontWeight: 'lg' }
          }>
          {isGatheringAny ? 'Merging...' : isScattering ? 'Beaming...' : 'Beam'}
        </Box>
        {(!isGatheringAny && !isScattering) && ' Mode'}
      </Typography>

      {/* Right Close Icon */}
      <Box sx={{ display: 'flex' }}>

        {/* [desktop] maximize button, or a disabled spacer  */}
        {!props.isMobile && (
          <GoodTooltip usePlain title={<Box sx={{ p: 1 }}>Maximize</Box>}>
            <IconButton size='sm' onClick={handleMaximizeBeam}>
              <FullscreenRoundedIcon />
            </IconButton>
          </GoodTooltip>
        )}

        <GoodTooltip usePlain title={<Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>Back to Chat <KeyStroke combo='Esc' /></Box>}>
          <IconButton aria-label='Close' size='sm' onClick={handleCloseBeam}>
            <CloseRoundedIcon />
          </IconButton>
        </GoodTooltip>

      </Box>


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
