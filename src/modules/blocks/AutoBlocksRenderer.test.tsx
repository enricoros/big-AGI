import assert from 'node:assert/strict';
import test from 'node:test';

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { AutoBlocksRenderer } from './AutoBlocksRenderer';


test('AutoBlocksRenderer preprocesses block math immediately on the streaming markdown block', () => {
  const markup = renderToStaticMarkup(
    <AutoBlocksRenderer
      text={`\\[
BR(TTI)=100\\cdot \\frac{1}{1+e^{-(\\alpha+\\beta \\cdot TTI)}}
\\]`}
      fromRole='assistant'
      contentScaling='md'
      fitScreen={false}
      isMobile={false}
      textRenderVariant='markdown'
      optiAllowSubBlocksMemo
    />,
  );

  assert.match(markup, /katex-display/);
  assert.doesNotMatch(markup, /\\\[/);
});
