import * as React from 'react';

import { BlocksRenderer } from '~/modules/blocks/BlocksRenderer';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageRole } from '~/common/stores/chat/chat.message';


export function ContentPartPlaceholder(props: {
  placeholderText: string,
  messageRole: DMessageRole,
  contentScaling: ContentScaling,
  showAsDanger?: boolean,
  showAsItalic?: boolean,
}) {
  return (
    <BlocksRenderer
      text={props.placeholderText}
      fromRole={props.messageRole}
      contentScaling={props.contentScaling}
      fitScreen={false}
      showAsDanger={props.showAsDanger}
      showAsItalic={props.showAsItalic}
      renderTextAsMarkdown={false}
    />
  );
}