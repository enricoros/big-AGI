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
  let textToRender = props.errorText;
  let renderAsMarkdown = false;

  // render as markdown (better looking) if there is no 'structure' that requres plaintext ("{" basically)
  const containsBold = textToRender.indexOf('**') !== -1;
  const containsStructure = textToRender.indexOf('{') !== -1 && props.errorText.indexOf('}') !== -1;
  if (containsBold && !containsStructure)
    renderAsMarkdown = true;

  // if there's structure, still (potentially) remove the starting and ending '**' from the first occurrence
  if (!renderAsMarkdown && containsBold && textToRender.startsWith('**')) {
    const closingBoldIndex = textToRender.indexOf('**', 2);
    if (closingBoldIndex > 2) {
      // Remove the starting and ending '**' from the first occurrence
      textToRender =
        textToRender.substring(2, closingBoldIndex) +
        textToRender.substring(closingBoldIndex + 2);
    }
  }

  return (
    <ScaledTextBlockRenderer
      text={textToRender}
      contentScaling={props.contentScaling}
      textRenderVariant={renderAsMarkdown ? 'markdown' : 'text'}
      showAsDanger
    />
  );
}