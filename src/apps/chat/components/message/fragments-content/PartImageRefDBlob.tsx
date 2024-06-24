import * as React from 'react';
import TimeAgo from 'react-timeago';
import { useQuery } from '@tanstack/react-query';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import type { DBlobAssetId, DBlobImageAsset } from '~/modules/dblobs/dblobs.types';
import { RenderImageURL } from '~/modules/blocks/image/RenderImageURL';
import { getImageAssetAsBlobURL } from '~/modules/dblobs/dblobs.images';
import { t2iGenerateImageContentFragments } from '~/modules/t2i/t2i.client';
import { useDBAsset } from '~/modules/dblobs/dblobs.hooks';

import type { DMessageContentFragment, DMessageDataRef } from '~/common/stores/chat/chat.fragments';


/**
 * Opens am image data ref in a new tab (fetches and shows it)
 */
export async function showImageDataRefInNewTab(dataRef: DMessageDataRef) {
  let imageUrl: string | null = null;
  if (dataRef.reftype === 'url')
    imageUrl = dataRef.url;
  else if (dataRef.reftype === 'dblob')
    imageUrl = await getImageAssetAsBlobURL(dataRef.dblobAssetId);
  if (imageUrl && typeof window !== 'undefined') {
    window.open(imageUrl, '_blank', 'noopener,noreferrer');
    return true;
  }
  return false;
}


export function PartImageRefDBlob(props: {
  dataRefDBlobAssetId: DBlobAssetId,
  dataRefMimeType: string,
  imageAltText?: string,
  imageWidth?: number,
  imageHeight?: number,
  onOpenInNewTab: () => void
  onDeleteFragment?: () => void,
  onReplaceFragment?: (newFragment: DMessageContentFragment) => void,
  scaledImageSx?: SxProps,
  partVariant: 'content-part' | 'attachment-card',
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
      const newImageFragments = await t2iGenerateImageContentFragments(null, recreationPrompt, 1, 'global', 'app-chat');
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
    if (props.partVariant === 'attachment-card') {
      return {
        dataUrlMemo: `data:${imageItem.data.mimeType};base64,${imageItem.data.base64}`,
      };
    }

    let overlayText: React.ReactNode = null;
    const extension = (imageItem.data.mimeType || props.dataRefMimeType || '').replace('image/', '');
    const overlayDate = imageItem.updatedAt || imageItem.createdAt || undefined;

    switch (imageItem.origin.ot) {
      case 'user':
        overlayText = <Box sx={{ fontSize: '0.875em' }}>
          {/*&quot; {imageItem.label.length > 120 ? imageItem.label.slice(0, 120 - 3) + '...' : imageItem.label} &quot;*/}
          <Box sx={{ opacity: 0.8 }}>
            {imageItem.origin.source} · {imageItem.metadata?.width || props.imageWidth}x{imageItem.metadata?.height || props.imageHeight} · {extension}
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
            AI Image · {imageItem.metadata?.width || props.imageWidth}x{imageItem.metadata?.height || props.imageHeight} · {extension}
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
  }, [imageItem, props.dataRefMimeType, props.imageAltText, props.imageHeight, props.imageWidth, props.partVariant]);

  return (
    <RenderImageURL
      imageURL={dataUrlMemo}
      infoText={altText}
      description={overlayText}
      onOpenInNewTab={props.onOpenInNewTab}
      onImageDelete={props.onDeleteFragment}
      onImageRegenerate={(!!recreationPrompt && !isRegenerating && !!props.onReplaceFragment) ? handleImageRegenerate : undefined}
      className={isRegenerating ? 'agi-border-4' : undefined}
      scaledImageSx={props.scaledImageSx}
      variant={props.partVariant}
    />
  );
}
