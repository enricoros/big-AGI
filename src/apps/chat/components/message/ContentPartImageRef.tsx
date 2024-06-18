import * as React from 'react';
import TimeAgo from 'react-timeago';
import { useQuery } from '@tanstack/react-query';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import type { DBlobAssetId, DBlobImageAsset } from '~/modules/dblobs/dblobs.types';
import { RenderImageURL } from '~/modules/blocks/RenderImageURL';
import { blocksRendererSx } from '~/modules/blocks/BlocksRenderer';
import { getImageAssetAsBlobURL } from '~/modules/dblobs/dblobs.images';
import { t2iGenerateImageContentFragments } from '~/modules/t2i/t2i.client';
import { useDBAsset } from '~/modules/dblobs/dblobs.hooks';

import type { DMessageContentFragment, DMessageDataRef, DMessageFragmentId, DMessageImageRefPart } from '~/common/stores/chat/chat.message';
import { ContentScaling, themeScalingMap } from '~/common/app.theme';


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


function ContentPartImageRefDBlob(props: {
  dataRefDBlobAssetId: DBlobAssetId,
  dataRefMimeType: string,
  imageAltText?: string,
  imageWidth?: number,
  imageHeight?: number,
  onOpenInNewTab: () => void
  onDeleteFragment?: () => void,
  onReplaceFragment?: (newFragment: DMessageContentFragment) => void,
  scaledImageSx?: SxProps,
}) {

  // external state from the DB
  const [imageItem] = useDBAsset<DBlobImageAsset>(props.dataRefDBlobAssetId);

  // handlers
  const { label: imageItemLabel, origin: imageItemOrigin, metadata: imageItemMetadata } = imageItem || {};
  const recreationPrompt = ((imageItemOrigin?.ot === 'generated') ? imageItemOrigin.prompt : undefined) || imageItemLabel || props.imageAltText;
  const _recreationWidth = imageItemMetadata?.width || props.imageWidth;
  const _recreationHeight = imageItemMetadata?.height || props.imageHeight;

  // async image regeneration
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
      onImageDelete={props.onDeleteFragment}
      onImageRegenerate={(!!recreationPrompt && !isRegenerating && !!props.onReplaceFragment) ? handleImageRegenerate : undefined}
      className={isRegenerating ? 'agi-border-4' : undefined}
      scaledImageSx={props.scaledImageSx}
    />
  );
}


function ContentPartImageRefURL(props: { dataRefUrl: string, imageAltText?: string, scaledImageSx?: SxProps, }) {
  return (
    <RenderImageURL
      imageURL={props.dataRefUrl}
      infoText={props.imageAltText}
      scaledImageSx={props.scaledImageSx}
    />
  );
}


export function ContentPartImageRef(props: {
  imageRefPart: DMessageImageRefPart,
  fragmentId: DMessageFragmentId,
  contentScaling: ContentScaling,
  onFragmentDelete?: (fragmentId: DMessageFragmentId) => void,
  onFragmentReplace?: (fragmentId: DMessageFragmentId, newFragment: DMessageContentFragment) => void,
}) {

  // derived state
  const { fragmentId, imageRefPart, onFragmentDelete, onFragmentReplace } = props;
  const { dataRef } = imageRefPart;

  // event handlers
  const handleDeleteFragment = React.useCallback(() => {
    onFragmentDelete?.(fragmentId);
  }, [fragmentId, onFragmentDelete]);

  const handleReplaceFragment = React.useCallback((newImageFragment: DMessageContentFragment) => {
    onFragmentReplace?.(fragmentId, newImageFragment);
  }, [fragmentId, onFragmentReplace]);

  const handleOpenInNewTab = React.useCallback(() => {
    void showImageDataRefInNewTab(dataRef); // fire/forget
  }, [dataRef]);


  // memo the scaled image style
  const scaledImageSx = React.useMemo((): SxProps => ({
    // overflowX: 'auto', // <- this would make the right side margin scrollable
    fontSize: themeScalingMap[props.contentScaling]?.blockFontSize ?? undefined,
    lineHeight: themeScalingMap[props.contentScaling]?.blockLineHeight ?? 1.75,
    marginBottom: themeScalingMap[props.contentScaling]?.blockImageGap ?? 1.5,
  }), [props.contentScaling]);

  return (
    <Box sx={blocksRendererSx}>
      {dataRef.reftype === 'dblob' ? (
        <ContentPartImageRefDBlob
          dataRefDBlobAssetId={dataRef.dblobAssetId}
          dataRefMimeType={dataRef.mimeType}
          imageAltText={imageRefPart.altText}
          imageWidth={imageRefPart.width}
          imageHeight={imageRefPart.height}
          onOpenInNewTab={handleOpenInNewTab}
          onDeleteFragment={onFragmentDelete ? handleDeleteFragment : undefined}
          onReplaceFragment={onFragmentReplace ? handleReplaceFragment : undefined}
          scaledImageSx={scaledImageSx}
        />
      ) : dataRef.reftype === 'url' ? (
        <ContentPartImageRefURL
          dataRefUrl={dataRef.url}
          // ...
          imageAltText={imageRefPart.altText}
          // ...
          scaledImageSx={scaledImageSx}
        />
      ) : (
        <Box>ContentPartImageRef: unknown reftype</Box>
      )}
    </Box>
  );
}
