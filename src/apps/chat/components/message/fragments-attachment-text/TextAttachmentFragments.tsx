import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageAttachmentFragment, DMessageFragmentId, DMessageRole } from '~/common/stores/chat/chat.message';

import { ContentPartPlaceholder } from '../fragments-content/ContentPartPlaceholder';


const layoutSx: SxProps = {};


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

  if (!props.textFragments.length)
    return null;

  return (
    <Box aria-label={`${props.textFragments.length} image(s)`} sx={layoutSx}>

      {/* render each text attachment */}
      {props.textFragments.map((fragment, attachmentNumber) => (
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