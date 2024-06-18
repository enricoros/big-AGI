import * as React from 'react';
import type { Diff as TextDiff } from '@sanity/diff-match-patch';

import { BlocksRenderer } from '~/modules/blocks/BlocksRenderer';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageRole, DMessageTextPart } from '~/common/stores/chat/chat.message';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { InlineError } from '~/common/components/InlineError';

import { explainServiceErrors } from '../explainServiceErrors';

/**
 * The OG part, comprised of text, which can be markdown, have code blocks, etc.
 * Uses BlocksRenderer to render the markdown/code/html/text, etc.
 */
export function ContentPartText(props: {
  textPart: DMessageTextPart,

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
  const messageText = props.textPart.text;
  const fromAssistant = props.messageRole === 'assistant';

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
