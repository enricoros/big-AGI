import * as React from 'react';
import { Box } from '@mui/joy';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageAttachmentFragment, DMessageRole } from '~/common/stores/chat/chat.message';

import { ContentPartPlaceholder } from '../fragments-content/ContentPartPlaceholder';

/**
 * Displays a list of 'cards' which are buttons with a mutually exclusive active state.
 * When one is active, there is a content part just right under (with the collapse mechanism in case it's a user role).
 * If one is clicked the content part (use ContentFragments with a single Fragment) is displayed.
 */
export function AttachmentFragments(props: {
  attachmentFragments: DMessageAttachmentFragment[],
  messageRole: DMessageRole,
  contentScaling: ContentScaling,
}) {

  if (!props.attachmentFragments.length)
    return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {props.attachmentFragments.map((fragment, attachmentNumber) => (
        <ContentPartPlaceholder
          key={'attachment-part-' + attachmentNumber}
          placeholderText={`Attachment Placeholder: ${fragment.part.pt}`}
          messageRole={props.messageRole}
          contentScaling={props.contentScaling}
        />
      ))}
    </Box>
  );
}