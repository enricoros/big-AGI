import assert from 'node:assert/strict';
import test from 'node:test';

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { createDMessageTextContent } from '~/common/stores/chat/chat.message';

import { ChatMessage } from './ChatMessage';


function renderChatMessageMarkup(updated: number | null) {
  const message = createDMessageTextContent('system', 'Council exhausted after 1 rounds.');
  message.created = 100;
  message.updated = updated;

  return renderToStaticMarkup(
    <ul>
      <ChatMessage
        message={message}
        fitScreen={false}
        isMobile={false}
        topDecoratorKind='system'
      />
    </ul>,
  );
}

test('system messages created with updated equal to created do not show the edited warning', () => {
  const markup = renderChatMessageMarkup(100);

  assert.match(markup, /System notification/);
  assert.doesNotMatch(markup, /Council notification/);
  assert.doesNotMatch(markup, /modified by user - auto-update disabled/);
});

test('system messages updated after creation still show the edited warning', () => {
  const markup = renderChatMessageMarkup(101);

  assert.match(markup, /modified by user - auto-update disabled/);
});
