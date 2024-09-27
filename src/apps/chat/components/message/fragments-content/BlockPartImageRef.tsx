import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import { BlocksContainer } from '~/modules/blocks/BlocksContainers';
import { RenderImageRefDBlob, showImageDataRefInNewTab } from '~/modules/blocks/image/RenderImageRefDBlob';
import { RenderImageURL } from '~/modules/blocks/image/RenderImageURL';

import type { DMessageContentFragment, DMessageFragmentId, DMessageImageRefPart } from '~/common/stores/chat/chat.fragments';
import { ContentScaling, themeScalingMap } from '~/common/app.theme';


export function BlockPartImageRef(props: {
  imageRefPart: DMessageImageRefPart,
  fragmentId?: DMessageFragmentId,
  contentScaling: ContentScaling,
  onFragmentDelete?: (fragmentId: DMessageFragmentId) => void,
  onFragmentReplace?: (fragmentId: DMessageFragmentId, newFragment: DMessageContentFragment) => void,
}) {

  // derived state
  const { fragmentId, imageRefPart, onFragmentDelete, onFragmentReplace } = props;
  const { dataRef } = imageRefPart;

  // event handlers
  const handleDeleteFragment = React.useCallback(() => {
    if (fragmentId && onFragmentDelete)
      onFragmentDelete(fragmentId);
  }, [fragmentId, onFragmentDelete]);

  const handleReplaceFragment = React.useCallback((newImageFragment: DMessageContentFragment) => {
    if (fragmentId && onFragmentReplace)
      onFragmentReplace(fragmentId, newImageFragment);
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
    <BlocksContainer>
      {dataRef.reftype === 'dblob' ? (
        <RenderImageRefDBlob
          dataRefDBlobAssetId={dataRef.dblobAssetId}
          dataRefMimeType={dataRef.mimeType}
          imageAltText={imageRefPart.altText}
          imageWidth={imageRefPart.width}
          imageHeight={imageRefPart.height}
          onOpenInNewTab={handleOpenInNewTab}
          onDeleteFragment={onFragmentDelete ? handleDeleteFragment : undefined}
          onReplaceFragment={onFragmentReplace ? handleReplaceFragment : undefined}
          scaledImageSx={scaledImageSx}
          variant='content-part'
        />
      ) : dataRef.reftype === 'url' ? (
        <RenderImageURL
          imageURL={dataRef.url}
          expandableText={imageRefPart.altText}
          scaledImageSx={scaledImageSx}
          variant='content-part'
        />
      ) : (
        <Box>
          ContentPartImageRef: unknown reftype
        </Box>
      )}
    </BlocksContainer>
  );
}
