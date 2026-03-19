import assert from 'node:assert/strict';
import test from 'node:test';

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { UseScrollToBottomProvider } from '~/common/scroll-to-bottom/useScrollToBottom';

import {
  ConversationMinimapControls,
  getConversationMinimapControlSlotSx,
  getConversationMinimapRootSx,
} from './ConversationMinimap';


function renderControls(args: {
  atTop: boolean | undefined;
  atBottom: boolean | undefined;
  stickToBottom: boolean;
}) {
  return renderToStaticMarkup(
    <UseScrollToBottomProvider value={{
      stickToBottom: args.stickToBottom,
      booting: false,
      atBottom: args.atBottom,
      atTop: args.atTop,
      notifyBooting: () => undefined,
      setStickToBottom: () => undefined,
      scrollToTop: () => undefined,
      skipNextAutoScroll: () => undefined,
    }}>
      <>
        <ConversationMinimapControls position='top' />
        <ConversationMinimapControls position='bottom' />
      </>
    </UseScrollToBottomProvider>,
  );
}

test('conversation minimap controls render the top and bottom arrows around the minimap when scrolling is available', () => {
  const markup = renderControls({ atTop: false, atBottom: false, stickToBottom: false });
  assert.match(markup, /Scroll To Top/);
  assert.match(markup, /Scroll To Bottom/);
});

test('conversation minimap controls hide arrows when already pinned at both ends', () => {
  const markup = renderControls({ atTop: true, atBottom: true, stickToBottom: true });
  assert.doesNotMatch(markup, /Scroll To Top/);
  assert.doesNotMatch(markup, /Scroll To Bottom/);
  assert.equal((markup.match(/data-conversation-minimap-control-slot/g) || []).length, 2);
});

test('conversation minimap control slots keep symmetric spacing around the minimap track', () => {
  assert.deepStrictEqual(getConversationMinimapControlSlotSx('top', true), {
    width: '2.5rem',
    height: '2.5rem',
    display: 'grid',
    placeItems: 'center',
    alignSelf: 'center',
    pointerEvents: 'auto',
  });

  assert.deepStrictEqual(getConversationMinimapControlSlotSx('bottom', true), {
    width: '2.5rem',
    height: '2.5rem',
    display: 'grid',
    placeItems: 'center',
    alignSelf: 'center',
    pointerEvents: 'auto',
  });

  assert.deepStrictEqual(getConversationMinimapControlSlotSx('top', false), {
    width: '2.5rem',
    height: '2.5rem',
    display: 'grid',
    placeItems: 'center',
    alignSelf: 'center',
    pointerEvents: 'none',
  });
});

test('conversation minimap root uses exactly three rows after removing the map label', () => {
  assert.deepStrictEqual(getConversationMinimapRootSx(320), {
    display: 'grid',
    gridTemplateRows: 'auto minmax(0, 1fr) auto',
    gap: 1,
    height: '320px',
    width: 'fit-content',
    marginLeft: 'auto',
    overflow: 'hidden',
    pointerEvents: 'none',
  });
});
