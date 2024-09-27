import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import type { DMessageImageRefPart } from '~/common/stores/chat/chat.fragments';
import { GoodModal } from '~/common/components/modals/GoodModal';

import { BlockPartImageRef } from './BlockPartImageRef';


const imageViewerModalSx: SxProps = {
  maxWidth: '90vw',
};

const imageViewerContainerSx: SxProps = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  maxHeight: '80vh',
  overflow: 'auto',
};


export function ImageRefPartModal(props: { imageRefPart: DMessageImageRefPart, onClose: () => void }) {
  return (
    <GoodModal
      open
      onClose={props.onClose}
      title='Attachment Image Viewer'
      noTitleBar={false}
      sx={imageViewerModalSx}
    >
      <Box sx={imageViewerContainerSx}>
        <BlockPartImageRef imageRefPart={props.imageRefPart} contentScaling='sm' />
      </Box>
    </GoodModal>
  );
}