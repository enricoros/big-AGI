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
  // showAsProgress?: boolean,
}) {
  // const placeholder = (
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
  //
  // return props.showAsProgress ? (
  //   <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
  //     <CircularProgress color='neutral' size='sm' sx={{ ml: 1.5, '--CircularProgress-size': '16px', '--CircularProgress-trackThickness': '2px' }} /> {placeholder}
  //   </Box>
  // ) : (
  //   placeholder
  // );
}