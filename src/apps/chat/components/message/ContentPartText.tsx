import * as React from 'react';
import type { Diff as TextDiff } from '@sanity/diff-match-patch';

import { BlocksRenderer, blocksRendererSx } from '~/modules/blocks/BlocksRenderer';

import type { ContentScaling } from '~/common/app.theme';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { InlineError } from '~/common/components/InlineError';
import { InlineTextarea } from '~/common/components/InlineTextarea';
import { createTextContentFragment, DMessageContentFragment, DMessageFragmentId, DMessageRole, DMessageTextPart } from '~/common/stores/chat/chat.message';

import { explainServiceErrors } from './explainServiceErrors';

/**
 * The OG part, comprised of text, which can be markdown, have code blocks, etc.
 * Uses BlocksRenderer to render the markdown/code/html/text, etc.
 */
export function ContentPartText(props: {
  textPart: DMessageTextPart,
  fragmentId: DMessageFragmentId,

  isEditingContent: boolean,
  setIsEditingContent: (isEditing: boolean) => void,
  onFragmentReplace?: (fragmentId: DMessageFragmentId, newFragment: DMessageContentFragment) => void,

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
  const { onFragmentReplace, fragmentId, setIsEditingContent } = props;
  const messageText = props.textPart.text;
  const fromAssistant = props.messageRole === 'assistant';

  const handleTextEdit = React.useCallback((newText: string) => {
    if (messageText !== newText)
      onFragmentReplace?.(fragmentId, createTextContentFragment(newText));
    else
      setIsEditingContent(false);
  }, [fragmentId, messageText, onFragmentReplace, setIsEditingContent]);

  const errorMessage = React.useMemo(
    () => explainServiceErrors(messageText, fromAssistant, props.messageOriginLLM),
    [fromAssistant, messageText, props.messageOriginLLM],
  );

  // if errored, render an Auto-Error message
  if (errorMessage) {
    return (
      <GoodTooltip placement='top' arrow title={messageText}>
        <div><InlineError error={`${errorMessage}. Hover this message for more details.`} /></div>
      </GoodTooltip>
    );
  }

  // if editing, render a Text Editor
  if (props.isEditingContent) {
    return (
      <InlineTextarea
        initialText={messageText}
        disableAutoSaveOnBlur
        onEdit={handleTextEdit}
        onCancel={() => setIsEditingContent(false)}
        sx={blocksRendererSx}
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
