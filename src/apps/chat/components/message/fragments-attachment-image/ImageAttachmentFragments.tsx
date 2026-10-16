import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Input, Sheet, Typography } from '@mui/joy';

import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';

import { RenderImageRefDBlob } from '~/modules/blocks/image/RenderImageRefDBlob';

import type { DMessageRole } from '~/common/stores/chat/chat.message';
import { ContentScaling, themeScalingMap } from '~/common/app.theme';
import { DMessageAttachmentFragment, DMessageFragmentId, DMessageImageRefPart, isZyncAssetReferencePart } from '~/common/stores/chat/chat.fragments';
import { dndDragEndReorder } from '~/common/components/dnd/dndDragEndReorder';
import { dndModifiers } from '~/common/components/dnd/dnd.config';
import { useDndDefaultSensors } from '~/common/components/dnd/useDndDefaultSensors';
import { useDndDragHandleSortable } from '~/common/components/dnd/useDndDragHandleSortable';

import { ViewImageRefPartModal } from '../fragments-content/ViewImageRefPartModal';


// configuration
const CARD_MIN_SQR = 84;
const CARD_MAX_WIDTH = CARD_MIN_SQR * 3;      // 3:1      max wide ratio (252px)
const CARD_MAX_HEIGHT = CARD_MIN_SQR * 2.25;  // 1:2.25   max tall ratio (189px)


const _styles = {

  // wrap around image cards
  flow: {
    // style
    my: 'auto',
    flex: 0,

    // layout
    display: 'flex',
    flexWrap: 'wrap',
    // alignItems: 'center',        // commented to keep them to the top
    // justifyContent: 'flex-end',  // commented as we do it dynamically
    gap: { xs: 0.5, md: 1 },
  },

  // sortable container and handle
  sortableContainer: {
    position: 'relative',
    display: 'inline-block',
  },
  sortableHandle: {
    position: 'absolute',
    left: 16,
    top: 12,
    zIndex: 2,
    '& > button': {
      backgroundColor: 'rgb(var(--joy-palette-neutral-lightChannel) / 50%)',
      borderRadius: 'sm',
      '&.MuiIconButton-colorWarning': { backgroundColor: 'warning.softBg' },
    },
  },

  // style for each image card
  imageCard: {
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
  },

  // wrapper for image with title overlay
  imageCardTitleWrapper: {
    position: 'relative',
    display: 'inline-block',
  },
  // title overlay for image
  titleOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderBottomLeftRadius: '6px', // sm
    borderBottomRightRadius: '6px', // sm
    px: 1,
    py: 0.5,
    overflow: 'hidden',
    wordBreak: 'break-all',
    '&:hover': { backgroundColor: 'primary.solidHoverBg', },
    cursor: 'pointer',
  },

} as const satisfies Record<string, SxProps>;


/**
 * Title overlay component with inline editing functionality
 */
function ImageTitleEditorOverlay(props: {
  title?: string,
  fragment: DMessageAttachmentFragment,
  onFragmentReplace?: (fragmentId: DMessageFragmentId, newFragment: DMessageAttachmentFragment) => void,
}) {

  // props
  const { title, onFragmentReplace, fragment } = props;

  // state
  const [editTitle, setEditTitle] = React.useState(title || '');
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);

  // refs, for optimization
  const titleRef = React.useRef(title);
  titleRef.current = title;


  // handlers

  const handleCancelEdit = React.useCallback(() => {
    setEditTitle(titleRef.current || '');
    setIsEditingTitle(false);
  }, []);

  const handleStartEditTitle = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onFragmentReplace) return;
    setEditTitle(titleRef.current || '');
    setIsEditingTitle(true);
  }, [onFragmentReplace]);

  const handleSaveTitle = React.useCallback(() => {
    setIsEditingTitle(false);
    if (!onFragmentReplace || editTitle === titleRef.current) return;
    onFragmentReplace(fragment.fId, {
      ...fragment,
      title: editTitle.trim() || '',
    });
  }, [onFragmentReplace, fragment, editTitle]);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter')
      handleSaveTitle();
    else if (e.key === 'Escape')
      handleCancelEdit();
  }, [handleSaveTitle, handleCancelEdit]);


  // skip render if title is not editable
  if (!onFragmentReplace) return null;

  return (
    <Sheet color='primary' variant='solid' invertedColors sx={_styles.titleOverlay} onClick={handleStartEditTitle}>
      {isEditingTitle ? (
        <Input
          size='sm'
          autoFocus
          value={editTitle}
          placeholder='Enter image title...'
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSaveTitle}
          sx={{ color: 'text.primary' }}
        />
      ) : (
        <Typography level='body-sm' sx={{
          color: 'text.primary',
          // clamp to 3 lines
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {title || 'Click to add title...'}
        </Typography>
      )}
    </Sheet>
  );
}


