import * as React from 'react';

import type { WordsDiff } from '~/modules/blocks/wordsdiff/RenderWordsDiff';
import { AutoBlocksHtmlRenderVariant, AutoBlocksRenderer } from '~/modules/blocks/AutoBlocksRenderer';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageFragmentId } from '~/common/stores/chat/chat.fragments';
import type { DMessageRole } from '~/common/stores/chat/chat.message';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { InlineError } from '~/common/components/InlineError';

import { isSLMOutput, SLMOutputRenderer } from '~/modules/slm/SLMOutputRenderer';

import { explainServiceErrors } from '../explainServiceErrors';

/**
 * The OG part, comprised of text, which can be markdown, have code blocks, etc.
 * Uses BlocksRenderer to render the markdown/code/html/text, etc.
 */
export function BlockPartText_AutoBlocks(props: {
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

  optiAllowSubBlocksMemo: boolean,
  optiStreamingLastFragment?: boolean,

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

  // SLM pipeline output: render with collapsible phase accordion UI
  if (fromAssistant && isSLMOutput(messageText))
    return <SLMOutputRenderer text={messageText} />;

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
      blocksProcessor={undefined}
      inputAsCodeWithTitle={undefined}
      inputAsWordsDiff={props.inputAsWordsDiff}
      codeRenderVariant='enhanced' // can still be downgraded to 'outlined', e.g. for small snippets or given vnd types
      htmlRenderVariant={props.htmlRenderVariant}
      textRenderVariant={props.disableMarkdownText ? 'text' : 'markdown'}
      optiAllowSubBlocksMemo={props.optiAllowSubBlocksMemo}
      optiStreamingLastFragment={props.optiStreamingLastFragment}
      onDoubleClick={props.onDoubleClick}
      setText={!props.setEditedText ? undefined : handleSetText}
    />
  );
}
