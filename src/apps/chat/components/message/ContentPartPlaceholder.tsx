import * as React from 'react';

import { BlocksRenderer } from '~/modules/blocks/BlocksRenderer';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageRole } from '~/common/stores/chat/chat.message';


export function ContentPartPlaceholder(props: {
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