import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Modal, ModalClose } from '@mui/joy';

import { BeamStoreApi, useBeamStore } from '~/modules/beam/store-beam.hooks';
import { BeamView } from '~/modules/beam/BeamView';

import { ScrollToBottom } from '~/common/scroll-to-bottom/ScrollToBottom';


/*const overlaySx: SxProps = {
  position: 'absolute',
  inset: 0,
  zIndex: themeZIndexBeamView, // stay on top of Message > Chips (:1), and Overlays (:2) - note: Desktop Drawer (:26)
}*/


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
      <Box sx={{
        backgroundColor: 'background.level1',
        position: 'absolute',
        inset: 0,
      }}>
        <ScrollToBottom disableAutoStick>
          {beamView}
        </ScrollToBottom>
        <ModalClose sx={{ color: 'white', backgroundColor: 'background.surface', boxShadow: 'xs', mr: 2 }} />
      </Box>
    </Modal>
  ) : (
    <Box sx={props.inlineSx}>
      {beamView}
    </Box>
  );
}