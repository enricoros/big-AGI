import assert from 'node:assert/strict';
import test from 'node:test';

import { getChatShowConversationMinimap, setChatShowConversationMinimap } from './store-app-chat';


test('conversation minimap visibility can be toggled through the chat ui store helpers', () => {
  setChatShowConversationMinimap(false);
  assert.equal(getChatShowConversationMinimap(), false);

  setChatShowConversationMinimap(true);
  assert.equal(getChatShowConversationMinimap(), true);

  setChatShowConversationMinimap(false);
  assert.equal(getChatShowConversationMinimap(), false);
});
