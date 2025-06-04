import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import { BlocksContainer } from '~/modules/blocks/BlocksContainers';
import { RenderImageRefDBlob } from '~/modules/blocks/image/RenderImageRefDBlob';
import { RenderImageURL } from '~/modules/blocks/image/RenderImageURL';

import type { DMessageContentFragment, DMessageFragmentId, DMessageImageRefPart } from '~/common/stores/chat/chat.fragments';
import { ContentScaling, themeScalingMap } from '~/common/app.theme';

import { ViewImageRefPartModal } from './ViewImageRefPartModal';


export function BlockPartImageRef(props: {
  imageRefPart: DMessageImageRefPart,
  fragmentId?: DMessageFragmentId,
  disableViewer?: boolean,
  contentScaling: ContentScaling,
  onFragmentDelete?: (fragmentId: DMessageFragmentId) => void,
  onFragmentReplace?: (fragmentId: DMessageFragmentId, newFragment: DMessageContentFragment) => void,
}) {

  // state
  const [viewingImageRefPart, setViewingImageRefPart] = React.useState<DMessageImageRefPart | null>(null);

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

  const handleViewImage = React.useCallback(() => {
    setViewingImageRefPart(imageRefPart);
  }, [imageRefPart]);


  // memo the scaled image style
  const scaledImageSx = React.useMemo((): SxProps => ({
    // overflowX: 'auto', // <- this would make the right side margin scrollable
    fontSize: themeScalingMap[props.contentScaling]?.blockFontSize ?? undefined,
    lineHeight: themeScalingMap[props.contentScaling]?.blockLineHeight ?? 1.75,
    marginBottom: themeScalingMap[props.contentScaling]?.blockImageGap ?? 1.5,
  }), [props.contentScaling]);

  return (
    <BlocksContainer>

      {/* Render DBlob / URL / Error -> downloads -> Calls RenderImageURL */}
      {dataRef.reftype === 'dblob' ? (
        <RenderImageRefDBlob
          dataRefDBlobAssetId={dataRef.dblobAssetId}
          dataRefMimeType={dataRef.mimeType}
          dataRefBytesSize={dataRef.bytesSize}
          imageAltText={imageRefPart.altText}
          imageWidth={imageRefPart.width}
          imageHeight={imageRefPart.height}
          onDeleteFragment={onFragmentDelete ? handleDeleteFragment : undefined}
          onReplaceFragment={onFragmentReplace ? handleReplaceFragment : undefined}
          onViewImage={props.disableViewer ? undefined : handleViewImage}
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

      {/* Image viewer modal */}
      {!props.disableViewer && viewingImageRefPart && (
        <ViewImageRefPartModal
          imageRefPart={viewingImageRefPart}
          onClose={() => setViewingImageRefPart(null)}
        />
      )}

    </BlocksContainer>
  );
}