/**
 * Renders a single image attachment based on its part type
 */
function ImageAttachmentCard(props: {
  fragment: DMessageAttachmentFragment,
  isEditing?: boolean,
  onFragmentDelete?: (fragmentId: DMessageFragmentId) => void,
  onFragmentReplace?: (fragmentId: DMessageFragmentId, newFragment: DMessageAttachmentFragment) => void,
  onViewImageRefPart: (part: DMessageImageRefPart) => void,
  cardStyleSx: SxProps,
}) {

  const { fId, part, title } = props.fragment;

  let errorMessage: string | undefined;
  const pt = part?.pt;
  switch (pt) {

    case 'reference':

      // only Image Assets for now
      if (!isZyncAssetReferencePart(part) || part.assetType !== 'image') {
        errorMessage = `Unsupported reference type: ${part.rt}`;
        break;
      }

      // only support legacy image refs for now
      if (part._legacyImageRefPart?.dataRef?.reftype !== 'dblob') {
        errorMessage = `Asset ${part.zUuid} not available (Asset system not implemented)`;
        break;
      }

      const legacy = part._legacyImageRefPart;
      return (
        <Box sx={_styles.imageCardTitleWrapper}>
          <RenderImageRefDBlob
            key={'att-img-legacy-' + fId}
            dataRefDBlobAssetId={legacy.dataRef.dblobAssetId}
            dataRefMimeType={legacy.dataRef.mimeType}
            dataRefBytesSize={legacy.dataRef.bytesSize}
            imageWidth={legacy.width}
            imageHeight={legacy.height}
            imageAltText={part.zRefSummary?.text || legacy.altText || title}
            onDeleteFragment={!props.onFragmentDelete ? undefined : () => props.onFragmentDelete?.(fId)}
            onViewImage={() => props.onViewImageRefPart(legacy)}
            scaledImageSx={props.cardStyleSx}
            variant={props.isEditing ? 'attachment-card-edit' : 'attachment-card'}
          />

          {/* Editable Title overlay */}
          <ImageTitleEditorOverlay
            title={title}
            fragment={props.fragment}
            onFragmentReplace={props.onFragmentReplace}
          />
        </Box>
      );

    case 'image_ref':
      const imageRefPart = part;
      const { dataRef /*, altText */ } = imageRefPart;

      // only support rendering DBLob images as cards for now
      if (dataRef.reftype !== 'dblob') {
        errorMessage = `Unsupported dataRef type: ${dataRef.reftype}`;
        break;
      }

      return (
        <Box sx={_styles.imageCardTitleWrapper}>
          <RenderImageRefDBlob
            key={'att-img-' + fId}
            dataRefDBlobAssetId={dataRef.dblobAssetId}
            dataRefMimeType={dataRef.mimeType}
            dataRefBytesSize={dataRef.bytesSize}
            imageAltText={imageRefPart.altText || title}
            imageWidth={imageRefPart.width}
            imageHeight={imageRefPart.height}
            onDeleteFragment={!props.onFragmentDelete ? undefined : () => props.onFragmentDelete?.(fId)}
            onViewImage={() => props.onViewImageRefPart(imageRefPart)}
            scaledImageSx={props.cardStyleSx}
            variant={props.isEditing ? 'attachment-card-edit' : 'attachment-card'}
          />

          {/* Editable Title overlay */}
          <ImageTitleEditorOverlay
            title={title}
            fragment={props.fragment}
            onFragmentReplace={props.onFragmentReplace}
          />
        </Box>
      );

    // shall never happen - but just for type checking
    case 'doc':
    case '_pt_sentinel':
      errorMessage = `Unsupported part type: ${pt}`;
      break;

    default:
      const _exhaustiveCheck: never = pt;
      errorMessage = `Unsupported part type: ${pt}`;
      break;
  }

  return (
    <Typography key={'att-img-err-' + fId} color='danger'>
      <strong>Image Attachment Error:</strong> {errorMessage || `Unknown error with attachment ${fId}`}
    </Typography>
  );
}


/**
 * Wrapper for a RenderImageRefDBlob that adds DnD support with a grab handle.
 */
function SortableImageAttachmentCard(props: {
  fragment: DMessageAttachmentFragment,
  isEditing?: boolean,
  onFragmentDelete?: (fragmentId: DMessageFragmentId) => void,
  onFragmentReplace?: (fragmentId: DMessageFragmentId, newFragment: DMessageAttachmentFragment) => void,
  onViewImageRefPart: (part: DMessageImageRefPart) => void,
  cardStyleSx: SxProps,
  isReordering: boolean,
}) {

  const { fragment, isEditing, onFragmentDelete, onFragmentReplace, onViewImageRefPart, cardStyleSx, isReordering } = props;

  const { dragContainerSetRef, dragContainerStyle, dragHandle } = useDndDragHandleSortable(fragment.fId, !isReordering, isEditing ? 'warning' : 'neutral');

  return (
    <Box ref={dragContainerSetRef} style={dragContainerStyle} sx={_styles.sortableContainer}>

      {/* Drag Handle - top-left corner */}
      {!!dragHandle && <Box sx={_styles.sortableHandle}>{dragHandle}</Box>}

      {/* Image - using extracted component */}
      <ImageAttachmentCard
        fragment={fragment}
        isEditing={isEditing}
        onFragmentDelete={onFragmentDelete}
        onFragmentReplace={onFragmentReplace}
        onViewImageRefPart={onViewImageRefPart}
        cardStyleSx={cardStyleSx}
      />
    </Box>
  );
}


