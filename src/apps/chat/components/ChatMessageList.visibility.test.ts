import assert from 'node:assert/strict';
import test from 'node:test';

import { createDMessageTextContent } from '~/common/stores/chat/chat.message';

import { getCouncilVisibleMessages } from './ChatMessageList.visibility';


test('system messages stay hidden unless system messages are enabled or explicitly marked for the council system channel', () => {
  const hiddenSystemMessage = createDMessageTextContent('system', 'Hidden system');
  hiddenSystemMessage.updated = hiddenSystemMessage.created;

  const visibleCouncilSystemMessage = createDMessageTextContent('system', 'Visible council system');
  visibleCouncilSystemMessage.updated = visibleCouncilSystemMessage.created;
  visibleCouncilSystemMessage.metadata = {
    councilChannel: { channel: 'system' },
  };

  const assistantMessage = createDMessageTextContent('assistant', 'Assistant');
  assistantMessage.updated = assistantMessage.created;

  assert.deepEqual(
    getCouncilVisibleMessages([hiddenSystemMessage, visibleCouncilSystemMessage, assistantMessage], false),
    [visibleCouncilSystemMessage, assistantMessage],
  );
  assert.deepEqual(
    getCouncilVisibleMessages([hiddenSystemMessage, visibleCouncilSystemMessage, assistantMessage], true),
    [hiddenSystemMessage, visibleCouncilSystemMessage, assistantMessage],
  );
});
