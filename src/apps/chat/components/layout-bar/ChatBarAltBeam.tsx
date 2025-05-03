import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Box, IconButton, Typography } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

import { BeamStoreApi, useBeamStore } from '~/modules/beam/store-beam.hooks';

import { AppBreadcrumbs } from '~/common/components/AppBreadcrumbs';
import { ConfirmationModal } from '~/common/components/modals/ConfirmationModal';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { KeyStroke } from '~/common/components/KeyStroke';
import { Release } from '~/common/app.release';
import { ShortcutKey, useGlobalShortcuts } from '~/common/components/shortcuts/useGlobalShortcuts';
import { animationBackgroundBeamGather, animationColorBeamScatterINV, animationEnterBelow } from '~/common/util/animUtils';


const _styles = {

  bar: {
    // layout
    display: 'flex',
    alignItems: 'center',
    gap: { xs: 1, md: 2 } as const,

    minWidth: 0, // ensures the breadcrumbs don't overflow
    // Customize breadcrumbs to enable collapse of the first one (chat title)
    '& nav': {
      overflow: 'hidden',
    },
    '& nav > ol': {
      flexWrap: 'nowrap',
    } as const,
    '& nav > ol > li:first-of-type': {
      overflow: 'hidden',
      maxWidth: { xs: '110px', md: '140px' },
    } as const,

  } as const,

  barScatter: {
    animation: `${animationColorBeamScatterINV} 5s infinite, ${animationEnterBelow} 0.6s`,
  } as const,

  barGather: {
    animation: `${animationBackgroundBeamGather} 3s infinite, ${animationEnterBelow} 0.6s`,
    px: 1.5, py: 0.5,
  } as const,

} as const;


export function ChatBarAltBeam(props: {
  beamStore: BeamStoreApi,
  conversationTitle: string,
  isMobile: boolean,
}) {

  // state
  const [showCloseConfirmation, setShowCloseConfirmation] = React.useState(false);


  // external beam state
  const { isEditMode, isScattering, isGatheringAny, requiresConfirmation, setIsMaximized, terminateBeam } = useBeamStore(props.beamStore, useShallow((store) => ({
    // state
    isEditMode: store.isEditMode,
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
  useGlobalShortcuts('ChatBarAltBeam', React.useMemo(() => [
    { key: ShortcutKey.Esc, action: handleCloseBeam, level: 10 /* because Modal-ish */ },
  ], [handleCloseBeam]));


  return (
    <Box sx={_styles.bar}>

      {/* [desktop] maximize button, or a disabled spacer  */}
      {!props.isMobile && (
        <GoodTooltip variantOutlined title={<Box sx={{ p: 1 }}>Maximize Beam</Box>}>
          <IconButton size='sm' onClick={handleMaximizeBeam}>
            {/*<OpenInFullIcon sx={{ fontSize: 'md' }} />*/}
          </IconButton>
        </GoodTooltip>
      )}

      <AppBreadcrumbs rootTitle={
        props.conversationTitle?.length > 3
          ? <Box className='agi-ellipsize'>{props.conversationTitle || 'Chat'}</Box>
          : undefined
      }>

        {/* Title & Status */}
        <Typography level='title-md' noWrap>
          <Box
            component='span'
            sx={Release.Features.LIGHTER_ANIMATIONS ? undefined
              : isGatheringAny ? _styles.barGather
                : isScattering ? _styles.barScatter
                  : undefined}
          >
            {isGatheringAny ? 'Merging...' : isScattering ? 'Beaming...' : isEditMode ? 'Beam Edit' : 'Beam'}
          </Box>
          {(!isGatheringAny && !isScattering && !isEditMode) && ' Mode'}
        </Typography>

      </AppBreadcrumbs>

      {/* Right Close Icon */}
      <GoodTooltip variantOutlined title={<Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>Back to Chat <KeyStroke variant='outlined' combo='Esc' /></Box>}>
        <IconButton aria-label='Close' size='sm' onClick={handleCloseBeam}>
          <CloseRoundedIcon />
        </IconButton>
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
