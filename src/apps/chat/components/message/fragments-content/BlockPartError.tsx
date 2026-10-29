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
      // determine the 'kinds' of disconnection errors in aix.client.ts
      // - 'network error' (browser) -> client side
      // - 'connection terminated' (tRPC 'Stream closed' wrapper) -> server/edge side (CSF recovery)
      // - 'upstream dropped' (undici TypeError 'terminated') -> upstream provider socket drop (CSF recovery applies)
      const kind =
        props.errorText.includes('**network error**') ? 'net-client-closed'
          : props.errorText.includes('**connection terminated**') ? 'net-server-closed'
            : props.errorText.includes('**upstream dropped**') ? 'net-server-closed'
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

  // Bold markers: render as markdown, or (with structure) as plain text with the leading label unbolded
  let textToRender = props.errorText;
  let renderAsMarkdown = false;

  // render as markdown (better looking) if there is no 'structure' that requres plaintext ("{" basically)
  const containsBold = textToRender.indexOf('**') !== -1;
  const containsStructure = textToRender.indexOf('{') !== -1 && props.errorText.indexOf('}') !== -1;
  if (containsBold && !containsStructure)
    renderAsMarkdown = true;

  // if there's structure, still unbold the leading label: the first '**...**' pair ahead of the structure (issue texts may
  // start with a space or a symbol, e.g. ' **[Parsing Issue] D**: ... {' and ' ❌ **[D Issue]:** ... {')
  if (!renderAsMarkdown && containsBold) {
    textToRender = textToRender.trimStart();
    const openBoldIndex = textToRender.indexOf('**');
    const closingBoldIndex = textToRender.indexOf('**', openBoldIndex + 2);
    if (openBoldIndex !== -1 && closingBoldIndex > openBoldIndex + 2 && closingBoldIndex < textToRender.indexOf('{'))
      textToRender =
        textToRender.substring(0, openBoldIndex) +
        textToRender.substring(openBoldIndex + 2, closingBoldIndex) +
        textToRender.substring(closingBoldIndex + 2);
  }

  // NOTE: in the future we can also append:
  //   <ExternalDocsLink color='danger' level='body-sm' docPage='issue-key-and-access'>What this error means</ExternalDocsLink>

  return (
    <ScaledTextBlockRenderer
      text={textToRender}
      contentScaling={props.contentScaling}
      textRenderVariant={renderAsMarkdown ? 'markdown' : 'text'}
      showAsDanger
    />
  );
}