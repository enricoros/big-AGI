import * as React from 'react';

import { ScaledTextBlockRenderer } from '~/modules/blocks/ScaledTextBlockRenderer';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageErrorPart } from '~/common/stores/chat/chat.fragments';
import type { DMessageRole } from '~/common/stores/chat/chat.message';

import { BlockPartError_NetDisconnected } from './BlockPartError_NetDisconnected';
import { BlockPartError_RequestExceeded } from './BlockPartError_RequestExceeded';


export function BlockPartError(props: {
  errorText: string,
  errorHint?: DMessageErrorPart['hint'],
  messageRole: DMessageRole,
  messageGeneratorLlmId?: string | null,
  contentScaling: ContentScaling,
}) {

  // special error presentation, based on hints
  switch (props.errorHint) {
    case 'aix-net-disconnected':
      // determine the 2 'kinds' of disconnection errors in aix.client.ts
      const kind =
        props.errorText.includes('**network error**') ? 'net-client-closed'
          : props.errorText.includes('**connection terminated**') ? 'net-server-closed'
            : 'net-unknown-closed';

      // For client-side error, we don't show the _NetDisconnected component
      if (kind === 'net-client-closed')
        break;

      return <BlockPartError_NetDisconnected disconnectionKind={kind} messageGeneratorLlmId={props.messageGeneratorLlmId} contentScaling={props.contentScaling} />;

    case 'aix-request-exceeded':
      return <BlockPartError_RequestExceeded messageGeneratorLlmId={props.messageGeneratorLlmId} contentScaling={props.contentScaling} />;

    default:
      // continue rendering generic error
      break;
  }

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