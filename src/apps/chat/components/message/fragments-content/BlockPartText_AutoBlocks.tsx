import * as React from 'react';

import type { WordsDiff } from '~/modules/blocks/wordsdiff/RenderWordsDiff';
import { AutoBlocksRenderer } from '~/modules/blocks/AutoBlocksRenderer';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageFragmentId } from '~/common/stores/chat/chat.fragments';
import type { DMessageRole } from '~/common/stores/chat/chat.message';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { InlineError } from '~/common/components/InlineError';

import { explainServiceErrors } from '../explainServiceErrors';

/**
 * The OG part, comprised of text, which can be markdown, have code blocks, etc.
 * Uses BlocksRenderer to render the markdown/code/html/text, etc.
 */
export function BlockPartText_AutoBlocks(props: {
  // current value
  textPartText: string,
  setEditedText?: (fragmentId: DMessageFragmentId, value: string, applyNow: boolean) => void,

  fragmentId: DMessageFragmentId,
  messageRole: DMessageRole,

  contentScaling: ContentScaling,
  isMobile: boolean,
  fitScreen: boolean,
  disableMarkdownText: boolean,
  enhanceCodeBlocks: boolean,
  renderAsWordsDiff?: WordsDiff,

  showUnsafeHtmlCode?: boolean,
  optiAllowSubBlocksMemo: boolean,

  onContextMenu?: (event: React.MouseEvent) => void;
  onDoubleClick?: (event: React.MouseEvent) => void;

}) {

  // derived state
  const messageText = props.textPartText;
  const fromAssistant = props.messageRole === 'assistant';


  // handlers

  const { fragmentId, setEditedText } = props;

  const handleSetText = React.useCallback((newText: string) => {
    setEditedText?.(fragmentId, newText, true);
  }, [fragmentId, setEditedText]);


  const errorExplainer = React.useMemo(
    () => !messageText ? null : explainServiceErrors(messageText, fromAssistant),
    [fromAssistant, messageText],
  );

  // if errored, render an Auto-Error message
  if (errorExplainer) {
    return (
      <GoodTooltip placement='top' arrow title={messageText}>
        <div><InlineError error={<>{errorExplainer} Hover this message for more details.</>} /></div>
      </GoodTooltip>
    );
  }

  return (
    <AutoBlocksRenderer
      text={messageText || ''}
      fromRole={props.messageRole}
      contentScaling={props.contentScaling}
      fitScreen={props.fitScreen}
      isMobile={props.isMobile}
      showUnsafeHtmlCode={props.showUnsafeHtmlCode}
      renderAsWordsDiff={props.renderAsWordsDiff}
      codeRenderVariant={props.enhanceCodeBlocks ? 'enhanced' : 'outlined'}
      textRenderVariant={props.disableMarkdownText ? 'text' : 'markdown'}
      optiAllowSubBlocksMemo={props.optiAllowSubBlocksMemo}
      onContextMenu={props.onContextMenu}
      onDoubleClick={props.onDoubleClick}
      setText={props.setEditedText ? handleSetText : undefined}
    />
  );
}
