import * as React from 'react';
import TimeAgo from 'react-timeago';
import { useQuery } from '@tanstack/react-query';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import type { DBlobAssetId, DBlobImageAsset } from '~/modules/dblobs/dblobs.types';
import { getImageAssetAsBlobURL } from '~/modules/dblobs/dblobs.images';
import { t2iGenerateImageContentFragments } from '~/modules/t2i/t2i.client';
import { useDBAsset } from '~/modules/dblobs/dblobs.hooks';

import type { DMessageContentFragment, DMessageDataRef } from '~/common/stores/chat/chat.fragments';
import { addSnackbar } from '~/common/components/snackbar/useSnackbarsStore';
import { showBlobURLInNewTab } from '~/common/util/imageUtils';

import { RenderImageURL, RenderImageURLVariant } from './RenderImageURL';


/**
 * Opens am image data ref in a new tab (fetches and shows it)
 */
export async function showImageDataRefInNewTab(dataRef: DMessageDataRef) {
  let imageBlobURL: string | null = null;
  if (dataRef.reftype === 'url')
    imageBlobURL = dataRef.url;
  else if (dataRef.reftype === 'dblob')
    imageBlobURL = await getImageAssetAsBlobURL(dataRef.dblobAssetId);

  // the upstream hsould not let this happen
  if (!imageBlobURL)
    return false;

  // notify the user that the image has been opened in a new tab (for Safari when it's blocking by default)
  addSnackbar({ key: 'opened-image-in-new-tab', message: 'Image opened in a New Tab.', type: 'success', closeButton: false, overrides: { autoHideDuration: 1600 } });
  return showBlobURLInNewTab(imageBlobURL);
}


export function RenderImageRefDBlob(props: {
  // from ImageRef
  dataRefDBlobAssetId: DBlobAssetId,
  dataRefMimeType: string,
  imageAltText?: string,
  imageWidth?: number,
  imageHeight?: number,
  // others
  variant: RenderImageURLVariant,
  disabled?: boolean,
  onClick?: (e: React.MouseEvent) => void,  // use this generic as a fallback, but should not be needed
  onOpenInNewTab?: () => void
  onDeleteFragment?: () => void,
  onReplaceFragment?: (newFragment: DMessageContentFragment) => void,
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
    if (props.variant === 'attachment-card' || props.variant === 'attachment-button') {
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
  }, [imageItem, props.dataRefMimeType, props.imageAltText, props.imageHeight, props.imageWidth, props.variant]);

  return (
    <RenderImageURL
      imageURL={dataUrlMemo}
      expandableText={altText}
      overlayText={overlayText}
      onClick={props.onClick}
      onOpenInNewTab={props.onOpenInNewTab}
      onImageDelete={props.onDeleteFragment}
      onImageRegenerate={(!!recreationPrompt && !isRegenerating && !!props.onReplaceFragment) ? handleImageRegenerate : undefined}
      className={isRegenerating ? 'agi-border-4' /* CSS Effect while regenerating */ : undefined}
      scaledImageSx={props.scaledImageSx}
      disabled={props.disabled}
      variant={props.variant}
    />
  );
}
