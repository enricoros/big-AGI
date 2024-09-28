import * as React from 'react';

import type { ContentScaling } from '~/common/app.theme';

import { BlocksContainer } from './BlocksContainers';
import { RenderMarkdown } from './markdown/RenderMarkdown';
import { RenderPlainText } from './plaintext/RenderPlainText';
import { useScaledTypographySx } from './blocks.styles';


/**
 * Smaller and lighter-weight version of AutoBlocksRenderer for rendering just some text
 */
export function ScaledTextBlockRenderer(props: {
  text: string,
  contentScaling: ContentScaling,
  textRenderVariant: 'text' | 'markdown',
  showAsDanger?: boolean,
  showAsItalic?: boolean,
}) {

  // state
  const scaledTypographySx = useScaledTypographySx(props.contentScaling, !!props.showAsDanger, !!props.showAsItalic);

  return (
    <BlocksContainer>
      {props.textRenderVariant === 'markdown' ? <RenderMarkdown content={props.text} sx={scaledTypographySx} />
        : props.textRenderVariant === 'text' ? <RenderPlainText content={props.text} sx={scaledTypographySx} />
          : ('unknown textRenderVariant: ' + props.textRenderVariant)}
    </BlocksContainer>
  );
}
