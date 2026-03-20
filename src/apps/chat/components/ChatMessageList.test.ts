import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import type { DConversationParticipant } from '~/common/stores/chat/chat.conversation';

import { getRenderableConversationParticipants, getSingleAgentHumanDrivenParticipantNameOverrides } from './ChatMessageList';


test('getRenderableConversationParticipants preserves the original array when participants are already renderable', () => {
  const participants: DConversationParticipant[] = [
    { id: 'human', kind: 'human', name: 'You', personaId: null, llmId: null },
    { id: 'leader', kind: 'assistant', name: 'Leader', personaId: 'Custom', llmId: null, speakWhen: 'every-turn', isLeader: true },
    { id: 'reviewer', kind: 'assistant', name: 'Reviewer', personaId: 'Custom', llmId: null, speakWhen: 'when-mentioned' },
  ];

  const result = getRenderableConversationParticipants({
    conversationId: 'chat-1',
    participants,
    userSymbol: 'You',
    systemPurposeId: 'Custom',
  });

  assert.equal(result, participants);
});

test('getRenderableConversationParticipants normalizes assistant speakWhen and moves humans before assistants', () => {
  const participants: DConversationParticipant[] = [
    { id: 'leader', kind: 'assistant', name: 'Leader', personaId: 'Custom', llmId: null, isLeader: true },
    { id: 'human', kind: 'human', name: 'You', personaId: null, llmId: null },
  ];

  const result = getRenderableConversationParticipants({
    conversationId: 'chat-1',
    participants,
    userSymbol: 'You',
    systemPurposeId: 'Custom',
  });

  assert.notEqual(result, participants);
  assert.deepEqual(result.map(participant => `${participant.kind}:${participant.id}`), ['human:human', 'assistant:leader']);
  assert.equal(result[1]?.speakWhen, 'every-turn');
});

test('getRenderableConversationParticipants synthesizes fallback participants from conversation metadata', () => {
  const result = getRenderableConversationParticipants({
    conversationId: 'chat-42',
    participants: null,
    userSymbol: 'Eros',
    systemPurposeId: 'Developer',
  });

  assert.deepEqual(result, [
    {
      id: 'human:chat-42',
      kind: 'human',
      name: 'Eros',
      personaId: null,
      llmId: null,
    },
    {
      id: 'assistant:chat-42',
      kind: 'assistant',
      name: 'Developer',
      personaId: 'Developer',
      llmId: null,
      speakWhen: 'every-turn',
      isLeader: true,
    },
  ]);
});

test('chat message list keeps the floating desktop overlay active even when only the shared scroll arrows are shown', () => {
  const source = readFileSync(new URL('./ChatMessageList.tsx', import.meta.url), 'utf8');
  assert.match(source, /const conversationOverlayMode = getChatMessageListConversationOverlayMode\(/);
  assert.match(source, /conversationOverlayMode !== 'hidden'/);
  assert.match(source, /showTrack=\{showConversationMinimapTrack\}/);
});

test('single-agent human-driven chats display the active model name while keeping canonical mentions', () => {
  const participant: DConversationParticipant = {
    id: 'assistant-1',
    kind: 'assistant',
    name: 'Echo Kernel',
    personaId: 'Developer',
    llmId: 'openai-gpt-5.4',
    speakWhen: 'every-turn',
    isLeader: true,
  };

  const result = getSingleAgentHumanDrivenParticipantNameOverrides({
    participants: [participant],
    turnTerminationMode: 'round-robin-per-human',
    llmLabelsById: new Map([['openai-gpt-5.4', 'GPT 5.4']]),
    chatModelLabel: 'Chat model',
  });

  assert.equal(result.displayNamesById.get(participant.id), 'GPT 5.4');
  assert.equal(result.mentionNamesById.get(participant.id), 'Echo Kernel');
});
