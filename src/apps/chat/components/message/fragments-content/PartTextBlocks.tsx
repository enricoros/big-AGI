import * as React from 'react';
import type { Diff as TextDiff } from '@sanity/diff-match-patch';

import { AutoBlocksRenderer } from '~/modules/blocks/AutoBlocksRenderer';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageRole } from '~/common/stores/chat/chat.message';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { InlineError } from '~/common/components/InlineError';

import { explainServiceErrors } from '../explainServiceErrors';

/**
 * The OG part, comprised of text, which can be markdown, have code blocks, etc.
 * Uses BlocksRenderer to render the markdown/code/html/text, etc.
 */
export function PartTextBlocks(props: {
  textPartText: string,

  messageRole: DMessageRole,
  messageOriginLLM?: string,

  contentScaling: ContentScaling,
  fitScreen: boolean,
  renderTextAsMarkdown: boolean,
  renderTextDiff?: TextDiff[];

  showUnsafeHtml?: boolean,
  showTopWarning: string | undefined,
  optiAllowSubBlocksMemo: boolean,

  onContextMenu?: (event: React.MouseEvent) => void;
  onDoubleClick?: (event: React.MouseEvent) => void;

}) {

  // derived state
  const messageText = props.textPartText;
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
    <AutoBlocksRenderer
      text={messageText || ''}
      fromRole={props.messageRole}
      contentScaling={props.contentScaling}
      fitScreen={props.fitScreen}
      showUnsafeHtml={props.showUnsafeHtml}
      showTopWarning={props.showTopWarning}
      renderTextAsMarkdown={props.renderTextAsMarkdown}
      renderTextDiff={props.renderTextDiff}
      optiAllowSubBlocksMemo={props.optiAllowSubBlocksMemo}
      onContextMenu={props.onContextMenu}
      onDoubleClick={props.onDoubleClick}
    />
  );
}
