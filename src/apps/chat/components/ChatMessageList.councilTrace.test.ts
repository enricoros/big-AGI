import assert from 'node:assert/strict';
import test from 'node:test';

import type { DConversationParticipant } from '~/common/stores/chat/chat.conversation';
import { createDMessageTextContent } from '~/common/stores/chat/chat.message';
import { createIdleCouncilSessionState } from '~/common/chat-overlay/store-perchat-composer_slice';
import {
  applyCouncilReviewBallots,
  createCouncilSessionState,
  recordCouncilProposal,
} from '../editors/_handleExecute.consensus';

import { buildCouncilTraceRenderPlan } from './ChatMessageList.councilTrace';


const participants: DConversationParticipant[] = [
  { id: 'human', kind: 'human', name: 'You', personaId: null, llmId: null },
  { id: 'leader', kind: 'assistant', name: 'Leader', personaId: 'Custom', llmId: null, speakWhen: 'every-turn', isLeader: true },
  { id: 'critic', kind: 'assistant', name: 'Critic', personaId: 'Custom', llmId: null, speakWhen: 'every-turn' },
  { id: 'writer', kind: 'assistant', name: 'Writer', personaId: 'Custom', llmId: null, speakWhen: 'every-turn' },
];

function createCouncilMessage(params: {
  id: string;
  text: string;
  kind: 'deliberation' | 'result';
  action?: 'proposal' | 'accept' | 'reject';
  authorParticipantId: string;
  phaseId?: string;
  passIndex?: number;
  reason?: string;
}) {
  const message = createDMessageTextContent('assistant', params.text);
  message.id = params.id;
  message.created = 100;
  message.updated = 100;
  message.metadata = {
    author: {
      participantId: params.authorParticipantId,
      participantName: participants.find(participant => participant.id === params.authorParticipantId)?.name,
    },
    consensus: {
      kind: params.kind,
      phaseId: params.phaseId ?? 'phase-1',
      passIndex: params.passIndex ?? 0,
      action: params.action,
      reason: params.reason,
      leaderParticipantId: 'leader',
    },
  };
  return message;
}

test('accepted council workflow inserts a trace item immediately before the final result', () => {
  let workflowState = createCouncilSessionState({
    phaseId: 'phase-1',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 4,
  });

  workflowState = recordCouncilProposal(workflowState, {
    proposalId: 'proposal-1',
    leaderParticipantId: 'leader',
    proposalText: 'Round one proposal.',
  });

  workflowState = applyCouncilReviewBallots(workflowState, [
    { reviewerParticipantId: 'critic', decision: 'reject', reason: 'Needs a caveat.' },
    { reviewerParticipantId: 'writer', decision: 'accept' },
  ]);

  workflowState = recordCouncilProposal(workflowState, {
    proposalId: 'proposal-2',
    leaderParticipantId: 'leader',
    proposalText: 'Round two proposal.',
  });

  workflowState = applyCouncilReviewBallots(workflowState, [
    { reviewerParticipantId: 'critic', decision: 'accept' },
    { reviewerParticipantId: 'writer', decision: 'accept' },
  ]);

  const traceItem = buildCouncilTraceRenderPlan({
    messages: [
      createCouncilMessage({ id: 'proposal-1', text: 'Round one proposal.', kind: 'deliberation', action: 'proposal', authorParticipantId: 'leader', passIndex: 0 }),
      createCouncilMessage({ id: 'proposal-2', text: 'Round two proposal.', kind: 'deliberation', action: 'proposal', authorParticipantId: 'leader', passIndex: 1 }),
      createCouncilMessage({ id: 'result-1', text: 'Round two proposal.', kind: 'result', authorParticipantId: 'leader', passIndex: 1 }),
    ],
    participants,
    councilSession: {
      ...createIdleCouncilSessionState(),
      status: 'completed',
      phaseId: 'phase-1',
      passIndex: 1,
      workflowState,
      canResume: true,
      updatedAt: 100,
    },
  }).traceItem;

  assert.ok(traceItem);
  assert.deepEqual(traceItem.placement, {
    mode: 'before-message',
    anchorMessageId: 'result-1',
  });
  assert.equal(traceItem.rounds.length, 2);
  assert.equal(traceItem.rounds[0]?.roundIndex, 1);
  assert.equal(traceItem.rounds[0]?.defaultExpanded, true);
  assert.equal(traceItem.rounds[1]?.roundIndex, 0);
  assert.equal(traceItem.rounds[1]?.defaultExpanded, false);
});

