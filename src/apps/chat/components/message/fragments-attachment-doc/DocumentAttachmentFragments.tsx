import * as React from 'react';
import { Box, Button } from '@mui/joy';

import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageRole } from '~/common/stores/chat/chat.message';
import { DMessageAttachmentFragment, DMessageFragmentId, isDocPart, updateFragmentWithEditedText } from '~/common/stores/chat/chat.fragments';
import { dndDragEndReorder } from '~/common/components/dnd/dndDragEndReorder';
import { dndModifiers } from '~/common/components/dnd/dnd.config';
import { useDndDefaultSensors } from '~/common/components/dnd/useDndDefaultSensors';
import { useDndDragHandleSortable } from '~/common/components/dnd/useDndDragHandleSortable';

import type { ChatMessageTextPartEditState } from '../ChatMessage';
import { DocAttachmentFragmentButton } from './DocAttachmentFragmentButton';
import { DocAttachmentFragmentPane } from './DocAttachmentFragmentPane';


/**
 * Wrapper for a DocAttachmentFragmentButton that adds DnD support.
 */
function SortableDocAttachmentButton(props: {
  fragment: DMessageAttachmentFragment,
  contentScaling: ContentScaling,
  isSelected: boolean,
  isSelectable: boolean,
  toggleSelected: (fragmentId: DMessageFragmentId) => void,
  isReordering: boolean,
  onFragmentDelete?: (fragmentId: DMessageFragmentId) => void,
}) {

  const { fragment, contentScaling, isSelected, isSelectable, isReordering, toggleSelected } = props;

  const { dragContainerSetRef, dragContainerStyle, dragHandle } = useDndDragHandleSortable(fragment.fId, !isReordering, isSelectable ? 'neutral' : 'warning');

  return (
    <Box ref={dragContainerSetRef} style={dragContainerStyle} sx={{ display: 'inline-block' }}>
      <DocAttachmentFragmentButton
        fragment={fragment}
        contentScaling={contentScaling}
        isSelected={isSelected}
        isSelectable={isSelectable}
        toggleSelected={toggleSelected}
        dragHandle={(isReordering && !isSelected) ? dragHandle : undefined}
        onFragmentDelete={props.onFragmentDelete}
      />
    </Box>
  );
}


/**
 * Displays a list of 'cards' which are buttons with a mutually exclusive active state.
 * When one is active, there is a content part just right under (with the collapse mechanism in case it's a user role).
 * If one is clicked the content part (use ContentPartText) is displayed.
 */
