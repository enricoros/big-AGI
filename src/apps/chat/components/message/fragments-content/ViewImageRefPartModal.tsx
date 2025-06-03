import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button } from '@mui/joy';
import FileDownloadIcon from '@mui/icons-material/FileDownload';

import { getImageAsset } from '~/modules/dblobs/dblobs.images';

import type { DMessageImageRefPart } from '~/common/stores/chat/chat.fragments';
import { GoodModal } from '~/common/components/modals/GoodModal';
import { convert_Base64WithMimeType_To_Blob } from '~/common/util/blobUtils';
import { downloadBlob, downloadToFile } from '~/common/util/downloadUtils';

import { BlockPartImageRef } from './BlockPartImageRef';
import { AppBreadcrumbs } from '~/common/components/AppBreadcrumbs';


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


export function ViewImageRefPartModal(props: {
  imageRefPart: DMessageImageRefPart,
  onClose: () => void,
}) {

  // state
  const [downloading, setDownloading] = React.useState(false);

  // handlers

  const handleDownload = React.useCallback(async () => {
    const { dataRef, altText } = props.imageRefPart;

    setDownloading(true);
    try {
      if (dataRef.reftype === 'dblob') {
        // Get the image asset from the DB
        const imageAsset = await getImageAsset(dataRef.dblobAssetId);
        if (imageAsset) {
          // Convert base64 -> Blob
          const blob = await convert_Base64WithMimeType_To_Blob(imageAsset.data.base64, imageAsset.data.mimeType, 'ViewImageRefPartModal.download');

          // Suggest filename with extension
          const extension = imageAsset.data.mimeType.split('/')[1] || 'png';
          const filename = `${altText || 'image'}.${extension}`.replace(/[^a-z0-9.\-_]/gi, '_');

          // Download the blob
          downloadBlob(blob, filename);
        }
      } else if (dataRef.reftype === 'url') {
        // For URL images, use direct download
        const filename = `${altText || 'image'}.png`.replace(/[^a-z0-9.\-_]/gi, '_');
        downloadToFile(dataRef.url, filename);
      }
    } catch (error) {
      console.error('Failed to download image:', error);
    } finally {
      setDownloading(false);
    }
  }, [props.imageRefPart]);

  const title = props.imageRefPart.altText || 'Attachment Image';
  return (
    <GoodModal
      open={true}
      onClose={props.onClose}
      title={
        <AppBreadcrumbs size='md' rootTitle='View'>
          <AppBreadcrumbs.Leaf><b>{title}</b></AppBreadcrumbs.Leaf>
        </AppBreadcrumbs>
      }
      // themedColor='neutral'
      unfilterBackdrop
      startButton={
        <Button
          variant='soft'
          color='neutral'
          loading={downloading}
          loadingPosition='start'
          startDecorator={<FileDownloadIcon />}
          onClick={handleDownload}
        >
          Download
        </Button>
      }
      sx={imageViewerModalSx}
    >
      <Box sx={imageViewerContainerSx}>
        <BlockPartImageRef
          disableViewer={true /* we're in the Modal, we won't pop this up anymore */}
          imageRefPart={props.imageRefPart}
          contentScaling='sm'
        />
      </Box>
    </GoodModal>
  );
}