test('interrupted council workflow anchors the trace after the current phase when no final result exists', () => {
  let workflowState = createCouncilSessionState({
    phaseId: 'phase-1',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 4,
  });

  workflowState = recordCouncilProposal(workflowState, {
    proposalId: 'proposal-1',
    leaderParticipantId: 'leader',
    proposalText: 'Round one proposal.',
  });

  workflowState = applyCouncilReviewBallots(workflowState, [
    { reviewerParticipantId: 'critic', decision: 'reject', reason: 'Needs a caveat.' },
    { reviewerParticipantId: 'writer', decision: 'accept' },
  ]);

  const traceItem = buildCouncilTraceRenderPlan({
    messages: [
      createCouncilMessage({ id: 'proposal-1', text: 'Round one proposal.', kind: 'deliberation', action: 'proposal', authorParticipantId: 'leader', passIndex: 0 }),
    ],
    participants,
    councilSession: {
      ...createIdleCouncilSessionState(),
      status: 'interrupted',
      phaseId: 'phase-1',
      passIndex: 1,
      workflowState,
      canResume: true,
      updatedAt: 100,
    },
  }).traceItem;

  assert.ok(traceItem);
  assert.deepEqual(traceItem.placement, {
    mode: 'after-phase',
    phaseId: 'phase-1',
  });
});

test('exhausted council workflow anchors the trace after the current phase when no final result exists', () => {
  let workflowState = createCouncilSessionState({
    phaseId: 'phase-exhausted',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 1,
  });

  workflowState = recordCouncilProposal(workflowState, {
    proposalId: 'proposal-exhausted-1',
    leaderParticipantId: 'leader',
    proposalText: 'Final attempt proposal.',
  });

  workflowState = applyCouncilReviewBallots(workflowState, [
    { reviewerParticipantId: 'critic', decision: 'reject', reason: 'Still missing a caveat.' },
    { reviewerParticipantId: 'writer', decision: 'accept' },
  ]);

  const traceItem = buildCouncilTraceRenderPlan({
    messages: [
      createCouncilMessage({ id: 'proposal-exhausted-1', text: 'Final attempt proposal.', kind: 'deliberation', action: 'proposal', authorParticipantId: 'leader', phaseId: 'phase-exhausted', passIndex: 0 }),
    ],
    participants,
    councilSession: {
      ...createIdleCouncilSessionState(),
      status: 'stopped',
      phaseId: 'phase-exhausted',
      passIndex: 0,
      workflowState,
      canResume: false,
      updatedAt: 100,
    },
  }).traceItem;

  assert.ok(traceItem);
  assert.deepEqual(traceItem.placement, {
    mode: 'after-phase',
    phaseId: 'phase-exhausted',
  });
});

test('workflow state absence omits the council trace entirely', () => {
  const traceItem = buildCouncilTraceRenderPlan({
    messages: [],
    participants,
    councilSession: createIdleCouncilSessionState(),
  }).traceItem;

  assert.equal(traceItem, null);
});

