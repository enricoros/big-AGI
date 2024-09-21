import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import { RenderImageRefDBlob, showImageDataRefInNewTab } from '~/modules/blocks/image/RenderImageRefDBlob';

import type { DMessageRole } from '~/common/stores/chat/chat.message';
import { ContentScaling, themeScalingMap } from '~/common/app.theme';
import { DMessageAttachmentFragment, DMessageFragmentId, isImageRefPart } from '~/common/stores/chat/chat.fragments';


// configuration
const CARD_MIN_SQR = 84;
const CARD_MAX_WIDTH = CARD_MIN_SQR * 3;      // 3:1      max wide ratio (252px)
const CARD_MAX_HEIGHT = CARD_MIN_SQR * 2.25;  // 1:2.25   max tall ratio (189px)


const layoutSx: SxProps = {
  // style
  my: 'auto',
  flex: 0,

  // layout
  display: 'flex',
  flexWrap: 'wrap',
  // alignItems: 'center',        // commented to keep them to the top
  // justifyContent: 'flex-end',  // commented as we do it dynamically
  gap: { xs: 0.5, md: 1 },
};

const imageSheetPatchSx: SxProps = {
  // undo the RenderImageURL default style
  m: 0,
  minWidth: CARD_MIN_SQR,
  minHeight: CARD_MIN_SQR,
  boxShadow: 'xs',
  // border: 'none',

  // style
  // backgroundColor: 'background.popup',
  borderRadius: 'sm',
  overflow: 'hidden',

  // style the <img> tag
  '& picture > img': {
    // override the style in RenderImageURL
    maxWidth: CARD_MAX_WIDTH, // very important to keep the aspect ratio
    maxHeight: CARD_MAX_HEIGHT, // very important to keep the aspect ratio
    // width: '100%',
    // height: '100%',
    // objectFit: 'cover',
  },
};


/**
 * Shows image attachments in a flexbox that wraps the images (overflowing by rows)
 * Also see `TextAttachmentFragments` for the text version, and 'ContentFragments'.
 */
export function ImageAttachmentFragments(props: {
  imageAttachments: DMessageAttachmentFragment[],
  contentScaling: ContentScaling,
  messageRole: DMessageRole,
  disabled?: boolean,
  onFragmentDelete: (fragmentId: DMessageFragmentId) => void,
}) {

  const layoutSxMemo = React.useMemo((): SxProps => ({
    ...layoutSx,
    justifyContent: props.messageRole === 'assistant' ? 'flex-start' : 'flex-end',
  }), [props.messageRole]);

  const cardStyleSxMemo = React.useMemo((): SxProps => ({
    fontSize: themeScalingMap[props.contentScaling]?.blockFontSize ?? undefined,
    lineHeight: themeScalingMap[props.contentScaling]?.blockLineHeight ?? 1.75,
    ...imageSheetPatchSx,
  }), [props.contentScaling]);


  return (
    <Box aria-label={`${props.imageAttachments.length} images`} sx={layoutSxMemo}>

      {/* render each image attachment */}
      {props.imageAttachments.map(attachmentFragment => {
        // only operate on image_ref
        if (!isImageRefPart(attachmentFragment.part))
          throw new Error('Unexpected part type: ' + attachmentFragment.part.pt);

        const { title, part: imageRefPart } = attachmentFragment;
        const { dataRef /*, altText */ } = imageRefPart;

        // only support rendering DBLob images as cards for now
        if (dataRef.reftype === 'dblob') {
          return (
            <RenderImageRefDBlob
              key={'att-img-' + attachmentFragment.fId}
              dataRefDBlobAssetId={dataRef.dblobAssetId}
              dataRefMimeType={dataRef.mimeType}
              imageAltText={imageRefPart.altText || title}
              imageWidth={imageRefPart.width}
              imageHeight={imageRefPart.height}
              disabled={props.disabled}
              onOpenInNewTab={() => showImageDataRefInNewTab(dataRef)}
              onDeleteFragment={() => props.onFragmentDelete(attachmentFragment.fId)}
              scaledImageSx={cardStyleSxMemo}
              variant='attachment-card'
            />
          );
        }

        throw new Error('Unexpected dataRef type: ' + dataRef.reftype);
      })}

    </Box>
  );
}