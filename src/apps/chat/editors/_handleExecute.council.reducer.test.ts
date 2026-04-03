import assert from 'node:assert/strict';
import test from 'node:test';

import { createTextContentFragment } from '~/common/stores/chat/chat.fragments';

import { createCouncilOp } from './_handleExecute.council.log';
import { reduceCouncilOps, replayCouncilOpLog } from './_handleExecute.council.reducer';


function createBaseOps() {
  const ops = [
    createCouncilOp([], 'session_started', {
      leaderParticipantId: 'leader',
      reviewerParticipantIds: ['critic', 'writer'],
      maxRounds: 2,
    }, {
      phaseId: 'phase-1',
      conversationId: 'conversation-1',
      opId: 'session-started',
      createdAt: 100,
    }),
  ];

  return {
    ops,
    next: <T extends Parameters<typeof createCouncilOp>[1]>(
      type: T,
      payload: Parameters<typeof createCouncilOp<T>>[2],
      meta: Omit<NonNullable<Parameters<typeof createCouncilOp<T>>[3]>, 'phaseId' | 'conversationId'>,
    ) => {
      const nextOp = createCouncilOp(ops, type, payload, {
        phaseId: 'phase-1',
        conversationId: 'conversation-1',
        ...meta,
      });
      ops.push(nextOp);
      return nextOp;
    },
  };
}

test('reduceCouncilOps rebuilds an accepted session from committed ops', () => {
  const { ops, next } = createBaseOps();
  next('leader_turn_committed', {
    roundIndex: 0,
    participantId: 'leader',
    proposalId: 'proposal-1',
    proposalText: 'Approved proposal',
    deliberationText: 'Checked the scope first.',
    messageFragments: [createTextContentFragment('Approved proposal')],
    messagePendingIncomplete: false,
  }, { opId: 'leader-0', createdAt: 101 });
  next('reviewer_plan_committed', {
    roundIndex: 0,
    participantId: 'critic',
    planText: 'Verify the logic.',
    messageFragments: [createTextContentFragment('Verify the logic.')],
    messagePendingIncomplete: false,
  }, { opId: 'plan-critic', createdAt: 102 });
  next('reviewer_plan_committed', {
    roundIndex: 0,
    participantId: 'writer',
    planText: 'Verify the wording.',
    messageFragments: [createTextContentFragment('Verify the wording.')],
    messagePendingIncomplete: false,
  }, { opId: 'plan-writer', createdAt: 103 });
  next('reviewer_vote_committed', {
    roundIndex: 0,
    participantId: 'critic',
    decision: 'accept',
    reason: null,
    fragmentTexts: [],
    messageFragments: [],
    messagePendingIncomplete: false,
  }, { opId: 'vote-critic', createdAt: 104 });
  next('reviewer_vote_committed', {
    roundIndex: 0,
    participantId: 'writer',
    decision: 'accept',
    reason: null,
    fragmentTexts: [],
    messageFragments: [],
    messagePendingIncomplete: false,
  }, { opId: 'vote-writer', createdAt: 105 });
  next('round_completed', {
    roundIndex: 0,
    outcome: 'accepted',
    rejectionReasons: [],
  }, { opId: 'round-complete', createdAt: 106 });
  next('session_accepted', {
    roundIndex: 0,
    proposalId: 'proposal-1',
    finalResponse: 'Approved proposal',
  }, { opId: 'session-accepted', createdAt: 107 });

  const projection = reduceCouncilOps(ops);
  assert.ok(projection);
  assert.equal(projection?.status, 'accepted');
  assert.equal(projection?.finalResponse, 'Approved proposal');
  assert.equal(projection?.rounds[0]?.reviewerVotes.critic?.ballot.decision, 'accept');
});

test('replayCouncilOpLog marks paused sessions as resumable', () => {
  const { ops, next } = createBaseOps();
  next('leader_turn_committed', {
    roundIndex: 0,
    participantId: 'leader',
    proposalId: 'proposal-1',
    proposalText: 'Draft one.',
    deliberationText: '',
    messageFragments: [createTextContentFragment('Draft one.')],
    messagePendingIncomplete: false,
  }, { opId: 'leader-0', createdAt: 101 });
  next('reviewer_plan_committed', {
    roundIndex: 0,
    participantId: 'critic',
    planText: 'Check the claim.',
    messageFragments: [createTextContentFragment('Check the claim.')],
    messagePendingIncomplete: false,
  }, { opId: 'plan-critic', createdAt: 102 });
  next('session_paused', {
    reason: '@pause',
  }, { opId: 'paused', createdAt: 103 });

  const replay = replayCouncilOpLog(ops);
  assert.equal(replay.canResume, true);
  assert.equal(replay.persistedStatus, 'paused');
  assert.equal(replay.interruptionReason, '@pause');
  assert.equal(replay.workflowState?.status, 'interrupted');
});

