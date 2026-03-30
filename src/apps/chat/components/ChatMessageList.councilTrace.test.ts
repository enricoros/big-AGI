import assert from 'node:assert/strict';
import test from 'node:test';

import type { DConversationParticipant } from '~/common/stores/chat/chat.conversation';
import {
  createErrorContentFragment,
  createModelAuxVoidFragment,
  createTextContentFragment,
  create_FunctionCallInvocation_ContentFragment,
} from '~/common/stores/chat/chat.fragments';
import { createDMessageTextContent } from '~/common/stores/chat/chat.message';
import { createIdleCouncilSessionState } from '~/common/chat-overlay/store-perchat-composer_slice';
import {
  applyCouncilReviewBallots,
  appendCouncilAgentTurnEvent,
  COUNCIL_REVIEW_ANALYSIS_MISSING_REASON,
  COUNCIL_REVIEW_FAILED_REASON,
  COUNCIL_REVIEW_VERDICT_MISSING_REASON,
  createCouncilSessionState,
  recordCouncilAgentMessageSnapshot,
  recordCouncilProposal,
  recordCouncilReviewerPlan,
  recordCouncilReviewerTurn,
  recordCouncilReviewerVote,
} from '../editors/_handleExecute.council';

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
    council: {
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
  assert.equal(traceItem.rounds[0]?.roundIndex, 0);
  assert.equal(traceItem.rounds[0]?.defaultExpanded, false);
  assert.equal(traceItem.rounds[1]?.roundIndex, 1);
  assert.equal(traceItem.rounds[1]?.defaultExpanded, true);
});

test('council trace uses the current chat model label for participants inheriting the chat model', () => {
  let workflowState = createCouncilSessionState({
    phaseId: 'phase-chat-model',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 2,
  });

  workflowState = recordCouncilProposal(workflowState, {
    proposalId: 'proposal-chat-model',
    leaderParticipantId: 'leader',
    proposalText: 'Proposal using inherited chat model.',
  });

  workflowState = applyCouncilReviewBallots(workflowState, [
    { reviewerParticipantId: 'critic', decision: 'accept' },
    { reviewerParticipantId: 'writer', decision: 'accept' },
  ]);

  const traceItem = buildCouncilTraceRenderPlan({
    messages: [
      createCouncilMessage({ id: 'proposal-chat-model', text: 'Proposal using inherited chat model.', kind: 'deliberation', action: 'proposal', authorParticipantId: 'leader', phaseId: 'phase-chat-model', passIndex: 0 }),
      createCouncilMessage({ id: 'result-chat-model', text: 'Proposal using inherited chat model.', kind: 'result', authorParticipantId: 'leader', phaseId: 'phase-chat-model', passIndex: 0 }),
    ],
    participants,
    chatModelLabel: 'GPT 5.4 mini',
    councilSession: {
      ...createIdleCouncilSessionState(),
      status: 'completed',
      phaseId: 'phase-chat-model',
      passIndex: 0,
      workflowState,
      canResume: true,
      updatedAt: 100,
    },
  }).traceItem;

  assert.ok(traceItem);
  assert.equal(traceItem.rounds[0]?.leaderCard.participantModelLabel, 'GPT 5.4 mini');
  assert.equal(traceItem.rounds[0]?.reviewerCards[1]?.participantModelLabel, 'GPT 5.4 mini');
});

