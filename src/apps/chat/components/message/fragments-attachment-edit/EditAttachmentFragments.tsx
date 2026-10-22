import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Sheet } from '@mui/joy';

import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageRole } from '~/common/stores/chat/chat.message';
import { DMessageAttachmentFragment, DMessageFragmentId, DMessageImageRefPart, isDocPart, isImagePart, updateFragmentWithEditedText } from '~/common/stores/chat/chat.fragments';
import { dndDragEndReorder } from '~/common/components/dnd/dndDragEndReorder';
import { dndModifiers } from '~/common/components/dnd/dnd.config';
import { useDndDefaultSensors } from '~/common/components/dnd/useDndDefaultSensors';

import type { CMEditDrafts } from '../cmEditDrafts';
import { CMEditAttach, cmEditFrameSx } from '../CMEditAttach';
import { DocAttachmentFragmentPane } from '../fragments-attachment-doc/DocAttachmentFragmentPane';
import { SortableDocAttachmentButton } from '../fragments-attachment-doc/DocumentAttachmentFragments';
import { SortableImageAttachmentCard, imageAttachmentCardSx } from '../fragments-attachment-image/ImageAttachmentFragments';
import { ViewImageRefPartModal } from '../fragments-content/ViewImageRefPartModal';


const _styles = {
  // the group is one framed unit: list, add row, pane
  frame: {
    ...cmEditFrameSx,
    display: 'flex',
    flexDirection: 'column',
  },
  list: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 1,
    // edit mode: the row starts at the gutter, like the editors (view mode aligns by role)
    justifyContent: 'flex-start',
  },
  pane: {
    mt: 1,
  },
} as const satisfies Record<string, SxProps>;


/**
 * Edit mode: one sortable list for the attachments of an `edit-attachments` node, images (compact) and documents in
 * message order, so a drag moves an item across kinds. Each item keeps its delete; images keep the title editor and the
 * viewer; a document opens its pane below the list, where text and title edits go to the copy like every other edit.
 * With `drafts`, a footer row adds attachments to this group (after its last member; Insert now, else at Done).
 * The view-mode lists (`ImageAttachmentFragments`, `DocumentAttachmentFragments`) render the same items, per kind.
 */
export function EditAttachmentFragments(props: {
  fragments: readonly DMessageAttachmentFragment[],
  contentScaling: ContentScaling,
  messageRole: DMessageRole,
  isMobile: boolean,
  disableMarkdownText: boolean,
  drafts?: CMEditDrafts,
  onFragmentDelete?: (fragmentId: DMessageFragmentId) => void,
  onFragmentReplace?: (fragmentId: DMessageFragmentId, newFragment: DMessageAttachmentFragment) => void,
  onFragmentsReorder?: (reorderedIds: DMessageFragmentId[]) => void,
}) {

  // state
  const [viewingImageRefPart, setViewingImageRefPart] = React.useState<DMessageImageRefPart | null>(null);
  const [activeFragmentId, setActiveFragmentId] = React.useState<DMessageFragmentId | null>(null);

  // the add row's anchor: this group's last member, read at Done
  const lastMemberRef = React.useRef<DMessageFragmentId | null>(null);
  lastMemberRef.current = props.fragments[props.fragments.length - 1]?.fId ?? null;

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
  const cardSx = React.useMemo(() => imageAttachmentCardSx(props.contentScaling, undefined, true), [props.contentScaling]);


  return (
    <Sheet color='warning' variant='soft' aria-label={`${props.fragments.length} attachments`} sx={_styles.frame}>

      <Box sx={_styles.list}>
        <DndContext sensors={sensors} modifiers={dndModifiers} onDragEnd={handleDragEnd}>
          <SortableContext items={fragmentIds}>
            {props.fragments.map(fragment => isImagePart(fragment.part) ? (
              <SortableImageAttachmentCard
                key={fragment.fId}
                fragment={fragment}
                isEditing
                compact
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
                color='warning'
                toggleSelected={handleToggleSelected}
                isReordering={isReordering}
                dragHandleColor='warning'
                onFragmentDelete={props.onFragmentDelete}
              />
            ))}
          </SortableContext>
        </DndContext>
      </Box>

      {/* Document viewer and editor: edits go to the copy, Ok closes the editor, Done stores */}
      {!!selectedFragment && isDocPart(selectedFragment.part) && (
        <Box sx={_styles.pane}>
          <DocAttachmentFragmentPane
            key={selectedFragment.fId /* the useLiveFile hook must not carry state across fragments */}
            fragment={selectedFragment}
            controlledEditor
            messageRole={props.messageRole}
            setEditedText={handleEditSetText}
            contentScaling={props.contentScaling}
            isMobile={props.isMobile}
            disableMarkdownText={props.disableMarkdownText}
            onFragmentDelete={props.onFragmentDelete}
            onFragmentReplace={props.onFragmentReplace}
          />
        </Box>
      )}

      {/* The group's footer: add attachments to this group (after its last member), Insert takes them now */}
      {!!props.drafts && (
        <CMEditAttach variant='group' drafts={props.drafts} anchorRef={lastMemberRef} isMobile={props.isMobile} />
      )}

      {/* Image Viewer modal */}
      {viewingImageRefPart && (
        <ViewImageRefPartModal
          imageRefPart={viewingImageRefPart}
          onClose={handleCloseViewImage}
        />
      )}

    </Sheet>
  );
}