test('replayCouncilOpLog resumes user-stopped sessions', () => {
  const { ops, next } = createBaseOps();
  next('leader_turn_committed', {
    roundIndex: 0,
    participantId: 'leader',
    proposalId: 'proposal-1',
    proposalText: 'Draft one.',
    deliberationText: '',
    messageFragments: [createTextContentFragment('Draft one.')],
    messagePendingIncomplete: false,
  }, { opId: 'leader-0', createdAt: 101 });
  next('session_stopped', {
    reason: '@stop',
  }, { opId: 'stopped', createdAt: 102 });

  const replay = replayCouncilOpLog(ops);
  assert.equal(replay.canResume, true);
  assert.equal(replay.persistedStatus, 'stopped');
  assert.equal(replay.workflowState?.status, 'interrupted');
  assert.equal(replay.interruptionReason, '@stop');
});

test('replayCouncilOpLog keeps fatal stopped sessions resumable for council recovery', () => {
  const { ops, next } = createBaseOps();
  next('leader_turn_committed', {
    roundIndex: 0,
    participantId: 'leader',
    proposalId: 'proposal-1',
    proposalText: 'Draft one.',
    deliberationText: '',
    messageFragments: [createTextContentFragment('Draft one.')],
    messagePendingIncomplete: false,
  }, { opId: 'leader-0', createdAt: 101 });
  next('session_stopped', {
    reason: 'leader-invalid-proposal',
  }, { opId: 'stopped', createdAt: 102 });

  const replay = replayCouncilOpLog(ops);
  assert.equal(replay.canResume, true);
  assert.equal(replay.persistedStatus, 'stopped');
  assert.equal(replay.workflowState?.status, 'interrupted');
  assert.equal(replay.interruptionReason, 'leader-invalid-proposal');
});

test('replayCouncilOpLog ignores malformed persisted op logs instead of throwing', () => {
  const { ops, next } = createBaseOps();
  next('leader_turn_committed', {
    roundIndex: 1,
    participantId: 'leader',
    proposalId: 'proposal-invalid',
    proposalText: 'Out of order proposal.',
    deliberationText: '',
    messageFragments: [createTextContentFragment('Out of order proposal.')],
    messagePendingIncomplete: false,
  }, { opId: 'leader-invalid', createdAt: 101 });

  const replay = replayCouncilOpLog(ops);
  assert.equal(replay.workflowState, null);
  assert.equal(replay.canResume, false);
  assert.equal(replay.phaseId, 'phase-1');
});

test('reduceCouncilOps rebuilds exhausted sessions after a rejected final round', () => {
  const ops = [
    createCouncilOp([], 'session_started', {
      leaderParticipantId: 'leader',
      reviewerParticipantIds: ['critic'],
      maxRounds: 1,
    }, {
      phaseId: 'phase-2',
      conversationId: 'conversation-2',
      opId: 'session-started',
      createdAt: 200,
    }),
  ];
  const push = <T extends Parameters<typeof createCouncilOp>[1]>(
    type: T,
    payload: Parameters<typeof createCouncilOp<T>>[2],
    meta: Omit<NonNullable<Parameters<typeof createCouncilOp<T>>[3]>, 'phaseId' | 'conversationId'>,
  ) => {
    ops.push(createCouncilOp(ops, type, payload, {
      phaseId: 'phase-2',
      conversationId: 'conversation-2',
      ...meta,
    }));
  };

  push('leader_turn_committed', {
    roundIndex: 0,
    participantId: 'leader',
    proposalId: 'proposal-1',
    proposalText: 'Draft one.',
    deliberationText: '',
    messageFragments: [createTextContentFragment('Draft one.')],
    messagePendingIncomplete: false,
  }, { opId: 'leader-0', createdAt: 201 });
  push('reviewer_plan_committed', {
    roundIndex: 0,
    participantId: 'critic',
    planText: 'Find the missing caveat.',
    messageFragments: [createTextContentFragment('Find the missing caveat.')],
    messagePendingIncomplete: false,
  }, { opId: 'plan-critic', createdAt: 202 });
  push('reviewer_vote_committed', {
    roundIndex: 0,
    participantId: 'critic',
    decision: 'reject',
    reason: 'Missing the caveat.',
    fragmentTexts: [],
    messageFragments: [],
    messagePendingIncomplete: false,
  }, { opId: 'vote-critic', createdAt: 203 });
  push('round_completed', {
    roundIndex: 0,
    outcome: 'revise',
    rejectionReasons: ['Missing the caveat.'],
  }, { opId: 'round-complete', createdAt: 204 });
  push('session_exhausted', {
    roundIndex: 0,
  }, { opId: 'session-exhausted', createdAt: 205 });

  const projection = reduceCouncilOps(ops);
  assert.ok(projection);
  assert.equal(projection?.status, 'exhausted');
  assert.equal(projection?.rounds[0]?.ballots[0]?.reason, 'Missing the caveat.');
});

