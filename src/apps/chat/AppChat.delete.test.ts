import assert from 'node:assert/strict';
import test from 'node:test';

import { getConversationToFocusAfterDeletion } from './AppChat.delete';

test('keeps the current focused chat when deleting a different chat from the drawer', () => {
  const result = getConversationToFocusAfterDeletion({
    deletedConversationIds: ['chat-b'],
    focusedConversationId: 'chat-a',
    nextConversationId: 'chat-c',
  });

  assert.equal(result, 'chat-a');
});

test('moves focus to the next conversation when the focused chat is deleted', () => {
  const result = getConversationToFocusAfterDeletion({
    deletedConversationIds: ['chat-a'],
    focusedConversationId: 'chat-a',
    nextConversationId: 'chat-c',
  });

  assert.equal(result, 'chat-c');
});

test('falls back to the next conversation when nothing is focused', () => {
  const result = getConversationToFocusAfterDeletion({
    deletedConversationIds: ['chat-b'],
    focusedConversationId: null,
    nextConversationId: 'chat-c',
  });

  assert.equal(result, 'chat-c');
});