export const DocumentAttachmentFragments = React.memo(function DocumentAttachmentFragments(props: {
  attachmentFragments: DMessageAttachmentFragment[],
  messageRole: DMessageRole,
  renderVariant: 'chat-message' | 'data-editor',
  contentScaling: ContentScaling,
  isMobile: boolean,
  zenMode: boolean,
  allowSelection: boolean,
  allowReordering: boolean,
  disableMarkdownText: boolean,
  onFragmentDelete?: (fragmentId: DMessageFragmentId) => void,
  onFragmentReplace?: (fragmentId: DMessageFragmentId, newFragment: DMessageAttachmentFragment) => void,
  onFragmentsReorder?: (reorderedIds: DMessageFragmentId[]) => void,
}) {

  // state
  const [_activeFragmentId, setActiveFragmentId] = React.useState<DMessageFragmentId | null>(null);
  const [editState, setEditState] = React.useState<ChatMessageTextPartEditState | null>(null);
  const [showAllAttachments, setShowAllAttachments] = React.useState<boolean>(false);

  // DnD setup
  const sensors = useDndDefaultSensors();
  const fragmentIds = React.useMemo(() => {
    return props.attachmentFragments.map(fragment => fragment.fId);
  }, [props.attachmentFragments]);

  // derived state
  const isSelectable = props.allowSelection;
  const onInlineDelete = !isSelectable ? props.onFragmentDelete : undefined;
  const isReorderable = props.allowReordering && !!props.onFragmentsReorder && (!isSelectable || props.attachmentFragments.length > 1);
  const activeFragmentId = !isSelectable ? null : _activeFragmentId;


  // selection

  const handleToggleSelectedId = React.useCallback((fragmentId: DMessageFragmentId) => {
    if (isSelectable)
      setActiveFragmentId(prevId => prevId === fragmentId ? null : fragmentId);
  }, [isSelectable]);

  const selectedFragment = props.attachmentFragments.find(fragment => fragment.fId === activeFragmentId);


  // editing

  const controlledEditor = props.renderVariant === 'data-editor';
  const { onFragmentReplace, onFragmentsReorder } = props;

  const handleEditSetText = React.useCallback((fragmentId: DMessageFragmentId, value: string) => {
    if (!onFragmentReplace || !selectedFragment) return;

    // uncontrolled: store edits as overlay state
    if (!controlledEditor) {
      setEditState(prevState => ({ ...prevState, [fragmentId]: value }));
      return;
    }

    // edited text fragment
    const updatedFragment = updateFragmentWithEditedText(selectedFragment, value);
    if (!updatedFragment) return;

    // alter parent state
    onFragmentReplace(fragmentId, updatedFragment);
  }, [controlledEditor, onFragmentReplace, selectedFragment]);

  const handleFragmentReplace = React.useCallback((fragmentId: DMessageFragmentId, newFragment: DMessageAttachmentFragment) => {
    if (!onFragmentReplace) return;

    // reset the edit overlay state
    if (!controlledEditor) {
      setEditState(prevState => {
        const newState = { ...prevState };
        delete newState[fragmentId];
        return newState;
      });
    }

    // alter parent state
    onFragmentReplace(fragmentId, newFragment);
  }, [controlledEditor, onFragmentReplace]);

  const handleDragEnd = React.useCallback((event: DragEndEvent) => {
    dndDragEndReorder(event, fragmentIds, onFragmentsReorder);
  }, [fragmentIds, onFragmentsReorder]);

  // [effect] clear edits on unmount
  React.useEffect(() => {
    return () => setEditState(null);
  }, []);


  // pagination logic
  const SHOW_LIMIT = 49;
  const totalAttachments = props.attachmentFragments.length;
  const hasMoreThanLimit = totalAttachments > SHOW_LIMIT + 1; // +1 to account for "show more" button
  const visibleAttachments = hasMoreThanLimit && !showAllAttachments
    ? props.attachmentFragments.slice(0, SHOW_LIMIT)
    : props.attachmentFragments;
  const remainingCount = totalAttachments - SHOW_LIMIT;

  const handleToggleShowAll = React.useCallback(() => {
    setShowAllAttachments(prev => !prev);
  }, []);


  // memos
  const wrappingButtonsSx = React.useMemo(() => ({
    // layout
    display: 'flex',
    flexWrap: 'wrap',
    gap: 1,
    justifyContent: (props.messageRole === 'assistant' || props.renderVariant === 'data-editor') ? 'flex-start' : 'flex-end',
    ...selectedFragment && { mb: 1 },
  }), [props.messageRole, props.renderVariant, selectedFragment]);


  return (
    <Box aria-label={`${props.attachmentFragments.length} attachments`} sx={{
      // layout
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* Document buttons with or without DnD */}
      {!isReorderable ? (
        <Box sx={wrappingButtonsSx}>
          {visibleAttachments.map((attachmentFragment) =>
            <DocAttachmentFragmentButton
              key={attachmentFragment.fId}
              fragment={attachmentFragment}
              contentScaling={props.contentScaling}
              isSelected={activeFragmentId === attachmentFragment.fId}
              isSelectable={isSelectable}
              toggleSelected={handleToggleSelectedId}
              onFragmentDelete={onInlineDelete}
            />,
          )}

          {/* Show more/less button */}
          {hasMoreThanLimit && (
            <Button
              size={props.contentScaling === 'md' ? 'md' : 'sm'}
              variant={isSelectable ? 'soft' : 'plain'}
              onClick={handleToggleShowAll}
              sx={{
                minHeight: props.contentScaling === 'md' ? 40 : props.contentScaling === 'sm' ? 38 : 36,
                minWidth: '64px',
                fontWeight: 'md',
              }}
            >
              {showAllAttachments ? `Show fewer docs...` : `Show ${remainingCount} more...`}
            </Button>
          )}
        </Box>
      ) : (
        <DndContext sensors={sensors} modifiers={dndModifiers} onDragEnd={handleDragEnd}>
          <SortableContext items={fragmentIds}>
            <Box sx={wrappingButtonsSx}>
              {props.attachmentFragments.map((attachmentFragment) =>
                <SortableDocAttachmentButton
                  key={attachmentFragment.fId}
                  fragment={attachmentFragment}
                  contentScaling={props.contentScaling}
                  isSelected={activeFragmentId === attachmentFragment.fId}
                  isSelectable={isSelectable}
                  toggleSelected={handleToggleSelectedId}
                  isReordering={true}
                  onFragmentDelete={onInlineDelete}
                />,
              )}
            </Box>
          </SortableContext>
        </DndContext>
      )}

      {/* Document Viewer & Editor */}
      {!!selectedFragment && isDocPart(selectedFragment.part) && (
        <DocAttachmentFragmentPane
          key={selectedFragment.fId /* this is here for the useLiveFile hook which otherwise would migrate state across fragments */}
          fragment={selectedFragment}
          controlledEditor={controlledEditor}
          messageRole={props.messageRole}
          renderVariant={props.renderVariant}
          editedText={controlledEditor ? undefined : editState?.[selectedFragment.fId]}
          setEditedText={handleEditSetText}
          contentScaling={props.contentScaling}
          isMobile={props.isMobile}
          zenMode={props.zenMode}
          disableMarkdownText={props.disableMarkdownText}
          onFragmentDelete={props.onFragmentDelete}
          onFragmentReplace={!props.onFragmentReplace ? undefined : handleFragmentReplace}
        />
      )}

    </Box>
  );
});
