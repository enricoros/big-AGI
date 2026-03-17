import assert from 'node:assert/strict';
import test from 'node:test';

import type { DConversation } from './chat.conversation';
import { V4ToHeadConverters } from './chats.converters';


test('inMemHeadCleanDConversations restores required multi-agent defaults for persisted conversations', () => {
  const conversation = {
    id: 'conversation-1',
    systemPurposeId: 'Generic',
    userSymbol: 'Eros',
    messages: [],
    participants: [{
      kind: 'assistant',
      personaId: 'Developer',
      llmId: 'model-dev',
      speakWhen: 'something-else',
      customPrompt: 'Focus on implementation',
    }],
    turnTerminationMode: 'invalid-mode',
    tokenCount: 0,
    created: 1,
    updated: 2,
    _abortController: 'stale-controller',
  } as unknown as DConversation;

  V4ToHeadConverters.inMemHeadCleanDConversations([conversation]);

  assert.equal(conversation._abortController, null);
  assert.equal(conversation.turnTerminationMode, 'round-robin-per-human');
  assert.equal(conversation.participants?.length, 2);
  assert.equal(conversation.participants?.[0]?.kind, 'human');
  assert.equal(conversation.participants?.[0]?.name, 'Eros');
  assert.equal(conversation.participants?.[1]?.kind, 'assistant');
  assert.equal(conversation.participants?.[1]?.personaId, 'Developer');
  assert.equal(conversation.participants?.[1]?.name, 'Developer');
  assert.equal(conversation.participants?.[1]?.speakWhen, 'every-turn');
  assert.equal(conversation.participants?.[1]?.customPrompt, 'Focus on implementation');
});
