import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import { RenderImageURL } from '~/modules/blocks/RenderImageURL';
import { blocksRendererSx } from '~/modules/blocks/BlocksRenderer';

import type { DMessageContentFragment, DMessageFragmentId, DMessageImageRefPart } from '~/common/stores/chat/chat.fragments';
import { ContentScaling, themeScalingMap } from '~/common/app.theme';

import { PartImageRefDBlob, showImageDataRefInNewTab } from './PartImageRefDBlob';


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
        <PartImageRefDBlob
          dataRefDBlobAssetId={dataRef.dblobAssetId}
          dataRefMimeType={dataRef.mimeType}
          imageAltText={imageRefPart.altText}
          imageWidth={imageRefPart.width}
          imageHeight={imageRefPart.height}
          onOpenInNewTab={handleOpenInNewTab}
          onDeleteFragment={onFragmentDelete ? handleDeleteFragment : undefined}
          onReplaceFragment={onFragmentReplace ? handleReplaceFragment : undefined}
          scaledImageSx={scaledImageSx}
          partVariant='content-part'
        />
      ) : dataRef.reftype === 'url' ? (
        <RenderImageURL
          imageURL={dataRef.url}
          infoText={imageRefPart.altText}
          scaledImageSx={scaledImageSx}
          variant='content-part'
        />
      ) : (
        <Box>
          ContentPartImageRef: unknown reftype
        </Box>
      )}
    </Box>
  );
}
