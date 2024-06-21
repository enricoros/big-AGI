import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageAttachmentFragment, DMessageFragmentId, DMessageRole } from '~/common/stores/chat/chat.message';

import { ContentPartPlaceholder } from '../fragments-content/ContentPartPlaceholder';


const attachmentFragmentsLayoutSx: SxProps = {
  // the container is a grid, in ChatMessage
  height: '100%',
  overflowX: 'auto',
  pr: 5,

  // layout
  display: 'flex',
  gap: 1,

  '& *': {
    // border imporant! debug
    border: '1px solid red!important',
  },
};


/**
 * Displays a list of 'cards' which are buttons with a mutually exclusive active state.
 * When one is active, there is a content part just right under (with the collapse mechanism in case it's a user role).
 * If one is clicked the content part (use ContentFragments with a single Fragment) is displayed.
 */
export function TextAttachmentFragments(props: {
  textFragments: DMessageAttachmentFragment[],
  messageRole: DMessageRole,
  contentScaling: ContentScaling,
  isMobile?: boolean,
  onFragmentDelete: (fragmentId: DMessageFragmentId) => void,
}) {

  // state
  const [selectedFragmentId, setSelectedFragmentId] = React.useState<DMessageFragmentId | null>(null);


  return (
    <Box aria-label={`${props.textFragments.length} text attachments`}>

      {/* Horizontally scrollable Attachments */}
      <Box sx={attachmentFragmentsLayoutSx}>

        {/* render each text attachment */}
        {props.textFragments.map((attachmentFragment) => {
          // only operate on text
          if (attachmentFragment.part.pt !== 'text')
            throw new Error('Unexpected part type: ' + attachmentFragment.part.pt);

          return (
            <ContentPartPlaceholder
              key={'att-txt-' + attachmentFragment.fId}
              placeholderText={`Attachment Placeholder: ${attachmentFragment.part.text}`}
              messageRole={props.messageRole}
              contentScaling={props.contentScaling}
            />
          );
        })}


        {/*{llmAttachmentDrafts.map((llmAttachment) =>*/}
        {/*  <LLMAttachmentItem*/}
        {/*    key={llmAttachment.attachmentDraft.id}*/}
        {/*    llmAttachment={llmAttachment}*/}
        {/*    menuShown={llmAttachment.attachmentDraft.id === itemMenuAttachmentDraftId}*/}
        {/*    onToggleMenu={handleDraftMenuToggle}*/}
        {/*  />,*/}
        {/*)}*/}

      </Box>

      {/* Viewer for the selected attachment */}


    </Box>
  );
}