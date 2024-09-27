import * as React from 'react';

import { ScaledTextBlockRenderer } from '~/modules/blocks/ScaledTextBlockRenderer';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageRole } from '~/common/stores/chat/chat.message';


export function BlockPartPlaceholder(props: {
  placeholderText: string,
  messageRole: DMessageRole,
  contentScaling: ContentScaling,
  showAsItalic?: boolean,
  // showAsProgress?: boolean,
}) {
  // const placeholder = (
  return (
    <ScaledTextBlockRenderer
      text={props.placeholderText}
      contentScaling={props.contentScaling}
      textRenderVariant='text'
      showAsItalic={props.showAsItalic}
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