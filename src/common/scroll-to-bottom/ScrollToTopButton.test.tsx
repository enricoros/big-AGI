import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ScrollToTopButton, getScrollToTopButtonSx } from './ScrollToTopButton';
import { UseScrollToBottomProvider } from './useScrollToBottom';


function renderScrollToTopButton(atTop: boolean | undefined) {
  return renderToStaticMarkup(
    <UseScrollToBottomProvider value={{
      stickToBottom: false,
      booting: false,
      atBottom: false,
      atTop,
      notifyBooting: () => undefined,
      setStickToBottom: () => undefined,
      scrollToTop: () => undefined,
      skipNextAutoScroll: () => undefined,
    }}>
      <ScrollToTopButton />
    </UseScrollToBottomProvider>,
  );
}

test('scroll to top button hides while the chat is already at the top', () => {
  const markup = renderScrollToTopButton(true);
  assert.doesNotMatch(markup, /Scroll To Top/);
});

test('scroll to top button renders an upward floating action when the chat is away from the top', () => {
  const markup = renderScrollToTopButton(false);
  assert.match(markup, /Scroll To Top/);
  assert.match(markup, /KeyboardDoubleArrowUpIcon/);

  assert.deepStrictEqual(getScrollToTopButtonSx(), {
    backgroundColor: 'background.surface',
    border: '1px solid',
    borderColor: 'neutral.500',
    borderRadius: '50%',
    boxShadow: 'sm',
    zIndex: 11,
    position: 'absolute',
    top: '1rem',
    right: {
      xs: '1rem',
      md: '2rem',
    },
  });
});

test('app chat mounts the top scroll button next to the existing bottom one', () => {
  const source = readFileSync(new URL('../../apps/chat/AppChat.tsx', import.meta.url), 'utf8');
  assert.match(source, /ScrollToTopButton/);
  assert.match(source, /<ScrollToTopButton\s*\/>/);
});