test('council trace round expansion defaults follow the configured auto-collapse and auto-expand settings', () => {
  let workflowState = createCouncilSessionState({
    phaseId: 'phase-prefs',
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

  const traceItem = buildCouncilTraceRenderPlan({
    messages: [
      createCouncilMessage({ id: 'proposal-1', text: 'Round one proposal.', kind: 'deliberation', action: 'proposal', authorParticipantId: 'leader', phaseId: 'phase-prefs', passIndex: 0 }),
      createCouncilMessage({ id: 'proposal-2', text: 'Round two proposal.', kind: 'deliberation', action: 'proposal', authorParticipantId: 'leader', phaseId: 'phase-prefs', passIndex: 1 }),
    ],
    participants,
    councilSession: {
      ...createIdleCouncilSessionState(),
      status: 'running',
      phaseId: 'phase-prefs',
      passIndex: 1,
      workflowState,
      canResume: true,
      updatedAt: 100,
    },
    autoCollapsePreviousRounds: false,
    autoExpandNewestRound: false,
  }).traceItem;

  assert.equal(traceItem?.rounds[0]?.defaultExpanded, true);
  assert.equal(traceItem?.rounds[1]?.defaultExpanded, false);
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
  const plan = buildCouncilTraceRenderPlan({
    messages: [],
    participants,
    councilSession: createIdleCouncilSessionState(),
  });

  assert.equal(plan.traceItem, null);
  assert.equal(plan.showLegacyDeliberationToggle, true);
});

test('historical accepted council trace is reconstructed from persisted messages even when the live council session is idle', () => {
  const plan = buildCouncilTraceRenderPlan({
    messages: [
      createCouncilMessage({ id: 'proposal-old', text: 'Old council proposal.', kind: 'deliberation', action: 'proposal', authorParticipantId: 'leader', phaseId: 'phase-old', passIndex: 0 }),
      createCouncilMessage({ id: 'critic-old', text: 'Accept', kind: 'deliberation', action: 'accept', authorParticipantId: 'critic', phaseId: 'phase-old', passIndex: 0 }),
      createCouncilMessage({ id: 'writer-old', text: 'Accept', kind: 'deliberation', action: 'accept', authorParticipantId: 'writer', phaseId: 'phase-old', passIndex: 0 }),
      createCouncilMessage({ id: 'result-old', text: 'Old council proposal.', kind: 'result', authorParticipantId: 'leader', phaseId: 'phase-old', passIndex: 0 }),
      createDMessageTextContent('user', 'A newer user turn should not delete the old council trace.'),
    ],
    participants,
    councilSession: createIdleCouncilSessionState(),
  });

  assert.ok(plan.traceItem);
  assert.equal(plan.traceItem?.phaseId, 'phase-old');
  assert.equal(plan.traceItem?.summaryStatus, 'accepted');
  assert.deepEqual(plan.traceItem?.placement, {
    mode: 'before-message',
    anchorMessageId: 'result-old',
  });
  assert.equal(plan.showLegacyDeliberationToggle, false);
});

test('shared improvement reason labels reflect whether the round feeds a next round, waits for one, or terminates', () => {
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

  assert.equal(sharedTrace?.rounds[0]?.sharedReasons?.label, 'Shared with next round');

  let draftingWorkflow = createCouncilSessionState({
    phaseId: 'phase-drafting',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 4,
  });
  draftingWorkflow = recordCouncilProposal(draftingWorkflow, {
    proposalId: 'drafting-proposal-1',
    leaderParticipantId: 'leader',
    proposalText: 'Drafting round one.',
  });
  draftingWorkflow = applyCouncilReviewBallots(draftingWorkflow, [
    { reviewerParticipantId: 'critic', decision: 'reject', reason: 'Drafting reason.' },
    { reviewerParticipantId: 'writer', decision: 'accept' },
  ]);

  const draftingTrace = buildCouncilTraceRenderPlan({
    messages: [
      createCouncilMessage({ id: 'drafting-proposal-1', text: 'Drafting round one.', kind: 'deliberation', action: 'proposal', authorParticipantId: 'leader', phaseId: 'phase-drafting', passIndex: 0 }),
    ],
    participants,
    councilSession: {
      ...createIdleCouncilSessionState(),
      status: 'running',
      phaseId: 'phase-drafting',
      passIndex: 1,
      workflowState: draftingWorkflow,
      canResume: true,
      updatedAt: 100,
    },
  }).traceItem;

  assert.equal(draftingTrace?.rounds[0]?.sharedReasons?.label, 'Shared with next round');

  let interruptedWithProposalWorkflow = createCouncilSessionState({
    phaseId: 'phase-interrupted-proposal',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 4,
  });
  interruptedWithProposalWorkflow = recordCouncilProposal(interruptedWithProposalWorkflow, {
    proposalId: 'interrupted-proposal-1',
    leaderParticipantId: 'leader',
    proposalText: 'Interrupted round one.',
  });
  interruptedWithProposalWorkflow = applyCouncilReviewBallots(interruptedWithProposalWorkflow, [
    { reviewerParticipantId: 'critic', decision: 'reject', reason: 'Interrupted shared reason.' },
    { reviewerParticipantId: 'writer', decision: 'accept' },
  ]);
  interruptedWithProposalWorkflow = recordCouncilProposal(interruptedWithProposalWorkflow, {
    proposalId: 'interrupted-proposal-2',
    leaderParticipantId: 'leader',
    proposalText: 'Interrupted round two.',
  });

  const interruptedWithProposalTrace = buildCouncilTraceRenderPlan({
    messages: [
      createCouncilMessage({ id: 'interrupted-proposal-1', text: 'Interrupted round one.', kind: 'deliberation', action: 'proposal', authorParticipantId: 'leader', phaseId: 'phase-interrupted-proposal', passIndex: 0 }),
      createCouncilMessage({ id: 'interrupted-proposal-2', text: 'Interrupted round two.', kind: 'deliberation', action: 'proposal', authorParticipantId: 'leader', phaseId: 'phase-interrupted-proposal', passIndex: 1 }),
    ],
    participants,
    councilSession: {
      ...createIdleCouncilSessionState(),
      status: 'interrupted',
      phaseId: 'phase-interrupted-proposal',
      passIndex: 1,
      workflowState: interruptedWithProposalWorkflow,
      canResume: true,
      updatedAt: 100,
    },
  }).traceItem;

  assert.equal(interruptedWithProposalTrace?.rounds[0]?.sharedReasons?.label, 'Shared with next round');

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

  assert.equal(queuedTrace?.rounds[0]?.sharedReasons?.label, 'Queued for next round');

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

  assert.equal(finalTrace?.rounds[0]?.sharedReasons?.label, 'Final improvement reasons');
});

test('structured trace rounds expose a leader card plus reviewer cards in reviewer roster order', () => {
  let workflowState = createCouncilSessionState({
    phaseId: 'phase-structured',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 4,
  });

  workflowState = appendCouncilAgentTurnEvent(workflowState, {
    roundIndex: 0,
    participantId: 'leader',
    role: 'leader',
    event: {
      type: 'text-output',
      createdAt: 100,
      text: 'I am tightening the answer before I lock it.',
    },
  });
  workflowState = recordCouncilProposal(workflowState, {
    proposalId: 'proposal-structured-1',
    leaderParticipantId: 'leader',
    proposalText: 'Final leader proposal.',
    deliberationText: 'I am tightening the answer before I lock it.',
    messageFragments: [
      createModelAuxVoidFragment('reasoning', 'I am tightening the answer before I lock it.'),
      create_FunctionCallInvocation_ContentFragment('tool-1', 'web_search', '{"q":"retry caveat"}'),
      createTextContentFragment('Final leader proposal.'),
    ],
    messagePendingIncomplete: false,
  });
  workflowState = recordCouncilReviewerTurn(workflowState, {
    reviewerParticipantId: 'critic',
    fragmentTexts: [
      'This still needs the caveat.',
      '',
      '[[improve]] Mention the retry caveat.',
    ],
    messageFragments: [
      createModelAuxVoidFragment('reasoning', 'This still needs the caveat.'),
      createTextContentFragment('This still needs the caveat.\n\n[[improve]] Mention the retry caveat.'),
    ],
    messagePendingIncomplete: false,
  });
  workflowState = recordCouncilReviewerTurn(workflowState, {
    reviewerParticipantId: 'writer',
    fragmentTexts: [
      'Reads cleanly.',
      '',
      '[[accept]]',
    ],
    messageFragments: [
      createTextContentFragment('Reads cleanly.\n\n[[accept]]'),
    ],
    messagePendingIncomplete: false,
  });

  const traceItem = buildCouncilTraceRenderPlan({
    messages: [
      createCouncilMessage({ id: 'proposal-structured-1', text: 'Final leader proposal.', kind: 'deliberation', action: 'proposal', authorParticipantId: 'leader', phaseId: 'phase-structured', passIndex: 0 }),
    ],
    participants,
    councilSession: {
      ...createIdleCouncilSessionState(),
      status: 'running',
      phaseId: 'phase-structured',
      passIndex: 0,
      workflowState,
      canResume: true,
      updatedAt: 100,
    },
  }).traceItem;

  assert.ok(traceItem);
  assert.equal(traceItem?.rounds[0]?.leaderCard.participantName, 'Leader');
  assert.equal(traceItem?.rounds[0]?.leaderCard.role, 'leader');
  assert.equal(traceItem?.rounds[0]?.leaderCard.status, 'proposal-ready');
  assert.equal(traceItem?.rounds[0]?.leaderCard.excerpt, 'I am tightening the answer before I lock it.');
  assert.deepEqual(traceItem?.rounds[0]?.leaderCard.messageFragments.map(fragment => fragment.part.pt), ['ma', 'tool_invocation', 'text']);
  assert.deepEqual(traceItem?.rounds[0]?.reviewerCards.map(card => card.participantId), ['critic', 'writer']);
  assert.equal(traceItem?.rounds[0]?.reviewerCards[0]?.detailItems[0]?.type, 'text-output');
  assert.equal(traceItem?.rounds[0]?.reviewerCards[0]?.detailItems[0] && 'text' in traceItem.rounds[0].reviewerCards[0].detailItems[0] ? traceItem.rounds[0].reviewerCards[0].detailItems[0].text : null, 'This still needs the caveat.\n\nMention the retry caveat.');
  assert.equal(traceItem?.rounds[0]?.reviewerCards[0]?.status, 'rejected');
  assert.equal(traceItem?.rounds[0]?.reviewerCards[0]?.terminalReason, 'Mention the retry caveat.');
  assert.deepEqual(traceItem?.rounds[0]?.reviewerCards[0]?.messageFragments.map(fragment => fragment.part.pt), ['ma', 'text']);
  assert.equal(traceItem?.rounds[0]?.reviewerCards[1]?.status, 'accepted');
});

test('structured trace cards include participant model and reasoning labels when available', () => {
  let workflowState = createCouncilSessionState({
    phaseId: 'phase-agent-meta',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 4,
  });

  workflowState = recordCouncilProposal(workflowState, {
    proposalId: 'proposal-agent-meta-1',
    leaderParticipantId: 'leader',
    proposalText: 'Final leader proposal.',
  });

  const traceItem = buildCouncilTraceRenderPlan({
    messages: [
      createCouncilMessage({ id: 'proposal-agent-meta-1', text: 'Final leader proposal.', kind: 'deliberation', action: 'proposal', authorParticipantId: 'leader', phaseId: 'phase-agent-meta', passIndex: 0 }),
    ],
    participants: [
      participants[0],
      { ...participants[1], llmId: 'gpt-5.4', reasoningEffort: 'xhigh' },
      { ...participants[2], llmId: 'claude-sonnet-4', reasoningEffort: 'high' },
      { ...participants[3], llmId: null, reasoningEffort: null },
    ],
    llmLabelsById: new Map([
      ['gpt-5.4', 'GPT-5.4'],
      ['claude-sonnet-4', 'Claude Sonnet 4'],
    ]),
    councilSession: {
      ...createIdleCouncilSessionState(),
      status: 'running',
      phaseId: 'phase-agent-meta',
      passIndex: 0,
      workflowState,
      canResume: true,
      updatedAt: 100,
    },
  }).traceItem;

  assert.equal(traceItem?.rounds[0]?.leaderCard.participantModelLabel, 'GPT-5.4');
  assert.equal(traceItem?.rounds[0]?.leaderCard.participantReasoningLabel, 'X-High');
  assert.equal(traceItem?.rounds[0]?.reviewerCards[0]?.participantModelLabel, 'Claude Sonnet 4');
  assert.equal(traceItem?.rounds[0]?.reviewerCards[0]?.participantReasoningLabel, 'High');
});

test('leader cards prefer structured message snapshots over transient text-output excerpts', () => {
  let workflowState = createCouncilSessionState({
    phaseId: 'phase-leader-markdown',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 4,
  });

  workflowState = recordCouncilAgentMessageSnapshot(workflowState, {
    roundIndex: 0,
    participantId: 'leader',
    role: 'leader',
    messageFragments: [
      createTextContentFragment('## Stable markdown proposal\n\n- First point'),
    ],
    messagePendingIncomplete: true,
  });
  workflowState = appendCouncilAgentTurnEvent(workflowState, {
    roundIndex: 0,
    participantId: 'leader',
    role: 'leader',
    event: {
      type: 'text-output',
      createdAt: 101,
      text: 'Transient raw markdown snapshot',
    },
  });

  const traceItem = buildCouncilTraceRenderPlan({
    messages: [],
    participants,
    councilSession: {
      ...createIdleCouncilSessionState(),
      status: 'running',
      phaseId: 'phase-leader-markdown',
      passIndex: 0,
      workflowState,
      canResume: true,
      updatedAt: 100,
    },
  }).traceItem;

  assert.equal(traceItem?.rounds[0]?.leaderCard.excerpt, '## Stable markdown proposal\n\n- First point');
});

test('structured trace detail payload preserves ordered agent transcript events and keeps pending reviewers visible', () => {
  let workflowState = createCouncilSessionState({
    phaseId: 'phase-live',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 4,
  });

  workflowState = appendCouncilAgentTurnEvent(workflowState, {
    roundIndex: 0,
    participantId: 'leader',
    role: 'leader',
    event: {
      type: 'text-output',
      createdAt: 100,
      text: 'Working through the strongest draft.',
    },
  });
  workflowState = {
    ...workflowState,
    status: 'reviewing',
    rounds: workflowState.rounds.map(round => round.roundIndex !== 0
      ? round
      : {
          ...round,
          proposalId: 'proposal-live-1',
          proposalText: 'Live proposal.',
          leaderTurn: {
            participantId: 'leader',
            roundIndex: 0,
            role: 'leader',
            deliberationText: 'Working through the strongest draft.',
            terminalAction: 'proposal',
            terminalText: 'Live proposal.',
            terminalReason: null,
            events: [
              {
                type: 'text-output',
                createdAt: 100,
                text: 'Working through the strongest draft.',
              },
              {
                type: 'terminal',
                createdAt: 101,
                action: 'proposal',
                text: 'Live proposal.',
                reason: null,
              },
            ],
          },
        }),
  };

  const traceItem = buildCouncilTraceRenderPlan({
    messages: [
      createCouncilMessage({ id: 'proposal-live-1', text: 'Live proposal.', kind: 'deliberation', action: 'proposal', authorParticipantId: 'leader', phaseId: 'phase-live', passIndex: 0 }),
    ],
    participants,
    councilSession: {
      ...createIdleCouncilSessionState(),
      status: 'running',
      phaseId: 'phase-live',
      passIndex: 0,
      workflowState,
      canResume: true,
      updatedAt: 100,
    },
  }).traceItem;

  assert.ok(traceItem);
  assert.deepEqual(traceItem?.rounds[0]?.leaderCard.detailItems, [
    {
      type: 'text-output',
      text: 'Working through the strongest draft.',
    },
    {
      type: 'terminal',
      action: 'proposal',
      text: 'Live proposal.',
      reason: null,
    },
  ]);
  assert.equal(traceItem?.rounds[0]?.reviewerCards[0]?.status, 'waiting');
  assert.equal(traceItem?.rounds[0]?.reviewerCards[1]?.status, 'waiting');
  assert.equal(buildCouncilTraceRenderPlan({
    messages: [],
    participants,
    councilSession: {
      ...createIdleCouncilSessionState(),
      status: 'running',
      phaseId: 'phase-live',
      passIndex: 0,
      workflowState,
      canResume: true,
      updatedAt: 100,
    },
  }).showLegacyDeliberationToggle, false);
});

test('leader proposal card excerpt falls back to visible text fragments when proposal text fields are empty', () => {
  let workflowState = createCouncilSessionState({
    phaseId: 'phase-leader-visible-fragments',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 2,
  });

  workflowState = recordCouncilProposal(workflowState, {
    proposalId: 'proposal-leader-visible-fragments-1',
    leaderParticipantId: 'leader',
    proposalText: '',
    messageFragments: [
      createTextContentFragment('Visible leader proposal body.'),
    ],
    messagePendingIncomplete: false,
  });

  const round = workflowState.rounds[0];
  if (round?.leaderTurn) {
    round.leaderTurn.terminalText = '';
    round.proposalText = null;
    if (round.leaderProposal)
      round.leaderProposal.proposalText = '';
  }

  const traceItem = buildCouncilTraceRenderPlan({
    messages: [],
    participants,
    councilSession: {
      ...createIdleCouncilSessionState(),
      status: 'running',
      phaseId: 'phase-leader-visible-fragments',
      passIndex: 0,
      workflowState,
      canResume: true,
      updatedAt: 100,
    },
  }).traceItem;

  assert.equal(traceItem?.rounds[0]?.proposalCard?.excerpt, 'Visible leader proposal body.');
});

test('trace marks a stopped leader-proposal round as failed instead of waiting for reviews', () => {
  const workflowState = {
    ...createCouncilSessionState({
      phaseId: 'phase-invalid-proposal',
      leaderParticipantId: 'leader',
      reviewerParticipantIds: ['critic', 'writer'],
      maxRounds: 2,
    }),
    status: 'interrupted' as const,
    interruptionReason: 'leader-invalid-proposal',
  };

  const traceItem = buildCouncilTraceRenderPlan({
    messages: [],
    participants,
    councilSession: {
      ...createIdleCouncilSessionState(),
      status: 'stopped',
      phaseId: 'phase-invalid-proposal',
      passIndex: 0,
      workflowState,
      canResume: false,
      interruptionReason: 'leader-invalid-proposal',
      updatedAt: 100,
    },
  }).traceItem;

  assert.ok(traceItem);
  assert.equal(traceItem?.summaryStatus, 'stopped');
  assert.equal(traceItem?.rounds[0]?.leaderProposalFailed, true);
  assert.equal(traceItem?.rounds[0]?.leaderCard.status, 'failed');
  assert.equal(traceItem?.rounds[0]?.leaderCard.terminalLabel, 'Proposal failed');
  assert.equal(traceItem?.rounds[0]?.leaderCard.excerpt, 'Leader failed to produce a valid proposal.');
  assert.equal(traceItem?.rounds[0]?.reviewerCards.length, 0);
});

test('reviewer accept cards omit details when they only repeat the visible verdict', () => {
  let workflowState = createCouncilSessionState({
    phaseId: 'phase-reviewer-no-extra-details',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 2,
  });

  workflowState = recordCouncilProposal(workflowState, {
    proposalId: 'proposal-reviewer-no-extra-details-1',
    leaderParticipantId: 'leader',
    proposalText: 'Proposal under review.',
  });
  workflowState = recordCouncilReviewerVote(workflowState, {
    reviewerParticipantId: 'critic',
    ballot: {
      reviewerParticipantId: 'critic',
      decision: 'accept',
    },
  });

  const traceItem = buildCouncilTraceRenderPlan({
    messages: [],
    participants,
    councilSession: {
      ...createIdleCouncilSessionState(),
      status: 'running',
      phaseId: 'phase-reviewer-no-extra-details',
      passIndex: 0,
      workflowState,
      canResume: true,
      updatedAt: 100,
    },
  }).traceItem;

  assert.equal(traceItem?.rounds[0]?.reviewerCards[0]?.excerpt, 'Accept()');
  assert.equal(traceItem?.rounds[0]?.reviewerCards[0]?.hasDetails, false);
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

  assert.deepEqual(traceItem?.rounds[0]?.reviewerCards.map(card => ({
    participantId: card.participantId,
    decision: card.decision,
    reason: card.reason,
  })), [
    { participantId: 'writer', decision: 'accept', reason: null },
    { participantId: 'critic', decision: 'reject', reason: 'Use the exact caveat.' },
  ]);
  assert.deepEqual(traceItem?.rounds[1]?.reviewerCards, []);
});

test('reviewer vote card excerpts show prior reviewer text for ballot-only accepts without recycling reject plan text', () => {
  let workflowState = createCouncilSessionState({
    phaseId: 'phase-vote-excerpts',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 2,
  });

  workflowState = recordCouncilProposal(workflowState, {
    proposalId: 'proposal-vote-excerpts-1',
    leaderParticipantId: 'leader',
    proposalText: 'Proposal with caveat.',
  });
  workflowState = recordCouncilReviewerPlan(workflowState, {
    reviewerParticipantId: 'critic',
    planText: 'Critic plan: verify the caveat is present.',
  });
  workflowState = recordCouncilReviewerPlan(workflowState, {
    reviewerParticipantId: 'writer',
    planText: 'Writer plan: verify the wording stays concise.',
  });
  workflowState = recordCouncilReviewerVote(workflowState, {
    reviewerParticipantId: 'critic',
    ballot: {
      reviewerParticipantId: 'critic',
      decision: 'accept',
    },
    messageFragments: [
      createTextContentFragment('Critic plan: verify the caveat is present.'),
      create_FunctionCallInvocation_ContentFragment('accept-1', 'Accept', '{}'),
    ],
  });
  workflowState = recordCouncilReviewerVote(workflowState, {
    reviewerParticipantId: 'writer',
    ballot: {
      reviewerParticipantId: 'writer',
      decision: 'reject',
      reason: 'Missing the key caveat.',
    },
    messageFragments: [
      createTextContentFragment('Writer plan: verify the wording stays concise.'),
      create_FunctionCallInvocation_ContentFragment('reject-1', 'Improve', '{"reason":"Missing the key caveat."}'),
    ],
  });

  const traceItem = buildCouncilTraceRenderPlan({
    messages: [],
    participants,
    councilSession: {
      ...createIdleCouncilSessionState(),
      status: 'running',
      phaseId: 'phase-vote-excerpts',
      passIndex: 0,
      workflowState,
      canResume: true,
      updatedAt: 100,
    },
  }).traceItem;

  assert.deepEqual(traceItem?.rounds[0]?.reviewerVoteCards.map(card => ({
    participantId: card.participantId,
    excerpt: card.excerpt,
  })), [
    { participantId: 'critic', excerpt: 'Critic plan: verify the caveat is present.' },
    { participantId: 'writer', excerpt: null },
  ]);
});

test('trace plans disable the legacy deliberation toggle when a structured trace exists', () => {
  let workflowState = createCouncilSessionState({
    phaseId: 'phase-toggle',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 4,
  });

  workflowState = recordCouncilProposal(workflowState, {
    proposalId: 'proposal-toggle-1',
    leaderParticipantId: 'leader',
    proposalText: 'Toggle proposal.',
  });

  const plan = buildCouncilTraceRenderPlan({
    messages: [
      createCouncilMessage({ id: 'proposal-toggle-1', text: 'Toggle proposal.', kind: 'deliberation', action: 'proposal', authorParticipantId: 'leader', phaseId: 'phase-toggle', passIndex: 0 }),
    ],
    participants,
    councilSession: {
      ...createIdleCouncilSessionState(),
      status: 'running',
      phaseId: 'phase-toggle',
      passIndex: 0,
      workflowState,
      canResume: true,
      updatedAt: 100,
    },
  });

  assert.ok(plan.traceItem);
  assert.equal(plan.showLegacyDeliberationToggle, false);
});

test('trace hides purely synthetic shared rejection reasons', () => {
  let workflowState = createCouncilSessionState({
    phaseId: 'phase-shared-synthetic-reasons',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 4,
  });

  workflowState = recordCouncilProposal(workflowState, {
    proposalId: 'proposal-shared-synthetic-reasons-1',
    leaderParticipantId: 'leader',
    proposalText: 'Proposal under review.',
  });
  workflowState = applyCouncilReviewBallots(workflowState, [
    { reviewerParticipantId: 'critic', decision: 'reject', reason: COUNCIL_REVIEW_ANALYSIS_MISSING_REASON },
    { reviewerParticipantId: 'writer', decision: 'reject', reason: COUNCIL_REVIEW_FAILED_REASON },
  ]);
  workflowState = recordCouncilProposal(workflowState, {
    proposalId: 'proposal-shared-synthetic-reasons-2',
    leaderParticipantId: 'leader',
    proposalText: 'Next round proposal.',
  });

  const traceItem = buildCouncilTraceRenderPlan({
    messages: [],
    participants,
    councilSession: {
      ...createIdleCouncilSessionState(),
      status: 'running',
      phaseId: 'phase-shared-synthetic-reasons',
      passIndex: 1,
      workflowState,
      canResume: true,
      updatedAt: 100,
    },
  }).traceItem;

  assert.equal(traceItem?.rounds[0]?.sharedReasons, null);
});

test('trace keeps only real shared rejection reasons when synthetic ones are also present', () => {
  let workflowState = createCouncilSessionState({
    phaseId: 'phase-shared-mixed-reasons',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 4,
  });

  workflowState = recordCouncilProposal(workflowState, {
    proposalId: 'proposal-shared-mixed-reasons-1',
    leaderParticipantId: 'leader',
    proposalText: 'Proposal under review.',
  });
  workflowState = applyCouncilReviewBallots(workflowState, [
    { reviewerParticipantId: 'critic', decision: 'reject', reason: COUNCIL_REVIEW_ANALYSIS_MISSING_REASON },
    { reviewerParticipantId: 'writer', decision: 'reject', reason: 'Need the exact caveat.' },
  ]);
  workflowState = recordCouncilProposal(workflowState, {
    proposalId: 'proposal-shared-mixed-reasons-2',
    leaderParticipantId: 'leader',
    proposalText: 'Next round proposal.',
  });

  const traceItem = buildCouncilTraceRenderPlan({
    messages: [],
    participants,
    councilSession: {
      ...createIdleCouncilSessionState(),
      status: 'running',
      phaseId: 'phase-shared-mixed-reasons',
      passIndex: 1,
      workflowState,
      canResume: true,
      updatedAt: 100,
    },
  }).traceItem;

  assert.deepEqual(traceItem?.rounds[0]?.sharedReasons?.reasons, ['Need the exact caveat.']);
});

test('trace hides invalid reviewer ballot tool invocations for missing-verdict reviewer failures', () => {
  let workflowState = createCouncilSessionState({
    phaseId: 'phase-invalid-review-vote',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic'],
    maxRounds: 2,
  });

  workflowState = recordCouncilProposal(workflowState, {
    proposalId: 'proposal-invalid-review-vote-1',
    leaderParticipantId: 'leader',
    proposalText: 'Proposal under review.',
  });
  workflowState = recordCouncilReviewerVote(workflowState, {
    reviewerParticipantId: 'critic',
    ballot: {
      reviewerParticipantId: 'critic',
      decision: 'reject',
      reason: COUNCIL_REVIEW_VERDICT_MISSING_REASON,
    },
    messageFragments: [
      createModelAuxVoidFragment('reasoning', 'I should inspect the proposal one more time.'),
      createTextContentFragment('Draft verdict before the ballot fails validation.'),
      create_FunctionCallInvocation_ContentFragment('accept-invalid', 'Accept', '{}'),
    ],
  });

  const traceItem = buildCouncilTraceRenderPlan({
    messages: [],
    participants,
    councilSession: {
      ...createIdleCouncilSessionState(),
      status: 'running',
      phaseId: 'phase-invalid-review-vote',
      passIndex: 0,
      workflowState,
      canResume: true,
      updatedAt: 100,
    },
  }).traceItem;

  const criticCard = traceItem?.rounds[0]?.reviewerCards[0] ?? null;
  assert.ok(criticCard);
  assert.equal(criticCard?.decision, 'reject');
  assert.equal(criticCard?.reason, null);
  assert.equal(criticCard?.terminalLabel, 'Missing verdict');
  assert.equal(criticCard?.excerpt, 'The reviewer response did not call Accept() or Improve().');
  assert.deepEqual(criticCard?.messageFragments, []);
  assert.equal(criticCard?.hasDetails, false);
  assert.deepEqual(criticCard?.detailItems, []);
});

test('trace surfaces reviewer service failures instead of missing-verdict copy', () => {
  let workflowState = createCouncilSessionState({
    phaseId: 'phase-service-review-failure',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic'],
    maxRounds: 2,
  });

  workflowState = recordCouncilProposal(workflowState, {
    proposalId: 'proposal-service-review-failure-1',
    leaderParticipantId: 'leader',
    proposalText: 'Proposal under review.',
  });
  workflowState = recordCouncilReviewerVote(workflowState, {
    reviewerParticipantId: 'critic',
    ballot: {
      reviewerParticipantId: 'critic',
      decision: 'reject',
      reason: '[Service Issue] Openai: Upstream responded with HTTP 429 - All credentials for model claude-opus-4-6-thinking are cooling down',
    },
    messageFragments: [
      createErrorContentFragment('[Service Issue] Openai: Upstream responded with HTTP 429 - All credentials for model claude-opus-4-6-thinking are cooling down'),
    ],
  });

  const traceItem = buildCouncilTraceRenderPlan({
    messages: [],
    participants,
    councilSession: {
      ...createIdleCouncilSessionState(),
      status: 'running',
      phaseId: 'phase-service-review-failure',
      passIndex: 0,
      workflowState,
      canResume: true,
      updatedAt: 100,
    },
  }).traceItem;

  const criticCard = traceItem?.rounds[0]?.reviewerCards[0] ?? null;
  assert.ok(criticCard);
  assert.equal(criticCard?.decision, 'reject');
  assert.equal(criticCard?.reason, null);
  assert.equal(criticCard?.terminalLabel, 'Service issue');
  assert.equal(criticCard?.excerpt, '[Service Issue] Openai: Upstream responded with HTTP 429 - All credentials for model claude-opus-4-6-thinking are cooling down');
});

test('trace renders ballot-only reviewer accepts as valid accepts', () => {
  let workflowState = createCouncilSessionState({
    phaseId: 'phase-missing-analysis',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic'],
    maxRounds: 2,
  });

  workflowState = recordCouncilProposal(workflowState, {
    proposalId: 'proposal-missing-analysis-1',
    leaderParticipantId: 'leader',
    proposalText: 'Proposal under review.',
  });
  workflowState = recordCouncilReviewerVote(workflowState, {
    reviewerParticipantId: 'critic',
    ballot: {
      reviewerParticipantId: 'critic',
      decision: 'accept',
    },
    messageFragments: [
      create_FunctionCallInvocation_ContentFragment('accept-no-analysis', 'Accept', '{}'),
    ],
  });

  const traceItem = buildCouncilTraceRenderPlan({
    messages: [],
    participants,
    councilSession: {
      ...createIdleCouncilSessionState(),
      status: 'running',
      phaseId: 'phase-missing-analysis',
      passIndex: 0,
      workflowState,
      canResume: true,
      updatedAt: 100,
    },
  }).traceItem;

  const criticCard = traceItem?.rounds[0]?.reviewerCards[0] ?? null;
  assert.ok(criticCard);
  assert.equal(criticCard?.terminalLabel, 'Accept()');
  assert.equal(criticCard?.decision, 'accept');
  assert.equal(criticCard?.excerpt, 'Accept()');
});

test('trace shows prior reviewer analysis on an accept card when the ballot turn is tool-only', () => {
  let workflowState = createCouncilSessionState({
    phaseId: 'phase-ballot-only-accept-with-analysis',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic'],
    maxRounds: 2,
  });

  workflowState = recordCouncilProposal(workflowState, {
    proposalId: 'proposal-ballot-only-accept-with-analysis-1',
    leaderParticipantId: 'leader',
    proposalText: 'Proposal under review.',
  });
  workflowState = recordCouncilReviewerPlan(workflowState, {
    reviewerParticipantId: 'critic',
    planText: 'The caveat is covered and the answer is ready.',
  });
  workflowState = recordCouncilReviewerVote(workflowState, {
    reviewerParticipantId: 'critic',
    ballot: {
      reviewerParticipantId: 'critic',
      decision: 'accept',
    },
    messageFragments: [
      create_FunctionCallInvocation_ContentFragment('accept-after-analysis', 'Accept', '{}'),
    ],
  });

  const traceItem = buildCouncilTraceRenderPlan({
    messages: [],
    participants,
    councilSession: {
      ...createIdleCouncilSessionState(),
      status: 'running',
      phaseId: 'phase-ballot-only-accept-with-analysis',
      passIndex: 0,
      workflowState,
      canResume: true,
      updatedAt: 100,
    },
  }).traceItem;

  const criticCard = traceItem?.rounds[0]?.reviewerCards[0] ?? null;
  assert.ok(criticCard);
  assert.equal(criticCard?.terminalLabel, 'Accept()');
  assert.equal(criticCard?.decision, 'accept');
  assert.equal(criticCard?.excerpt, 'The caveat is covered and the answer is ready.');
});

test('trace round view keeps proposal plus reviewer analysis and verdict artifacts', () => {
  let workflowState = createCouncilSessionState({
    phaseId: 'phase-sections',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 2,
  });

  workflowState = recordCouncilProposal(workflowState, {
    proposalId: 'proposal-sections-1',
    leaderParticipantId: 'leader',
    proposalText: 'Sectioned proposal.',
  });
  workflowState = recordCouncilReviewerPlan(workflowState, {
    reviewerParticipantId: 'critic',
    planText: 'Check the caveat.',
  });
  workflowState = recordCouncilReviewerPlan(workflowState, {
    reviewerParticipantId: 'writer',
    planText: 'Check the wording.',
  });
  workflowState = recordCouncilReviewerVote(workflowState, {
    reviewerParticipantId: 'critic',
    ballot: {
      reviewerParticipantId: 'critic',
      decision: 'reject',
      reason: 'Missing the caveat.',
    },
  });
  workflowState = recordCouncilReviewerVote(workflowState, {
    reviewerParticipantId: 'writer',
    ballot: {
      reviewerParticipantId: 'writer',
      decision: 'accept',
    },
  });
  workflowState = applyCouncilReviewBallots(workflowState, [
    { reviewerParticipantId: 'critic', decision: 'reject', reason: 'Missing the caveat.' },
    { reviewerParticipantId: 'writer', decision: 'accept' },
  ]);

  const traceItem = buildCouncilTraceRenderPlan({
    messages: [],
    participants,
    councilSession: {
      ...createIdleCouncilSessionState(),
      status: 'running',
      phaseId: 'phase-sections',
      passIndex: 0,
      workflowState,
      canResume: true,
      updatedAt: 100,
    },
  }).traceItem;

  assert.ok(traceItem);
  assert.equal(traceItem?.rounds[0]?.phase, 'completed');
  assert.equal(traceItem?.rounds[0]?.proposalCard?.terminalText, 'Sectioned proposal.');
  assert.equal(traceItem?.rounds[0]?.reviewerPlanProgress.completed, 2);
  assert.equal(traceItem?.rounds[0]?.reviewerPlanProgress.isShared, true);
  assert.deepEqual(traceItem?.rounds[0]?.reviewerPlanCards.map(card => card.excerpt), ['Check the caveat.', 'Check the wording.']);
  assert.equal(traceItem?.rounds[0]?.reviewerVoteProgress.completed, 2);
  assert.equal(traceItem?.rounds[0]?.reviewerVoteProgress.isShared, true);
  assert.deepEqual(traceItem?.rounds[0]?.reviewerVoteCards.map(card => card.decision), ['reject', 'accept']);
});

test('trace preserves same-round reviewer analysis artifacts when present', () => {
  let workflowState = createCouncilSessionState({
    phaseId: 'phase-hidden-plans',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 2,
  });

  workflowState = recordCouncilProposal(workflowState, {
    proposalId: 'proposal-hidden-plans-1',
    leaderParticipantId: 'leader',
    proposalText: 'Proposal with hidden plans.',
  });
  workflowState = recordCouncilReviewerPlan(workflowState, {
    reviewerParticipantId: 'critic',
    planText: 'Only one reviewer has planned so far.',
  });

  const traceItem = buildCouncilTraceRenderPlan({
    messages: [],
    participants,
    councilSession: {
      ...createIdleCouncilSessionState(),
      status: 'running',
      phaseId: 'phase-hidden-plans',
      passIndex: 0,
      workflowState,
      canResume: true,
      updatedAt: 100,
    },
  }).traceItem;

  assert.ok(traceItem);
  assert.equal(traceItem?.rounds[0]?.phase, 'reviewer-votes');
  assert.equal(traceItem?.rounds[0]?.reviewerPlanProgress.completed, 1);
  assert.equal(traceItem?.rounds[0]?.reviewerPlanProgress.isShared, false);
  assert.deepEqual(traceItem?.rounds[0]?.reviewerPlanCards.map(card => card.excerpt), ['Only one reviewer has planned so far.']);
});

test('trace shows completed same-round reviewer votes before the round closes', () => {
  let workflowState = createCouncilSessionState({
    phaseId: 'phase-partial-votes',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 2,
  });

  workflowState = recordCouncilProposal(workflowState, {
    proposalId: 'proposal-partial-votes-1',
    leaderParticipantId: 'leader',
    proposalText: 'Proposal with partial votes.',
  });
  workflowState = recordCouncilReviewerPlan(workflowState, {
    reviewerParticipantId: 'critic',
    planText: 'Critic plan.',
  });
  workflowState = recordCouncilReviewerPlan(workflowState, {
    reviewerParticipantId: 'writer',
    planText: 'Writer plan.',
  });
  workflowState = recordCouncilReviewerVote(workflowState, {
    reviewerParticipantId: 'critic',
    ballot: {
      reviewerParticipantId: 'critic',
      decision: 'reject',
      reason: 'Need the caveat.',
    },
  });

  const traceItem = buildCouncilTraceRenderPlan({
    messages: [],
    participants,
    councilSession: {
      ...createIdleCouncilSessionState(),
      status: 'running',
      phaseId: 'phase-partial-votes',
      passIndex: 0,
      workflowState,
      canResume: true,
      updatedAt: 100,
    },
  }).traceItem;

  assert.ok(traceItem);
  assert.equal(traceItem?.rounds[0]?.phase, 'reviewer-votes');
  assert.equal(traceItem?.rounds[0]?.reviewerVoteProgress.completed, 1);
  assert.equal(traceItem?.rounds[0]?.reviewerVoteProgress.isShared, false);
  assert.deepEqual(traceItem?.rounds[0]?.reviewerVoteCards.map(card => ({
    decision: card.decision,
    reason: card.reason,
  })), [{ decision: 'reject', reason: 'Need the caveat.' }]);
});

test('streaming reviewer vote snapshots stay pending until a terminal ballot exists', () => {
  let workflowState = createCouncilSessionState({
    phaseId: 'phase-live-vote',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 2,
  });

  workflowState = recordCouncilProposal(workflowState, {
    proposalId: 'proposal-live-vote-1',
    leaderParticipantId: 'leader',
    proposalText: 'Proposal still under review.',
  });
  workflowState = recordCouncilReviewerPlan(workflowState, {
    reviewerParticipantId: 'critic',
    planText: 'Check the missing caveat.',
  });
  workflowState = recordCouncilReviewerPlan(workflowState, {
    reviewerParticipantId: 'writer',
    planText: 'Check the wording.',
  });
  workflowState = appendCouncilAgentTurnEvent(workflowState, {
    roundIndex: 0,
    participantId: 'critic',
    role: 'reviewer',
    event: {
      type: 'text-output',
      createdAt: 101,
      text: 'Still checking whether the caveat is present.',
    },
  });

  const traceItem = buildCouncilTraceRenderPlan({
    messages: [],
    participants,
    councilSession: {
      ...createIdleCouncilSessionState(),
      status: 'running',
      phaseId: 'phase-live-vote',
      passIndex: 0,
      workflowState,
      canResume: true,
      updatedAt: 100,
    },
  }).traceItem;

  assert.ok(traceItem);
  assert.equal(traceItem?.rounds[0]?.phase, 'reviewer-votes');
  assert.deepEqual(traceItem?.rounds[0]?.reviewerCards.map(card => ({
    participantId: card.participantId,
    decision: card.decision,
    reason: card.reason,
    status: card.status,
  })), [
    {
      participantId: 'critic',
      decision: 'pending',
      reason: null,
      status: 'waiting',
    },
    {
      participantId: 'writer',
      decision: 'pending',
      reason: null,
      status: 'waiting',
    },
  ]);
  assert.equal(traceItem?.rounds[0]?.reviewerVoteProgress.completed, 0);
  assert.deepEqual(traceItem?.rounds[0]?.reviewerVoteCards, []);
});
