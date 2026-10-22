import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageRole } from '~/common/stores/chat/chat.message';
import { DMessageAttachmentFragment, DMessageFragmentId, DMessageImageRefPart, isDocPart, isImagePart, updateFragmentWithEditedText } from '~/common/stores/chat/chat.fragments';
import { dndDragEndReorder } from '~/common/components/dnd/dndDragEndReorder';
import { dndModifiers } from '~/common/components/dnd/dnd.config';
import { useDndDefaultSensors } from '~/common/components/dnd/useDndDefaultSensors';

import { DocAttachmentFragmentPane } from '../fragments-attachment-doc/DocAttachmentFragmentPane';
import { SortableDocAttachmentButton } from '../fragments-attachment-doc/DocumentAttachmentFragments';
import { SortableImageAttachmentCard, imageAttachmentCardSx } from '../fragments-attachment-image/ImageAttachmentFragments';
import { ViewImageRefPartModal } from '../fragments-content/ViewImageRefPartModal';


const _styles = {
  column: {
    display: 'flex',
    flexDirection: 'column',
  },
  list: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 1,
  },
} as const satisfies Record<string, SxProps>;


/**
 * Edit mode: one sortable list for the attachments of an `edit-attachments` node, images and documents in message
 * order, so a drag moves an item across kinds. Each item keeps its delete; images keep the title editor and the viewer;
 * a document opens its pane below the list, where text and title edits go to the copy like every other edit.
 * The view-mode lists (`ImageAttachmentFragments`, `DocumentAttachmentFragments`) render the same items, per kind.
 */
export function EditAttachmentFragments(props: {
  fragments: readonly DMessageAttachmentFragment[],
  contentScaling: ContentScaling,
  messageRole: DMessageRole,
  isMobile: boolean,
  zenMode: boolean,
  disableMarkdownText: boolean,
  onFragmentDelete?: (fragmentId: DMessageFragmentId) => void,
  onFragmentReplace?: (fragmentId: DMessageFragmentId, newFragment: DMessageAttachmentFragment) => void,
  onFragmentsReorder?: (reorderedIds: DMessageFragmentId[]) => void,
}) {

  // state
  const [viewingImageRefPart, setViewingImageRefPart] = React.useState<DMessageImageRefPart | null>(null);
  const [activeFragmentId, setActiveFragmentId] = React.useState<DMessageFragmentId | null>(null);

  // dnd
  const sensors = useDndDefaultSensors();
  const fragmentIds = React.useMemo(() => props.fragments.map(fragment => fragment.fId), [props.fragments]);
  const isReordering = !!props.onFragmentsReorder;

  // the open document, when still a member
  const selectedFragment = props.fragments.find(fragment => fragment.fId === activeFragmentId);

  const { onFragmentReplace, onFragmentsReorder } = props;

  const handleDragEnd = React.useCallback((event: DragEndEvent) => {
    dndDragEndReorder(event, fragmentIds, onFragmentsReorder);
  }, [fragmentIds, onFragmentsReorder]);

  const handleToggleSelected = React.useCallback((fragmentId: DMessageFragmentId) => {
    setActiveFragmentId(prevId => prevId === fragmentId ? null : fragmentId);
  }, []);

  // the pane's editor is controlled: every keystroke replaces the document in the copy
  const handleEditSetText = React.useCallback((fragmentId: DMessageFragmentId, value: string) => {
    if (!onFragmentReplace || !selectedFragment) return;
    const updatedFragment = updateFragmentWithEditedText(selectedFragment, value);
    if (updatedFragment) onFragmentReplace(fragmentId, updatedFragment);
  }, [onFragmentReplace, selectedFragment]);

  const handleCloseViewImage = React.useCallback(() => setViewingImageRefPart(null), []);

  // memos
  const listSx = React.useMemo((): SxProps => ({
    ..._styles.list,
    justifyContent: props.messageRole === 'assistant' ? 'flex-start' : 'flex-end',
    ...selectedFragment && { mb: 1 },
  }), [props.messageRole, selectedFragment]);

  const cardSx = React.useMemo(() => imageAttachmentCardSx(props.contentScaling), [props.contentScaling]);


  return (
    <Box aria-label={`${props.fragments.length} attachments`} sx={_styles.column}>

      <Box sx={listSx}>
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
                isSelected={activeFragmentId === fragment.fId}
                isSelectable
                toggleSelected={handleToggleSelected}
                isReordering={isReordering}
                dragHandleColor='warning'
                onFragmentDelete={props.onFragmentDelete}
              />
            ))}
          </SortableContext>
        </DndContext>
      </Box>

      {/* Document viewer and editor: edits go to the copy, Ok closes the editor, Done stores the message */}
      {!!selectedFragment && isDocPart(selectedFragment.part) && (
        <DocAttachmentFragmentPane
          key={selectedFragment.fId /* the useLiveFile hook must not carry state across fragments */}
          fragment={selectedFragment}
          controlledEditor
          messageRole={props.messageRole}
          renderVariant='chat-message'
          setEditedText={handleEditSetText}
          contentScaling={props.contentScaling}
          isMobile={props.isMobile}
          zenMode={props.zenMode}
          disableMarkdownText={props.disableMarkdownText}
          onFragmentDelete={props.onFragmentDelete}
          onFragmentReplace={props.onFragmentReplace}
        />
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