/**
 * Shows image attachments in a flexbox that wraps the images (overflowing by rows)
 * Also see `TextAttachmentFragments` for the text version, and 'ContentFragments'.
 */
export function ImageAttachmentFragments(props: {
  imageAttachments: DMessageAttachmentFragment[],
  contentScaling: ContentScaling,
  messageRole: DMessageRole,
  renderVariant?: 'chat-message' | 'data-editor',
  isEditing?: boolean,
  onFragmentDelete?: (fragmentId: DMessageFragmentId) => void,
  onFragmentReplace?: (fragmentId: DMessageFragmentId, newFragment: DMessageAttachmentFragment) => void,
  onFragmentsReorder?: (reorderedIds: DMessageFragmentId[]) => void,
}) {

  // state
  const [viewingImageRefPart, setViewingImageRefPart] = React.useState<DMessageImageRefPart | null>(null);

  // DnD setup
  const sensors = useDndDefaultSensors();
  const fragmentIds = React.useMemo(() => {
    return props.imageAttachments.map(fragment => fragment.fId);
  }, [props.imageAttachments]);

  // derived state
  const isReorderable = !!props.onFragmentsReorder && (props.isEditing || props.imageAttachments.length > 1);


  // handlers

  const handleCloseViewImage = React.useCallback(() => {
    setViewingImageRefPart(null);
  }, []);

  const handleViewImageRefPart = React.useCallback((part: DMessageImageRefPart) => {
    setViewingImageRefPart(part);
  }, []);

  const { onFragmentsReorder } = props;

  const handleDragEnd = React.useCallback((event: DragEndEvent) => {
    dndDragEndReorder(event, fragmentIds, onFragmentsReorder);
  }, [fragmentIds, onFragmentsReorder]);


  // memos

  const flowLayoutMemo = React.useMemo((): SxProps => ({
    ..._styles.flow,
    justifyContent: (props.messageRole === 'assistant' || props.renderVariant === 'data-editor') ? 'flex-start' : 'flex-end',
  }), [props.messageRole, props.renderVariant]);

  const cardStyleMemo = React.useMemo((): SxProps => ({
    fontSize: themeScalingMap[props.contentScaling]?.blockFontSize ?? undefined,
    lineHeight: themeScalingMap[props.contentScaling]?.blockLineHeight ?? 1.75,
    ..._styles.imageCard,
    ...(props.renderVariant !== 'data-editor' ? {} : {
      // border: 0, // no border in data-editor
      boxShadow: `0px 2px 4px -2px rgb(var(--joy-palette-primary-darkChannel) / 50%)`,
    }),
  }), [props.contentScaling, props.renderVariant]);


  return (
    <Box aria-label={`${props.imageAttachments.length} images`} sx={flowLayoutMemo}>

      {/* Image attachments with or without DnD */}
      {!isReorderable ? (
        props.imageAttachments.map((fragment) => (
          <ImageAttachmentCard
            key={fragment.fId}
            fragment={fragment}
            isEditing={props.isEditing}
            onFragmentDelete={props.onFragmentDelete}
            onFragmentReplace={props.onFragmentReplace}
            onViewImageRefPart={handleViewImageRefPart}
            cardStyleSx={cardStyleMemo}
          />
        ))
      ) : (
        <DndContext sensors={sensors} modifiers={dndModifiers} onDragEnd={handleDragEnd}>
          <SortableContext items={fragmentIds}>
            {props.imageAttachments.map((fragment) =>
              <SortableImageAttachmentCard
                key={fragment.fId}
                fragment={fragment}
                isEditing={props.isEditing}
                onFragmentDelete={props.onFragmentDelete}
                onFragmentReplace={props.onFragmentReplace}
                onViewImageRefPart={handleViewImageRefPart}
                cardStyleSx={cardStyleMemo}
                isReordering={true}
              />,
            )}
          </SortableContext>
        </DndContext>
      )}


      {/* Image Viewer modal */}
      {viewingImageRefPart && (
        <ViewImageRefPartModal
          imageRefPart={viewingImageRefPart}
          onClose={handleCloseViewImage}
        />
      )}

    </Box>
  );
}
