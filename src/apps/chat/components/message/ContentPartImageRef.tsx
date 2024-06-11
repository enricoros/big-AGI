import * as React from 'react';
import TimeAgo from 'react-timeago';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import type { DBlobId, DBlobImageItem } from '~/modules/dblobs/dblobs.types';
import { RenderImageURL } from '~/modules/blocks/RenderImageURL';
import { blocksRendererSx } from '~/modules/blocks/BlocksRenderer';
import { useDBlobItem } from '~/modules/dblobs/dblobs.hooks';

import type { DMessageImagePart } from '~/common/stores/chat/chat.message';
import { ContentScaling, themeScalingMap } from '~/common/app.theme';
import { handleShowDataRefInNewTab } from '~/common/stores/chat/chat.dblobs';


function ContentPartImageDBlob(props: {
  dataRefDBlobId: DBlobId,
  dataRefMimeType: string,
  imageAltText?: string,
  imageWidth?: number,
  imageHeight?: number,
  onOpenInNewTab: () => void
  scaledImageSx?: SxProps,
}) {

  // external state from the DB
  const [imageItem] = useDBlobItem<DBlobImageItem>(props.dataRefDBlobId);

  // memo the description and overlay text
  const { dataUrl, altText, overlayText } = React.useMemo(() => {
    if (!imageItem?.data)
      return { dataUrl: null, altText: '', overlayText: null };

    let overlayText: React.ReactNode = null;
    const extension = (imageItem.data.mimeType || props.dataRefMimeType || '').replace('image/', '');
    const overlayDate = imageItem.updatedAt || imageItem.createdAt || undefined;

    switch (imageItem.origin.ot) {
      case 'user':
        overlayText = <>
          User Image · {imageItem.metadata?.width || props.imageWidth}x{imageItem.metadata?.height || props.imageHeight}
          <Box sx={{ opacity: 0.5, fontSize: 'sm' }}>
            {imageItem.label}
          </Box>
        </>;
        break;

      case 'generated':
        overlayText = <Box sx={{ fontSize: '0.875em' }}>
          &quot; {imageItem.label.length > 120 ? imageItem.label.slice(0, 120 - 3) + '...' : imageItem.label} &quot;
          <Box sx={{ opacity: 0.8 }}>
            AI Image · {imageItem.metadata?.width || props.imageWidth}x{imageItem.metadata?.height || props.imageHeight} · {extension}
          </Box>
          <Box sx={{ opacity: 0.8 }}>
            {Object.entries(imageItem.origin.parameters).reduce((acc, [key, value]) => {
              acc.push(`${key}: ${value}`);
              return acc;
            }, [] as string[]).join(', ')}
          </Box>
          <Box sx={{ opacity: 0.5 }}>
            <TimeAgo date={overlayDate} />
          </Box>
        </Box>;
        break;
    }

    return {
      dataUrl: `data:${imageItem.data.mimeType};base64,${imageItem.data.base64}`,
      altText: props.imageAltText || imageItem.metadata?.description || imageItem.label || '',
      overlayText: overlayText,
    };
  }, [imageItem, props.dataRefMimeType, props.imageAltText, props.imageHeight, props.imageWidth]);

  return (
    <RenderImageURL
      imageURL={dataUrl}
      infoText={altText}
      description={overlayText}
      onOpenInNewTab={props.onOpenInNewTab}
      scaledImageSx={props.scaledImageSx}
    />
  );
}


export function ContentPartImageRef(props: {
  imageRefPart: DMessageImagePart,
  contentScaling: ContentScaling,
}) {

  // derived state
  const imagePart = props.imageRefPart;
  const { dataRef } = imagePart;

  // event handlers
  const handleOpenInNewTab = React.useCallback(() => handleShowDataRefInNewTab(dataRef), [dataRef]);

  // memo the scaled image style
  const scaledImageSx = React.useMemo((): SxProps => (
    {
      // overflowX: 'auto', // <- this would make the right side margin scrollable
      fontSize: themeScalingMap[props.contentScaling]?.blockFontSize ?? undefined,
      lineHeight: themeScalingMap[props.contentScaling]?.blockLineHeight ?? 1.75,
      marginBottom: themeScalingMap[props.contentScaling]?.blockImageGap ?? 1.5,
    }
  ), [props.contentScaling]);

  return (
    <Box sx={blocksRendererSx}>
      {dataRef.reftype === 'dblob' ? (
        <ContentPartImageDBlob
          dataRefDBlobId={dataRef.dblobId}
          dataRefMimeType={dataRef.mimeType}
          imageAltText={imagePart.altText}
          imageWidth={imagePart.width}
          imageHeight={imagePart.height}
          onOpenInNewTab={handleOpenInNewTab}
          scaledImageSx={scaledImageSx}
        />
      ) : dataRef.reftype === 'url' ? (
        <RenderImageURL
          imageURL={dataRef.url}
          infoText={imagePart.altText}
          scaledImageSx={scaledImageSx}
        />
      ) : (
        <Box>ContentPartImageRef: unknown reftype</Box>
      )}
    </Box>
  );
}
