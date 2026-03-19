import assert from 'node:assert/strict';
import test from 'node:test';

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ChatPane } from './ChatPane';


function renderChatPaneMarkup(isMobile: boolean) {
  return renderToStaticMarkup(
    <ChatPane
      isMobile={isMobile}
      conversationId={null}
      disableItems={false}
      hasConversations={false}
      isMessageSelectionMode={false}
      isVerticalSplit={false}
      onConversationBranch={() => undefined}
      onConversationClear={() => undefined}
      onConversationFlatten={() => undefined}
      setIsMessageSelectionMode={() => undefined}
    />,
  );
}

test('chat pane shows the conversation minimap toggle only on desktop', () => {
  const desktopMarkup = renderChatPaneMarkup(false);
  assert.match(desktopMarkup, /Show Minimap/);

  const mobileMarkup = renderChatPaneMarkup(true);
  assert.doesNotMatch(mobileMarkup, /Show Minimap/);
});
