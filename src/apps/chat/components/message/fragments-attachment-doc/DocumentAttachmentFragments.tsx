import * as React from 'react';
import { Box } from '@mui/joy';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageRole } from '~/common/stores/chat/chat.message';
import { DMessageAttachmentFragment, DMessageFragmentId, isDocPart, updateFragmentWithEditedText } from '~/common/stores/chat/chat.fragments';

import type { ChatMessageTextPartEditState } from '../ChatMessage';
import { DocAttachmentFragmentButton } from './DocAttachmentFragmentButton';
import { DocAttachmentFragment } from './DocAttachmentFragment';


/**
 * Displays a list of 'cards' which are buttons with a mutually exclusive active state.
 * When one is active, there is a content part just right under (with the collapse mechanism in case it's a user role).
 * If one is clicked the content part (use ContentPartText) is displayed.
 */
export function DocumentAttachmentFragments(props: {
  attachmentFragments: DMessageAttachmentFragment[],
  messageRole: DMessageRole,
  contentScaling: ContentScaling,
  isMobile: boolean,
  zenMode: boolean,
  allowSelection: boolean,
  disableMarkdownText: boolean,
  onFragmentDelete?: (fragmentId: DMessageFragmentId) => void,
  onFragmentReplace?: (fragmentId: DMessageFragmentId, newFragment: DMessageAttachmentFragment) => void,
}) {

  // state
  const [_activeFragmentId, setActiveFragmentId] = React.useState<DMessageFragmentId | null>(null);
  const [editState, setEditState] = React.useState<ChatMessageTextPartEditState | null>(null);


  // derived state
  const isSelectable = props.allowSelection;
  const activeFragmentId = !isSelectable ? null : _activeFragmentId;


  // selection

  const handleToggleSelectedId = React.useCallback((fragmentId: DMessageFragmentId) => {
    if (isSelectable)
      setActiveFragmentId(prevId => prevId === fragmentId ? null : fragmentId);
  }, [isSelectable]);

  const selectedFragment = props.attachmentFragments.find(fragment => fragment.fId === activeFragmentId);


  // editing

  const controlledEditor = false;
  const { onFragmentReplace } = props;

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


  // [effect] clear edits on onmount
  React.useEffect(() => {
    return () => setEditState(null);
  }, []);


  // memos
  const buttonsSx = React.useMemo(() => ({
    // layout
    display: 'flex',
    flexWrap: 'wrap',
    gap: 1,
    justifyContent: props.messageRole === 'assistant' ? 'flex-start' : 'flex-end',
    ...selectedFragment && { mb: 1 },
  }), [props.messageRole, selectedFragment]);


  return (
    <Box aria-label={`${props.attachmentFragments.length} attachments`} sx={{
      // layout
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* Document buttons */}
      <Box sx={buttonsSx}>
        {props.attachmentFragments.map((attachmentFragment) =>
          <DocAttachmentFragmentButton
            key={attachmentFragment.fId}
            fragment={attachmentFragment}
            contentScaling={props.contentScaling}
            isSelected={activeFragmentId === attachmentFragment.fId}
            isSelectable={props.allowSelection}
            toggleSelected={handleToggleSelectedId}
          />,
        )}
      </Box>

      {/* Document Viewer & Editor */}
      {!!selectedFragment && isDocPart(selectedFragment.part) && (
        <DocAttachmentFragment
          key={selectedFragment.fId /* this is here for the useLiveFile hook which otherwise would migrate state across fragments */}
          fragment={selectedFragment}
          controlledEditor={controlledEditor}
          messageRole={props.messageRole}
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
}
