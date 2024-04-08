import * as React from 'react';

import { Box, Modal, ModalClose } from '@mui/joy';

import { BeamStoreApi, useBeamStore } from '~/modules/beam/store-beam.hooks';
import { BeamView } from '~/modules/beam/BeamView';

import { themeZIndexBeamView } from '~/common/app.theme';


export function ChatBeamWrapper(props: {
  beamStore: BeamStoreApi,
  isMobile: boolean,
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
        {beamView}
        <ModalClose sx={{ color: 'white', backgroundColor: 'background.surface', boxShadow: 'xs', mr: 2 }} />
      </Box>
    </Modal>
  ) : (
    <Box sx={{
      position: 'absolute',
      inset: 0,
      zIndex: themeZIndexBeamView, // stay on top of Message > Chips (:1), and Overlays (:2) - note: Desktop Drawer (:26)
    }}>
      {beamView}
    </Box>
  );
}