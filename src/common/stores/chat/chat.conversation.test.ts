import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createAssistantConversationParticipant,
  createDConversation,
  duplicateDConversation,
} from './chat.conversation';
import { createDMessageTextContent } from './chat.message';


test('createDConversation initializes the default multi-agent fields', () => {
  const conversation = createDConversation('Developer');

  assert.equal(conversation.turnTerminationMode, 'round-robin-per-human');
  assert.equal(conversation.participants?.length, 2);
  assert.equal(conversation.participants?.[0]?.kind, 'human');
  assert.equal(conversation.participants?.[1]?.kind, 'assistant');
  assert.equal(conversation.participants?.[1]?.personaId, 'Developer');
  assert.equal(conversation.participants?.[1]?.speakWhen, 'every-turn');
});

test('duplicateDConversation preserves participant settings without sharing references', () => {
  const conversation = createDConversation('Generic');
  conversation.turnTerminationMode = 'continuous';
  conversation.participants = [
    conversation.participants?.[0]!,
    createAssistantConversationParticipant('Developer', 'model-dev', 'Builder', 'when-mentioned'),
    createAssistantConversationParticipant('Designer', 'model-design', 'Stylist', 'every-turn'),
  ];
  conversation.messages = [createDMessageTextContent('user', 'Hello room')];

  const duplicated = duplicateDConversation(conversation, undefined, false);

  assert.equal(duplicated.turnTerminationMode, 'continuous');
  assert.deepEqual(duplicated.participants?.map(participant => ({
    id: participant.id,
    name: participant.name,
    speakWhen: participant.speakWhen,
    personaId: participant.personaId,
    llmId: participant.llmId,
  })), [
    {
      id: conversation.participants[0].id,
      name: conversation.participants[0].name,
      speakWhen: conversation.participants[0].speakWhen,
      personaId: conversation.participants[0].personaId,
      llmId: conversation.participants[0].llmId,
    },
    {
      id: conversation.participants[1].id,
      name: 'Builder',
      speakWhen: 'when-mentioned',
      personaId: 'Developer',
      llmId: 'model-dev',
    },
    {
      id: conversation.participants[2].id,
      name: 'Stylist',
      speakWhen: 'every-turn',
      personaId: 'Designer',
      llmId: 'model-design',
    },
  ]);

  assert.notEqual(duplicated.participants, conversation.participants);
  assert.notEqual(duplicated.participants?.[1], conversation.participants[1]);
});
