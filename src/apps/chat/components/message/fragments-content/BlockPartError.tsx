import * as React from 'react';

import { ScaledTextBlockRenderer } from '~/modules/blocks/ScaledTextBlockRenderer';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageRole } from '~/common/stores/chat/chat.message';


export function BlockPartError(props: {
  errorText: string,
  messageRole: DMessageRole,
  contentScaling: ContentScaling,
}) {
  return (
    <ScaledTextBlockRenderer
      text={props.errorText}
      contentScaling={props.contentScaling}
      textRenderVariant='text'
      showAsDanger
    />
  );
}