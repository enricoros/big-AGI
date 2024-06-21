import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import type { DMessageAttachmentFragment, DMessageFragmentId } from '~/common/stores/chat/chat.message';
import { ContentScaling, themeScalingMap } from '~/common/app.theme';

import { ContentPartImageRefDBlob, showImageDataRefInNewTab } from '../fragments-content/ContentPartImageRef';


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
  // alignItems: 'center',
  justifyContent: 'flex-end',

  // display: 'grid',
  // gridTemplateColumns: 'repeat(auto-fit, minmax(max(min(100%, 400px), 100%/5), 1fr))',
  gap: { xs: 0.5, md: 1 },
};

const imageSheetPatchSx: SxProps = {
  // undo the RenderImageURL default style
  m: 0,
  minWidth: CARD_MIN_SQR,
  minHeight: CARD_MIN_SQR,
  boxShadow: 'sm',

  // style
  // backgroundColor: 'background.popup',
  borderRadius: 'sm',
  overflow: 'hidden',

  // style the <img> tag
  '& picture > img': {
    // override the style in RenderImageURL
    maxWidth: CARD_MAX_WIDTH, // very important to keep the aspect ratio
    maxHeight: CARD_MAX_HEIGHT, // very important to keep the aspect ratio

    // style
    // width: '100%',
    // height: '100%',
    // objectFit: 'cover',
  },
};


/**
 * Shows image attachments in a Grid (responsive), similarly to
 */
export function ImageAttachmentFragments(props: {
  imageAttachments: DMessageAttachmentFragment[],
  contentScaling: ContentScaling,
  isMobile?: boolean,
  onFragmentDelete: (fragmentId: DMessageFragmentId) => void,
}) {


  // memo the scaled image style
  const scaledImageCardSx = React.useMemo((): SxProps => ({
    fontSize: themeScalingMap[props.contentScaling]?.blockFontSize ?? undefined,
    lineHeight: themeScalingMap[props.contentScaling]?.blockLineHeight ?? 1.75,
    ...imageSheetPatchSx,
  }), [props.contentScaling]);


  return (
    <Box aria-label={`${props.imageAttachments.length} image(s)`} sx={layoutSx}>

      {/* render each image attachment */}
      {props.imageAttachments.map(attachmentFragment => {
        if (attachmentFragment.part.pt !== 'image_ref')
          throw new Error('Unexpected part type: ' + attachmentFragment.part.pt);

        const { title, part: imageRefPart } = attachmentFragment;
        const { dataRef, altText } = imageRefPart;

        // only support rendering DBLob images as cards for now
        if (dataRef.reftype === 'dblob') {
          return (
            <ContentPartImageRefDBlob
              key={'att-img-' + attachmentFragment.fId}
              dataRefDBlobAssetId={dataRef.dblobAssetId}
              dataRefMimeType={dataRef.mimeType}
              imageAltText={imageRefPart.altText || title}
              imageWidth={imageRefPart.width}
              imageHeight={imageRefPart.height}
              onOpenInNewTab={() => showImageDataRefInNewTab(dataRef)}
              onDeleteFragment={() => props.onFragmentDelete(attachmentFragment.fId)}
              scaledImageSx={scaledImageCardSx}
              variant='attachment-card'
            />
          );
        }

        throw new Error('Unexpected dataRef type: ' + dataRef.reftype);
      })}

    </Box>
  );
}