test('shared rejection reason labels reflect whether the round feeds a next round, waits for one, or terminates', () => {
  let sharedWorkflow = createCouncilSessionState({
    phaseId: 'phase-shared',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 4,
  });
  sharedWorkflow = recordCouncilProposal(sharedWorkflow, {
    proposalId: 'shared-proposal-1',
    leaderParticipantId: 'leader',
    proposalText: 'Shared round one.',
  });
  sharedWorkflow = applyCouncilReviewBallots(sharedWorkflow, [
    { reviewerParticipantId: 'critic', decision: 'reject', reason: 'Shared reason.' },
    { reviewerParticipantId: 'writer', decision: 'accept' },
  ]);
  sharedWorkflow = recordCouncilProposal(sharedWorkflow, {
    proposalId: 'shared-proposal-2',
    leaderParticipantId: 'leader',
    proposalText: 'Shared round two.',
  });

  const sharedTrace = buildCouncilTraceRenderPlan({
    messages: [
      createCouncilMessage({ id: 'shared-proposal-1', text: 'Shared round one.', kind: 'deliberation', action: 'proposal', authorParticipantId: 'leader', phaseId: 'phase-shared', passIndex: 0 }),
      createCouncilMessage({ id: 'shared-proposal-2', text: 'Shared round two.', kind: 'deliberation', action: 'proposal', authorParticipantId: 'leader', phaseId: 'phase-shared', passIndex: 1 }),
    ],
    participants,
    councilSession: {
      ...createIdleCouncilSessionState(),
      status: 'running',
      phaseId: 'phase-shared',
      passIndex: 1,
      workflowState: sharedWorkflow,
      canResume: true,
      updatedAt: 100,
    },
  }).traceItem;

  assert.equal(sharedTrace?.rounds[1]?.sharedReasons?.label, 'Shared with next round');

  let queuedWorkflow = createCouncilSessionState({
    phaseId: 'phase-queued',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 4,
  });
  queuedWorkflow = recordCouncilProposal(queuedWorkflow, {
    proposalId: 'queued-proposal-1',
    leaderParticipantId: 'leader',
    proposalText: 'Queued round one.',
  });
  queuedWorkflow = applyCouncilReviewBallots(queuedWorkflow, [
    { reviewerParticipantId: 'critic', decision: 'reject', reason: 'Queued reason.' },
    { reviewerParticipantId: 'writer', decision: 'accept' },
  ]);

  const queuedTrace = buildCouncilTraceRenderPlan({
    messages: [
      createCouncilMessage({ id: 'queued-proposal-1', text: 'Queued round one.', kind: 'deliberation', action: 'proposal', authorParticipantId: 'leader', phaseId: 'phase-queued', passIndex: 0 }),
    ],
    participants,
    councilSession: {
      ...createIdleCouncilSessionState(),
      status: 'interrupted',
      phaseId: 'phase-queued',
      passIndex: 1,
      workflowState: queuedWorkflow,
      canResume: true,
      updatedAt: 100,
    },
  }).traceItem;

  assert.equal(queuedTrace?.rounds[1]?.sharedReasons?.label, 'Queued for next round');

  let finalWorkflow = createCouncilSessionState({
    phaseId: 'phase-final',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 1,
  });
  finalWorkflow = recordCouncilProposal(finalWorkflow, {
    proposalId: 'final-proposal-1',
    leaderParticipantId: 'leader',
    proposalText: 'Final round one.',
  });
  finalWorkflow = applyCouncilReviewBallots(finalWorkflow, [
    { reviewerParticipantId: 'critic', decision: 'reject', reason: 'Final reason.' },
    { reviewerParticipantId: 'writer', decision: 'accept' },
  ]);

  const finalTrace = buildCouncilTraceRenderPlan({
    messages: [
      createCouncilMessage({ id: 'final-proposal-1', text: 'Final round one.', kind: 'deliberation', action: 'proposal', authorParticipantId: 'leader', phaseId: 'phase-final', passIndex: 0 }),
    ],
    participants,
    councilSession: {
      ...createIdleCouncilSessionState(),
      status: 'stopped',
      phaseId: 'phase-final',
      passIndex: 0,
      workflowState: finalWorkflow,
      canResume: false,
      updatedAt: 100,
    },
  }).traceItem;

  assert.equal(finalTrace?.rounds[0]?.sharedReasons?.label, 'Final rejection reasons');
});

test('reviewer cards follow reviewer participant order and preserve verbatim rejection reasons', () => {
  let workflowState = createCouncilSessionState({
    phaseId: 'phase-1',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['writer', 'critic'],
    maxRounds: 4,
  });

  workflowState = recordCouncilProposal(workflowState, {
    proposalId: 'proposal-1',
    leaderParticipantId: 'leader',
    proposalText: 'Round one proposal.',
  });

  workflowState = applyCouncilReviewBallots(workflowState, [
    { reviewerParticipantId: 'critic', decision: 'reject', reason: 'Use the exact caveat.' },
    { reviewerParticipantId: 'writer', decision: 'accept' },
  ]);

  const traceItem = buildCouncilTraceRenderPlan({
    messages: [
      createCouncilMessage({ id: 'proposal-1', text: 'Round one proposal.', kind: 'deliberation', action: 'proposal', authorParticipantId: 'leader', passIndex: 0 }),
    ],
    participants,
    councilSession: {
      ...createIdleCouncilSessionState(),
      status: 'running',
      phaseId: 'phase-1',
      passIndex: 1,
      workflowState,
      canResume: true,
      updatedAt: 100,
    },
  }).traceItem;

  assert.deepEqual(traceItem?.rounds[1]?.reviewerCards.map(card => ({
    participantId: card.participantId,
    decision: card.decision,
    reason: card.reason,
  })), [
    { participantId: 'writer', decision: 'accept', reason: null },
    { participantId: 'critic', decision: 'reject', reason: 'Use the exact caveat.' },
  ]);
  assert.deepEqual(traceItem?.rounds[0]?.reviewerCards, []);
});
