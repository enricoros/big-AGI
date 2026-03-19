import assert from 'node:assert/strict';
import test from 'node:test';

import { createTextContentFragment } from '~/common/stores/chat/chat.fragments';
import { createDConversation, duplicateDConversation } from '~/common/stores/chat/chat.conversation';

import { appendCouncilOps, createCouncilOp } from './_handleExecute.council.log';


test('createCouncilOp appends monotonic sequence and preserves payload', () => {
  const existing = [
    createCouncilOp([], 'session_started', {
      leaderParticipantId: 'leader',
      reviewerParticipantIds: ['critic'],
      maxRounds: 2,
    }, {
      phaseId: 'phase-1',
      conversationId: 'conversation-1',
      opId: 'op-0',
      createdAt: 100,
    }),
  ];

  const op = createCouncilOp(existing, 'leader_turn_committed', {
    roundIndex: 0,
    participantId: 'leader',
    proposalId: 'proposal-1',
    proposalText: 'Draft one.',
    deliberationText: 'Check the edge cases first.',
    messageFragments: [createTextContentFragment('Draft one.')],
    messagePendingIncomplete: false,
  }, {
    phaseId: 'phase-1',
    conversationId: 'conversation-1',
    createdAt: 101,
  });

  assert.equal(op.sequence, 1);
  assert.equal(op.type, 'leader_turn_committed');
  assert.equal(op.payload.roundIndex, 0);
  assert.equal(op.payload.proposalText, 'Draft one.');
});

test('appendCouncilOps ignores duplicate op ids', () => {
  const sessionStarted = createCouncilOp([], 'session_started', {
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic'],
    maxRounds: 2,
  }, {
    phaseId: 'phase-1',
    conversationId: 'conversation-1',
    opId: 'op-0',
    createdAt: 100,
  });

  const leaderCommitted = createCouncilOp([sessionStarted], 'leader_turn_committed', {
    roundIndex: 0,
    participantId: 'leader',
    proposalId: 'proposal-1',
    proposalText: 'Draft one.',
    deliberationText: '',
    messageFragments: [createTextContentFragment('Draft one.')],
    messagePendingIncomplete: false,
  }, {
    phaseId: 'phase-1',
    conversationId: 'conversation-1',
    opId: 'op-1',
    createdAt: 101,
  });

  const merged = appendCouncilOps([sessionStarted], [leaderCommitted, leaderCommitted]);
  assert.equal(merged.length, 2);
  assert.deepEqual(merged.map(op => op.opId), ['op-0', 'op-1']);
});

test('duplicateDConversation preserves councilOpLog', () => {
  const conversation = createDConversation('Developer');
  conversation.councilOpLog = [
    createCouncilOp([], 'session_started', {
      leaderParticipantId: 'leader',
      reviewerParticipantIds: ['critic', 'writer'],
      maxRounds: 4,
    }, {
      phaseId: 'phase-branch',
      conversationId: conversation.id,
      opId: 'op-start',
      createdAt: 200,
    }),
  ];

  const duplicated = duplicateDConversation(conversation, undefined, false);

  assert.equal(duplicated.councilOpLog?.length, 1);
  assert.notEqual(duplicated.councilOpLog, conversation.councilOpLog);
  assert.equal(duplicated.councilOpLog?.[0]?.type, 'session_started');
});
