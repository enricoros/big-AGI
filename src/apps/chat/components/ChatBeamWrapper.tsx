import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, IconButton, Modal } from '@mui/joy';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';

import { BeamStoreApi, useBeamStore } from '~/modules/beam/store-beam.hooks';
import { BeamView } from '~/modules/beam/BeamView';

import { GoodTooltip } from '~/common/components/GoodTooltip';
import { ScrollToBottom } from '~/common/scroll-to-bottom/ScrollToBottom';
import { themeZIndexBeamView } from '~/common/app.theme';


const beamWrapperStyles = {

  wrapper: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'background.level2', // darker than the expected Level1, for a change
  } as const,

  closeContainer: {
    position: 'absolute',
    top: '0.25rem',
    // left: '0.25rem',
    left: { xs: 'calc(50% - 3rem)', md: '50%' }, // center on desktop, a bit left (for the islands) on mobile
    // transform: 'translate(-50%, 0)',
    zIndex: themeZIndexBeamView, // stay on top of Message > Chips (:1), and Overlays (:2) - note: Desktop Drawer (:26)
  } as const,

  closeButton: {
    // color: 'white',
    // borderRadius: '25%',
    boxShadow: 'md',
  } as const,

} as const;


export function ChatBeamWrapper(props: {
  beamStore: BeamStoreApi,
  isMobile: boolean,
  inlineSx?: SxProps,
}) {

  // state
  const isMaximized = useBeamStore(props.beamStore, state => state.isMaximized);

  const handleUnMaximize = React.useCallback(() => {
    props.beamStore.getState().setIsMaximized(false);
  }, [props.beamStore]);

  // memo the beamview
  const beamView = React.useMemo(() => (
    <BeamView
      beamStore={props.beamStore}
      isMobile={props.isMobile}
      showExplainer
    />
  ), [props.beamStore, props.isMobile]);

  return isMaximized ? (
    <Modal open onClose={handleUnMaximize}>
      <Box sx={beamWrapperStyles.wrapper}>

        <ScrollToBottom disableAutoStick>
          {beamView}
        </ScrollToBottom>

        {/* Modal-Close-alike */}
        <Box sx={beamWrapperStyles.closeContainer}>
          <GoodTooltip title='Exit maximized mode'>
            <IconButton variant='solid' onClick={handleUnMaximize} sx={beamWrapperStyles.closeButton}>
              <CloseFullscreenIcon />
              {/*<CloseRoundedIcon />*/}
            </IconButton>
          </GoodTooltip>
        </Box>

      </Box>
    </Modal>
  ) : (
    <Box sx={props.inlineSx}>
      {beamView}
    </Box>
  );
}