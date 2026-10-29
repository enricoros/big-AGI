import * as React from 'react';

import type { WordsDiff } from '~/modules/blocks/wordsdiff/RenderWordsDiff';
import { AutoBlocksHtmlRenderVariant, AutoBlocksRenderer } from '~/modules/blocks/AutoBlocksRenderer';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageFragmentId } from '~/common/stores/chat/chat.fragments';
import type { DMessageRole } from '~/common/stores/chat/chat.message';



/** Settled fragments skip streaming updates elsewhere in the message. */
export const BlockPartText_AutoBlocksMemo = React.memo(BlockPartText_AutoBlocks);


/**
 * The OG part, comprised of text, which can be markdown, have code blocks, etc.
 * Uses BlocksRenderer to render the markdown/code/html/text, etc.
 */
function BlockPartText_AutoBlocks(props: {
  // current value
  textPartText: string,
  messageRole: DMessageRole,

  fragmentId: DMessageFragmentId,
  setEditedText?: (fragmentId: DMessageFragmentId, value: string, applyNow: boolean) => void,

  contentScaling: ContentScaling,
  fitScreen: boolean,
  isMobile: boolean,

  inputAsWordsDiff?: WordsDiff,

  disableMarkdownText: boolean,
  htmlRenderVariant?: AutoBlocksHtmlRenderVariant,

  inFlux: boolean,

  onReattachAsFile?: (file: File) => void;
  onDoubleClick?: (event: React.MouseEvent) => void;

}) {

  // derived state
  const messageText = props.textPartText;


  // handlers

  const { fragmentId, setEditedText } = props;

  const handleSetText = React.useCallback((newText: string) => {
    setEditedText?.(fragmentId, newText, true);
  }, [fragmentId, setEditedText]);


  return (
    <AutoBlocksRenderer
      text={messageText || ''}
      fromRole={props.messageRole}
      contentScaling={props.contentScaling}
      fitScreen={props.fitScreen}
      isMobile={props.isMobile}
      blocksProcessor={undefined}
      inputAsCodeWithTitle={undefined}
      inputAsWordsDiff={props.inputAsWordsDiff}
      codeRenderVariant='enhanced' // can still be downgraded to 'outlined', e.g. for small snippets or given vnd types
      htmlRenderVariant={props.htmlRenderVariant}
      textRenderVariant={props.disableMarkdownText ? 'text' : props.messageRole === 'user' ? 'markdown-user' : 'markdown'}
      inFlux={props.inFlux}
      onDoubleClick={props.onDoubleClick}
      setText={!props.setEditedText ? undefined : handleSetText}
      onReattachAsFile={props.onReattachAsFile}
    />
  );
}
