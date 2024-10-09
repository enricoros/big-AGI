import * as React from 'react';

import { ScaledTextBlockRenderer } from '~/modules/blocks/ScaledTextBlockRenderer';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageRole } from '~/common/stores/chat/chat.message';


export function BlockPartError(props: {
  errorText: string,
  messageRole: DMessageRole,
  contentScaling: ContentScaling,
}) {

  // Check if the errorText starts with '**' and has a closing '**' following Markdown rules
  let unBoldText = props.errorText;
  if (unBoldText.startsWith('**')) {
    const closingBoldIndex = unBoldText.indexOf('**', 2);
    if (closingBoldIndex > 2) {
      // Remove the starting and ending '**' from the first occurrence
      unBoldText =
        unBoldText.substring(2, closingBoldIndex) +
        unBoldText.substring(closingBoldIndex + 2);
    }
  }

  return (
    <ScaledTextBlockRenderer
      text={unBoldText}
      contentScaling={props.contentScaling}
      textRenderVariant='text'
      showAsDanger
    />
  );
}