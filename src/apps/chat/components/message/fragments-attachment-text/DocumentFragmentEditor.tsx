import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import { BlocksRenderer } from '~/modules/blocks/BlocksRenderer';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageAttachmentFragment, DMessageFragmentId, DMessageRole } from '~/common/stores/chat/chat.message';
import { marshallWrapText } from '~/common/stores/chat/chat.tokens';


const viewPaneSx: SxProps = {
  backgroundColor: 'background.surface',
  border: '1px solid',
  borderColor: 'primary.outlinedBorder',
  borderRadius: 'sm',
  boxShadow: 'inset 2px 0px 5px -4px var(--joy-palette-background-backdrop)',
  mt: 0.5,
  p: 1.5,
  pt: 0,
};


export function DocumentFragmentEditor(props: {
  fragment: DMessageAttachmentFragment,
  editedText?: string,
  messageRole: DMessageRole,
  contentScaling: ContentScaling,
  isMobile?: boolean,
  renderTextAsMarkdown: boolean,
  onFragmentDelete: (fragmentId: DMessageFragmentId) => void,
  onFragmentReplace: (fragmentId: DMessageFragmentId, newContent: DMessageAttachmentFragment) => void,
}) {

  // derived state
  const { fragment, onFragmentDelete, onFragmentReplace } = props;
  const [isEditing, setIsEditing] = React.useState(false);

  const fragmentId = fragment.fId;
  const fragmentTitle = fragment.title;
  const part = fragment.part;

  // handlers

  const handleDeleteFragment = React.useCallback(() => {
    onFragmentDelete(fragmentId);
  }, [fragmentId, onFragmentDelete]);

  const handleReplaceFragment = React.useCallback((newFragment: DMessageAttachmentFragment) => {
    onFragmentReplace(fragmentId, newFragment);
  }, [fragmentId, onFragmentReplace]);


  if (part.pt !== 'text')
    throw new Error('Unexpected part type: ' + part.pt);

  return (
    <Box sx={viewPaneSx}>
      <BlocksRenderer
        text={marshallWrapText(part.text, '', 'markdown-code')}
        // text={selectedFragment.part.text}
        fromRole={props.messageRole}
        contentScaling={props.contentScaling}
        fitScreen={props.isMobile}
        renderTextAsMarkdown={props.renderTextAsMarkdown}
      />
    </Box>
  );
}