import * as React from 'react';
import { Box } from '@mui/joy';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageAttachmentFragment, DMessageRole } from '~/common/stores/chat/chat.message';

import { ContentPartPlaceholder } from '../fragments-content/ContentPartPlaceholder';


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