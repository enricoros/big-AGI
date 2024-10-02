import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import type { DMessageImageRefPart } from '~/common/stores/chat/chat.fragments';
import { GoodModal } from '~/common/components/modals/GoodModal';

import { BlockPartImageRef } from './BlockPartImageRef';


const imageViewerModalSx: SxProps = {
  maxWidth: '90vw',
  backgroundColor: 'background.level2',
};

const imageViewerContainerSx: SxProps = {
  // display: 'flex',
  // alignItems: 'center',
  // justifyContent: 'center',
  maxHeight: '80vh',
  overflow: 'auto',

  // pre-compensate the Block > Render Items 1.5 margin
  m: -1.5,
  '& > div': {
    pt: 1.5,
  },
};


export function ViewImageRefPartModal(props: { imageRefPart: DMessageImageRefPart, onClose: () => void }) {
  const title = props.imageRefPart.altText || 'Attachment Image';
  return (
    <GoodModal
      open={true}
      onClose={props.onClose}
      title={title}
      noTitleBar={false}
      sx={imageViewerModalSx}
    >
      <Box sx={imageViewerContainerSx}>
        <BlockPartImageRef imageRefPart={props.imageRefPart} contentScaling='sm' />
      </Box>
    </GoodModal>
  );
}