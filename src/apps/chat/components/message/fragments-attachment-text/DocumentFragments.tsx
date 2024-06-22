import * as React from 'react';
import { Box } from '@mui/joy';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageAttachmentFragment, DMessageFragmentId, DMessageRole } from '~/common/stores/chat/chat.message';

import { DocumentFragmentButton } from './DocumentFragmentButton';
import { DocumentFragmentEditor } from './DocumentFragmentEditor';
import { ChatMessageTextPartEditState } from '../ChatMessage';


/**
 * Displays a list of 'cards' which are buttons with a mutually exclusive active state.
 * When one is active, there is a content part just right under (with the collapse mechanism in case it's a user role).
 * If one is clicked the content part (use ContentPartText) is displayed.
 */
export function DocumentFragments(props: {
  attachmentFragments: DMessageAttachmentFragment[],
  messageRole: DMessageRole,
  contentScaling: ContentScaling,
  isMobile?: boolean,
  renderTextAsMarkdown: boolean;
  onFragmentDelete: (fragmentId: DMessageFragmentId) => void,
  onFragmentReplace: (fragmentId: DMessageFragmentId, newContent: DMessageAttachmentFragment) => void,
}) {

  // state
  const [selectedFragmentId, setSelectedFragmentId] = React.useState<DMessageFragmentId | null>(null);
  const [textAttachmentsEditState, setTextAttachmentsEditState] = React.useState<ChatMessageTextPartEditState | null>(null);

  // [effect] clear edits on onmount
  React.useEffect(() => {
    return () => setTextAttachmentsEditState(null);
  }, []);

  const handleToggleSelected = React.useCallback((fragmentId: DMessageFragmentId) => {
    setSelectedFragmentId(prevId => prevId === fragmentId ? null : fragmentId);
  }, []);

  const handleSetEditedText = React.useCallback((fragmentId: DMessageFragmentId, value: string) => {
    setTextAttachmentsEditState(prevState => ({
      ...prevState,
      [fragmentId]: value,
    }));
  }, []);

  const selectedFragment = props.attachmentFragments.find(fragment => fragment.fId === selectedFragmentId);

  return (
    <Box aria-label={`${props.attachmentFragments.length} attachments`} sx={{
      // layout
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* Horizontally scrollable Document buttons */}
      <Box sx={{
        pb: 0.5, // 4px:  to show the button shadow

        // layout
        display: 'flex',
        flexWrap: 'wrap',
        gap: 1,
        justifyContent: props.messageRole === 'assistant' ? 'flex-start' : 'flex-end',
      }}>
        {props.attachmentFragments.map((attachmentFragment) =>
          <DocumentFragmentButton
            key={attachmentFragment.fId}
            fragment={attachmentFragment}
            contentScaling={props.contentScaling}
            isSelected={selectedFragmentId === attachmentFragment.fId}
            toggleSelected={handleToggleSelected}
          />,
        )}
      </Box>

      {/* Document Viewer & Editor */}
      {!!selectedFragment && (
        <DocumentFragmentEditor
          fragment={selectedFragment}
          messageRole={props.messageRole}
          editedText={textAttachmentsEditState?.[selectedFragment.fId]}
          setEditedText={handleSetEditedText}
          contentScaling={props.contentScaling}
          isMobile={props.isMobile}
          renderTextAsMarkdown={props.renderTextAsMarkdown}
          onFragmentDelete={props.onFragmentDelete}
          onFragmentReplace={props.onFragmentReplace}
        />
      )}

    </Box>
  );
}
