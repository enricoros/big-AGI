import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button } from '@mui/joy';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';

import { RenderImageRefDBlob } from '~/modules/blocks/image/RenderImageRefDBlob';
import { RenderImageURL } from '~/modules/blocks/image/RenderImageURL';

import { getImageAsset } from '~/common/stores/blob/dblobs-portability';

import type { DMessageContentFragment, DMessageImageRefPart } from '~/common/stores/chat/chat.fragments';
import { AppBreadcrumbs } from '~/common/components/AppBreadcrumbs';
import { GoodModal } from '~/common/components/modals/GoodModal';
import { convert_Base64WithMimeType_To_Blob } from '~/common/util/blobUtils';
import { downloadBlob } from '~/common/util/downloadUtils';
import { useIsMobile } from '~/common/components/useMatchMedia';


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

  // pre-compensate the RenderImageRefDBlob > Sheet's 1.5 (BlocksContainer-alike) margin
  mx: -1.5,
  // add some margin to unclip the Sheet's shadow
  '& > div': {
    mb: 0.5,
  },
};


export function ViewImageRefPartModal(props: {
  imageRefPart: DMessageImageRefPart,
  onClose: () => void,
  onDeleteFragment?: () => void,
  onReplaceFragment?: (newFragment: DMessageContentFragment) => void,
}) {

  // state
  const [downloading, setDownloading] = React.useState(false);
  // const [copying, setCopying] = React.useState(false);

  // external state
  const isMobile = useIsMobile();

  // derived state
  const { dataRef, altText, width, height } = props.imageRefPart;
  const isDBlob = dataRef.reftype === 'dblob';

  // handlers

  // const handleCopy = React.useCallback(async () => {
  //   if (dataRef.reftype !== 'dblob') return;
  //
  //   setCopying(true);
  //   try {
  //     const imageAsset = await getImageAsset(dataRef.dblobAssetId);
  //     if (!imageAsset) return;
  //
  //     const blob = convert_Base64WithMimeType_To_Blob(imageAsset.data.base64, imageAsset.data.mimeType, 'ViewImageRefPartModal');
  //
  //     copyBlobPromiseToClipboard(imageAsset.data.mimeType, blob, 'Image');
  //   } catch (error) {
  //     console.error('Failed to copy image:', error);
  //   } finally {
  //     setCopying(false);
  //   }
  // }, [dataRef]);

  const handleDownload = React.useCallback(async () => {
    if (dataRef.reftype !== 'dblob') return;

    setDownloading(true);
    try {
      const imageAsset = await getImageAsset(dataRef.dblobAssetId);
      if (!imageAsset) return;

      const blob = await convert_Base64WithMimeType_To_Blob(imageAsset.data.base64, imageAsset.data.mimeType, 'ViewImageRefPartModal');

      const extension = imageAsset.data.mimeType.split('/')[1] || 'png';
      const filename = `${altText || 'image'}.${extension}`.replace(/[^a-z0-9.\-_]/gi, '_');

      downloadBlob(blob, filename);
    } catch (error) {
      console.error('Failed to download image:', error);
    } finally {
      setDownloading(false);
    }
  }, [dataRef, altText]);

  const title = altText || 'Attachment Image';
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
      fullscreen={isMobile ? undefined : 'button'}
      startButton={isDBlob ? (
        <Box sx={{ display: 'flex', gap: 1 }}>
          {/*<Button*/}
          {/*  variant='soft'*/}
          {/*  color='neutral'*/}
          {/*  loading={copying}*/}
          {/*  loadingPosition='start'*/}
          {/*  startDecorator={<ContentCopyIcon sx={{ fontSize: 'lg' }} />}*/}
          {/*  onClick={handleCopy}*/}
          {/*>*/}
          {/*  Copy*/}
          {/*</Button>*/}
          <Button
            variant='soft'
            color='neutral'
            loading={downloading}
            loadingPosition='start'
            startDecorator={<FileDownloadOutlinedIcon />}
            onClick={handleDownload}
          >
            Download
          </Button>
        </Box>
      ) : undefined}
      sx={imageViewerModalSx}
    >
      <Box sx={imageViewerContainerSx}>
        {dataRef.reftype === 'dblob' ? (
          <RenderImageRefDBlob
            dataRefDBlobAssetId={dataRef.dblobAssetId}
            dataRefMimeType={dataRef.mimeType}
            dataRefBytesSize={dataRef.bytesSize}
            imageAltText={altText}
            imageWidth={width}
            imageHeight={height}
            onDeleteFragment={props.onDeleteFragment}
            onReplaceFragment={props.onReplaceFragment}
            // onViewImage={} we're already viewing the image in the dialog
            // scaledImageSx={} we reset scale in this dialog
            variant='content-part'
          />
        ) : dataRef.reftype === 'url' ? (
          <RenderImageURL
            imageURL={dataRef.url}
            expandableText={altText}
            variant='content-part'
          />
        ) : 'ViewImageRefPartModal: unknown reftype'}
      </Box>
    </GoodModal>
  );
}