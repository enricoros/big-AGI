import * as React from 'react';
import type { Diff as TextDiff } from '@sanity/diff-match-patch';

import { Box, Tooltip, Typography } from '@mui/joy';

import { BlocksRenderer, editBlocksSx } from '~/modules/blocks/BlocksRenderer';

import type { ContentScaling } from '~/common/app.theme';
import { InlineError } from '~/common/components/InlineError';
import { InlineTextarea } from '~/common/components/InlineTextarea';
import { createTextContentFragment, DMessageContentFragment, DMessageImagePart, DMessageRole, DMessageTextPart } from '~/common/stores/chat/chat.message';

import { explainServiceErrors } from './explainServiceErrors';

/*
TODO:
- [ ] restore the global background of the message in case of error
- [ ] bubble on assistant error (shall disable onMouseUp on the listItem)
- [ ]
 */

export function FragmentImageRef(props: {
  imageRefPart: DMessageImagePart,
  imageRefPartIndex: number,
}) {
  return <Box>FragmentImageRef: not implemented</Box>;
}

export function FragmentPlaceholderPart(props: {
  placeholderText: string,
  messageRole: DMessageRole,
  contentScaling: ContentScaling,
}) {
  return (
    <BlocksRenderer
      text={props.placeholderText}
      fromRole={props.messageRole}
      contentScaling={props.contentScaling}
      renderTextAsMarkdown={false}
      fitScreen={false}
    />
  );
}

/**
 * The OG part, comprised of text, which can be markdown, have code blocks, etc.
 */
export function FragmentTextPart(props: {
  textPart: DMessageTextPart,
  textPartIndex: number,

  isEditingContent: boolean,
  setIsEditingContent: (isEditing: boolean) => void,
  onContentEdit?: (contentIndex: number, newContent: DMessageContentFragment) => void,

  messageRole: DMessageRole,
  messageOriginLLM?: string,

  contentScaling: ContentScaling,
  fitScreen: boolean,
  isBottom?: boolean,
  renderTextAsMarkdown: boolean,
  renderTextDiff?: TextDiff[];

  showUnsafeHtml?: boolean,
  showTopWarning: string | undefined,
  optiAllowSubBlocksMemo: boolean,

  onContextMenu?: (event: React.MouseEvent) => void;
  onDoubleClick?: (event: React.MouseEvent) => void;

}) {

  // derived state
  const { onContentEdit, textPartIndex } = props;
  const messageText = props.textPart.text;
  const fromAssistant = props.messageRole === 'assistant';

  const handleTextEdited = React.useCallback((newText: string) => {
    if (messageText !== newText)
      onContentEdit?.(textPartIndex, createTextContentFragment(newText));
  }, [messageText, onContentEdit, textPartIndex]);

  const { errorMessage } = React.useMemo(
    () => explainServiceErrors(messageText, fromAssistant, props.messageOriginLLM),
    [fromAssistant, messageText, props.messageOriginLLM],
  );

  // if errored, render an Auto-Error message
  if (errorMessage) {
    return (
      <Tooltip title={<Typography sx={{ maxWidth: 800 }}>{messageText}</Typography>} variant='soft'>
        <InlineError error={errorMessage} />
      </Tooltip>
    );
  }

  // if editing, render a Text Editor
  if (props.isEditingContent) {
    return (
      <InlineTextarea
        initialText={messageText} onEdit={handleTextEdited}
        sx={editBlocksSx}
      />
    );
  }

  return (
    <BlocksRenderer
      text={messageText || ''}
      fromRole={props.messageRole}
      contentScaling={props.contentScaling}
      fitScreen={props.fitScreen}
      isBottom={props.isBottom}
      showUnsafeHtml={props.showUnsafeHtml}
      showTopWarning={props.showTopWarning}
      specialDiagramMode={false}
      renderTextAsMarkdown={props.renderTextAsMarkdown}
      renderTextDiff={props.renderTextDiff}
      optiAllowSubBlocksMemo={props.optiAllowSubBlocksMemo}
      onContextMenu={props.onContextMenu}
      onDoubleClick={props.onDoubleClick}
    />
  );
}
