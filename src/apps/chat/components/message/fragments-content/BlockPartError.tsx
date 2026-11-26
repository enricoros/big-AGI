import * as React from 'react';

import { ScaledTextBlockRenderer } from '~/modules/blocks/ScaledTextBlockRenderer';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageRole } from '~/common/stores/chat/chat.message';


/**
 * An error part: the text of an error stored before the AIX issue records, or one a caller made (Beam, tools).
 * A failure of a chat generation is an `aix.issue` part: BlockPartAixIssue.
 */
export function BlockPartError(props: {
  errorText: string,
  messageRole: DMessageRole,
  contentScaling: ContentScaling,
}) {

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