test('reduceCouncilOps materializes replay rounds that start before their full history is available', () => {
  const { ops, next } = createBaseOps();
  next('round_started', {
    roundIndex: 1,
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    sharedRejectionReasons: ['Missing the caveat.'],
  }, { opId: 'round-1-started', createdAt: 101 });
  next('leader_turn_committed', {
    roundIndex: 1,
    participantId: 'leader',
    proposalId: 'proposal-2',
    proposalText: 'Draft two.',
    deliberationText: '',
    messageFragments: [createTextContentFragment('Draft two.')],
    messagePendingIncomplete: false,
  }, { opId: 'leader-1', createdAt: 102 });
  next('reviewer_vote_committed', {
    roundIndex: 1,
    participantId: 'critic',
    decision: 'accept',
    reason: null,
    fragmentTexts: [],
    messageFragments: [],
    messagePendingIncomplete: false,
  }, { opId: 'vote-critic-1', createdAt: 103 });
  next('reviewer_vote_committed', {
    roundIndex: 1,
    participantId: 'writer',
    decision: 'accept',
    reason: null,
    fragmentTexts: [],
    messageFragments: [],
    messagePendingIncomplete: false,
  }, { opId: 'vote-writer-1', createdAt: 104 });
  next('round_completed', {
    roundIndex: 1,
    outcome: 'accepted',
    rejectionReasons: [],
  }, { opId: 'round-1-complete', createdAt: 105 });
  next('session_accepted', {
    roundIndex: 1,
    proposalId: 'proposal-2',
    finalResponse: 'Draft two.',
  }, { opId: 'session-accepted-1', createdAt: 106 });

  const projection = reduceCouncilOps(ops);
  assert.ok(projection);
  assert.equal(projection?.status, 'accepted');
  assert.equal(projection?.roundIndex, 1);
  assert.equal(projection?.rounds[1]?.sharedRejectionReasons[0], 'Missing the caveat.');
  assert.equal(projection?.rounds[1]?.proposalText, 'Draft two.');
});

test('reduceCouncilOps ignores duplicate op ids', () => {
  const { ops, next } = createBaseOps();
  const planOp = next('reviewer_plan_committed', {
    roundIndex: 0,
    participantId: 'critic',
    planText: 'Check the claim.',
    messageFragments: [createTextContentFragment('Check the claim.')],
    messagePendingIncomplete: false,
  }, { opId: 'duplicate-plan', createdAt: 101 });
  ops.push(structuredClone(planOp));

  const projection = reduceCouncilOps(ops);
  assert.ok(projection);
  assert.equal(Object.keys(projection?.rounds[0]?.reviewerPlans ?? {}).length, 1);
});

test('reduceCouncilOps rejects invalid op ordering', () => {
  const invalidOps = [
    createCouncilOp([], 'leader_turn_committed', {
      roundIndex: 0,
      participantId: 'leader',
      proposalId: 'proposal-1',
      proposalText: 'Draft one.',
      deliberationText: '',
      messageFragments: [],
      messagePendingIncomplete: false,
    }, {
      phaseId: 'phase-invalid',
      conversationId: 'conversation-invalid',
      opId: 'invalid',
      createdAt: 999,
    }),
  ];

  assert.throws(() => reduceCouncilOps(invalidOps), /session_started/i);
});
