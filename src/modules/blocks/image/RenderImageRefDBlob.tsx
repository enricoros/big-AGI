import * as React from 'react';
import TimeAgo from 'react-timeago';
import { useQuery } from '@tanstack/react-query';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import { t2iGenerateImageContentFragments } from '~/modules/t2i/t2i.client';

import { DBlobAssetId, DBlobImageAsset, useDBAsset } from '~/common/stores/blob/dblobs-portability';

import type { DMessageContentFragment } from '~/common/stores/chat/chat.fragments';
import { humanReadableBytes } from '~/common/util/textUtils';

import { RenderImageURL, RenderImageURLVariant } from './RenderImageURL';


export function RenderImageRefDBlob(props: {
  // from ImageRef
  dataRefDBlobAssetId: DBlobAssetId,
  dataRefMimeType: string,
  dataRefBytesSize?: number, // only used for the overlay text
  imageAltText?: string,
  imageWidth?: number,
  imageHeight?: number,
  // others
  variant: RenderImageURLVariant,
  disabled?: boolean,
  onClick?: (e: React.MouseEvent) => void,  // use this generic as a fallback, but should not be needed
  onDeleteFragment?: () => void,
  onReplaceFragment?: (newFragment: DMessageContentFragment) => void,
  onViewImage?: () => void
  scaledImageSx?: SxProps,
}) {

  // external state from the DB
  const [imageItem] = useDBAsset<DBlobImageAsset>(props.dataRefDBlobAssetId);


  // hook: async image regeneration

  const { label: imageItemLabel, origin: imageItemOrigin } = imageItem || {};
  // const _recreationWidth = imageItemMetadata?.width || props.imageWidth;
  // const _recreationHeight = imageItemMetadata?.height || props.imageHeight;
  const recreationPrompt = ((imageItemOrigin?.ot === 'generated') ? imageItemOrigin.prompt : undefined) || imageItemLabel || props.imageAltText;

  const { isFetching: isRegenerating, refetch: handleImageRegenerate } = useQuery({
    enabled: false,
    queryKey: ['regen-image-asset', props.dataRefDBlobAssetId, recreationPrompt],
    queryFn: async ({ signal }) => {
      if (signal?.aborted || !recreationPrompt || !props.onReplaceFragment) return;
      // NOTE: we shall prevent this operation from happening if the image was not fully generated from the prompt, but also had images
      // const recreationImages = [];
      const newImageFragments = await t2iGenerateImageContentFragments(null, recreationPrompt, [], 1, 'app-chat');
      if (newImageFragments.length === 1)
        props.onReplaceFragment?.(newImageFragments[0]);
    },
  });


  // memo the description and overlay text
  const { dataUrlMemo, altText, overlayText } = React.useMemo(() => {
    // if no image data, return null
    if (!imageItem?.data) {
      return {
        dataUrlMemo: null,
      };
    }

    // [attachment card] only return the data
    if (props.variant === 'attachment-card' || props.variant === 'attachment-button') {
      return {
        dataUrlMemo: `data:${imageItem.data.mimeType};base64,${imageItem.data.base64}`,
      };
    }

    let overlayText: React.ReactNode = null;
    const extension = (imageItem.data.mimeType || props.dataRefMimeType || '').replace('image/', '');
    const overlayDate = imageItem.updatedAt || imageItem.createdAt || undefined;
    const formattedSize = !props.dataRefBytesSize ? undefined : humanReadableBytes(props.dataRefBytesSize);

    switch (imageItem.origin.ot) {
      case 'user':
        overlayText = <Box sx={{ fontSize: '0.875em' }}>
          {/*&quot; {imageItem.label.length > 120 ? imageItem.label.slice(0, 120 - 3) + '...' : imageItem.label} &quot;*/}
          <Box sx={{ opacity: 0.8 }}>
            {imageItem.origin.source} · {imageItem.metadata?.width || props.imageWidth}x{imageItem.metadata?.height || props.imageHeight} · {extension}{formattedSize ? ' · ' + formattedSize : ''}
          </Box>
          <Box sx={{ opacity: 0.8 }}>
            {imageItem.origin.media}{imageItem.origin.fileName ? ' · ' + imageItem.origin.fileName : ''}
          </Box>
          {!!overlayDate && <Box sx={{ opacity: 0.5 }}>
            <TimeAgo date={overlayDate} />
          </Box>}
        </Box>;
        break;

      case 'generated':
        overlayText = <Box sx={{ fontSize: '0.875em' }}>
          &quot; {imageItem.label.length > 120 ? imageItem.label.slice(0, 120 - 3) + '...' : imageItem.label} &quot;
          <Box sx={{ opacity: 0.8 }}>
            AI Image · {imageItem.metadata?.width || props.imageWidth}x{imageItem.metadata?.height || props.imageHeight} · {extension}{formattedSize ? ' · ' + formattedSize : ''}
          </Box>
          <Box sx={{ opacity: 0.8 }}>
            {Object.entries(imageItem.origin.parameters).reduce((acc, [key, value]) => {
              acc.push(`${key}: ${value}`);
              return acc;
            }, [] as string[]).join(', ')}
          </Box>
          {!!overlayDate && <Box sx={{ opacity: 0.5 }}>
            <TimeAgo date={overlayDate} />
          </Box>}
        </Box>;
        break;
    }

    return {
      dataUrlMemo: `data:${imageItem.data.mimeType};base64,${imageItem.data.base64}`,
      altText: props.imageAltText || imageItem.metadata?.description || imageItem.label || '',
      overlayText: overlayText,
    };
  }, [imageItem, props.dataRefMimeType, props.dataRefBytesSize, props.imageAltText, props.imageHeight, props.imageWidth, props.variant]);

  return (
    <RenderImageURL
      imageURL={dataUrlMemo}
      expandableText={altText}
      overlayText={overlayText}
      onClick={props.onClick}
      onImageDelete={props.onDeleteFragment}
      onImageRegenerate={(!!recreationPrompt && !isRegenerating && !!props.onReplaceFragment) ? handleImageRegenerate : undefined}
      onViewImage={props.onViewImage}
      className={isRegenerating ? 'agi-border-4' /* CSS Effect while regenerating */ : undefined}
      scaledImageSx={props.scaledImageSx}
      disabled={props.disabled}
      variant={props.variant}
    />
  );
}
