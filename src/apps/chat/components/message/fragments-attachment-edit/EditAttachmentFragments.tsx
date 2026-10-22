import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageRole } from '~/common/stores/chat/chat.message';
import { DMessageAttachmentFragment, DMessageFragmentId, DMessageImageRefPart, isImagePart } from '~/common/stores/chat/chat.fragments';
import { dndDragEndReorder } from '~/common/components/dnd/dndDragEndReorder';
import { dndModifiers } from '~/common/components/dnd/dnd.config';
import { useDndDefaultSensors } from '~/common/components/dnd/useDndDefaultSensors';

import { SortableDocAttachmentButton } from '../fragments-attachment-doc/DocumentAttachmentFragments';
import { SortableImageAttachmentCard, imageAttachmentCardSx } from '../fragments-attachment-image/ImageAttachmentFragments';
import { ViewImageRefPartModal } from '../fragments-content/ViewImageRefPartModal';


const _styles = {
  list: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 1,
  },
} as const satisfies Record<string, SxProps>;

const _noop = () => undefined;


/**
 * Edit mode: one sortable list for the attachments of an `edit-attachments` node, images and documents in message
 * order, so a drag moves an item across kinds. Each item keeps its delete; images keep the title editor and the viewer.
 * The view-mode lists (`ImageAttachmentFragments`, `DocumentAttachmentFragments`) render the same items, per kind.
 */
export function EditAttachmentFragments(props: {
  fragments: readonly DMessageAttachmentFragment[],
  contentScaling: ContentScaling,
  messageRole: DMessageRole,
  onFragmentDelete?: (fragmentId: DMessageFragmentId) => void,
  onFragmentReplace?: (fragmentId: DMessageFragmentId, newFragment: DMessageAttachmentFragment) => void,
  onFragmentsReorder?: (reorderedIds: DMessageFragmentId[]) => void,
}) {

  // state
  const [viewingImageRefPart, setViewingImageRefPart] = React.useState<DMessageImageRefPart | null>(null);

  // dnd
  const sensors = useDndDefaultSensors();
  const fragmentIds = React.useMemo(() => props.fragments.map(fragment => fragment.fId), [props.fragments]);
  const isReordering = !!props.onFragmentsReorder;

  const { onFragmentsReorder } = props;

  const handleDragEnd = React.useCallback((event: DragEndEvent) => {
    dndDragEndReorder(event, fragmentIds, onFragmentsReorder);
  }, [fragmentIds, onFragmentsReorder]);

  const handleCloseViewImage = React.useCallback(() => setViewingImageRefPart(null), []);

  // memos
  const listSx = React.useMemo((): SxProps => ({
    ..._styles.list,
    justifyContent: props.messageRole === 'assistant' ? 'flex-start' : 'flex-end',
  }), [props.messageRole]);

  const cardSx = React.useMemo(() => imageAttachmentCardSx(props.contentScaling), [props.contentScaling]);


  return (
    <Box aria-label={`${props.fragments.length} attachments`} sx={listSx}>

      <DndContext sensors={sensors} modifiers={dndModifiers} onDragEnd={handleDragEnd}>
        <SortableContext items={fragmentIds}>
          {props.fragments.map(fragment => isImagePart(fragment.part) ? (
            <SortableImageAttachmentCard
              key={fragment.fId}
              fragment={fragment}
              isEditing
              onFragmentDelete={props.onFragmentDelete}
              onFragmentReplace={props.onFragmentReplace}
              onViewImageRefPart={setViewingImageRefPart}
              cardStyleSx={cardSx}
              isReordering={isReordering}
            />
          ) : (
            <SortableDocAttachmentButton
              key={fragment.fId}
              fragment={fragment}
              contentScaling={props.contentScaling}
              isSelected={false}
              isSelectable={false}
              toggleSelected={_noop}
              isReordering={isReordering}
              onFragmentDelete={props.onFragmentDelete}
            />
          ))}
        </SortableContext>
      </DndContext>

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
