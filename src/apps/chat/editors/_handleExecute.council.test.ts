import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyCouncilReviewBallots,
  appendCouncilAgentTurnEvent,
  classifyCouncilReviewBallotFragments,
  classifyCouncilTextFragments,
  createCouncilSessionState,
  extractCouncilProposalText,
  evaluateCouncilPass,
  getCouncilResumePassIndex,
  hydrateCouncilSessionFromTranscriptEntries,
  recordCouncilAgentMessageSnapshot,
  recordCouncilProposal,
  recordCouncilReviewerPlan,
  recordCouncilReviewerInitialDraft,
  recordCouncilReviewerTurn,
  recordCouncilReviewerVote,
  stripCouncilTranscriptPrefix,
} from './_handleExecute.council';
import {
  createErrorContentFragment,
  createModelAuxVoidFragment,
  createTextContentFragment,
  create_FunctionCallInvocation_ContentFragment,
} from '~/common/stores/chat/chat.fragments';

test('stateful council session starts in drafting with no rounds completed', () => {
  const session = createCouncilSessionState({
    phaseId: 'phase-1',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 4,
  });

  assert.equal(session.status, 'drafting');
  assert.equal(session.phaseId, 'phase-1');
  assert.equal(session.roundIndex, 0);
  assert.equal(session.maxRounds, 4);
  assert.equal(session.rounds.length, 1);
  assert.equal(session.rounds[0]?.proposalText, null);
  assert.deepEqual(session.rounds[0]?.sharedRejectionReasons, []);
});

test('recording a leader proposal moves the current round into reviewing', () => {
  const session = createCouncilSessionState({
    phaseId: 'phase-1',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 4,
  });

  const nextSession = recordCouncilProposal(session, {
    proposalId: 'proposal-1',
    leaderParticipantId: 'leader',
    proposalText: 'First draft answer.',
  });

  assert.equal(nextSession.status, 'reviewing');
  assert.equal(nextSession.roundIndex, 0);
  assert.equal(nextSession.rounds[0]?.proposalId, 'proposal-1');
  assert.equal(nextSession.rounds[0]?.proposalText, 'First draft answer.');
});

test('unanimous reviewer acceptance marks the proposal accepted verbatim', () => {
  const session = recordCouncilProposal(createCouncilSessionState({
    phaseId: 'phase-1',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 4,
  }), {
    proposalId: 'proposal-1',
    leaderParticipantId: 'leader',
    proposalText: 'Accepted answer.',
  });

  const acceptedSession = applyCouncilReviewBallots(session, [
    { reviewerParticipantId: 'critic', decision: 'accept' },
    { reviewerParticipantId: 'writer', decision: 'accept' },
  ]);

  assert.equal(acceptedSession.status, 'accepted');
  assert.equal(acceptedSession.finalResponse, 'Accepted answer.');
  assert.equal(acceptedSession.acceptedProposalId, 'proposal-1');
});

test('reviewer rejection advances to the next drafting round with shared reasons', () => {
  const session = recordCouncilProposal(createCouncilSessionState({
    phaseId: 'phase-1',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 4,
  }), {
    proposalId: 'proposal-1',
    leaderParticipantId: 'leader',
    proposalText: 'Needs work.',
  });

  const revisedSession = applyCouncilReviewBallots(session, [
    { reviewerParticipantId: 'critic', decision: 'accept' },
    { reviewerParticipantId: 'writer', decision: 'reject', reason: 'Missing the key caveat.' },
  ]);

  assert.equal(revisedSession.status, 'drafting');
  assert.equal(revisedSession.roundIndex, 1);
  assert.equal(revisedSession.rounds.length, 2);
  assert.deepEqual(revisedSession.rounds[1]?.sharedRejectionReasons, ['Missing the key caveat.']);
});

test('multi-round council flow accepts a revised second proposal verbatim', () => {
  const firstDraftSession = recordCouncilProposal(createCouncilSessionState({
    phaseId: 'phase-1',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 4,
  }), {
    proposalId: 'proposal-1',
    leaderParticipantId: 'leader',
    proposalText: 'Draft one.',
  });

  const rejectedSession = applyCouncilReviewBallots(firstDraftSession, [
    { reviewerParticipantId: 'critic', decision: 'reject', reason: 'Missing the caveat.' },
    { reviewerParticipantId: 'writer', decision: 'accept' },
  ]);

  const secondDraftSession = recordCouncilProposal(rejectedSession, {
    proposalId: 'proposal-2',
    leaderParticipantId: 'leader',
    proposalText: 'Draft two with caveat.',
  });

  const acceptedSession = applyCouncilReviewBallots(secondDraftSession, [
    { reviewerParticipantId: 'critic', decision: 'accept' },
    { reviewerParticipantId: 'writer', decision: 'accept' },
  ]);

  assert.equal(acceptedSession.status, 'accepted');
  assert.equal(acceptedSession.acceptedProposalId, 'proposal-2');
  assert.equal(acceptedSession.finalResponse, 'Draft two with caveat.');
  assert.deepEqual(acceptedSession.rounds[1]?.sharedRejectionReasons, ['Missing the caveat.']);
});

test('leader proposal extraction joins text fragments into one proposal body', () => {
  const proposalText = extractCouncilProposalText([
    'First paragraph.',
    '',
    'Second paragraph.',
  ]);

  assert.equal(proposalText, 'First paragraph.\n\nSecond paragraph.');
});

test('legacy consensus deliberation prefixes are still stripped during council transcript parsing', () => {
  assert.equal(
    stripCouncilTranscriptPrefix('[Consensus deliberation] Draft recovered from storage.'),
    'Draft recovered from storage.',
  );
});

test('council message snapshots preserve fragment ids so live reasoning cards do not remount on every update', () => {
  const session = createCouncilSessionState({
    phaseId: 'phase-1',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 4,
  });

  const reasoningFragment = createModelAuxVoidFragment('reasoning', 'First reasoning draft.');
  const textFragment = createTextContentFragment('Visible proposal text.');

  const nextSession = recordCouncilAgentMessageSnapshot(session, {
    roundIndex: 0,
    participantId: 'leader',
    role: 'leader',
    messageFragments: [reasoningFragment, textFragment],
    messagePendingIncomplete: true,
  });

  assert.equal(nextSession.rounds[0]?.leaderTurn?.messageFragments[0]?.fId, reasoningFragment.fId);
  assert.equal(nextSession.rounds[0]?.leaderTurn?.messageFragments[1]?.fId, textFragment.fId);
  assert.equal(nextSession.rounds[0]?.leaderTurn?.messagePendingIncomplete, true);
});

test('leader snapshots keep the previous visible text without re-showing restarted reasoning during resume', () => {
  const session = createCouncilSessionState({
    phaseId: 'phase-1',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 4,
  });

  const initialSession = recordCouncilAgentMessageSnapshot(session, {
    roundIndex: 0,
    participantId: 'leader',
    role: 'leader',
    messageFragments: [
      createModelAuxVoidFragment('reasoning', 'First reasoning draft.'),
      createTextContentFragment('Visible proposal text.'),
      createErrorContentFragment('Issue: connection terminated.'),
    ],
    messagePendingIncomplete: true,
  });

  const resumedSession = recordCouncilAgentMessageSnapshot(initialSession, {
    roundIndex: 0,
    participantId: 'leader',
    role: 'leader',
    messageFragments: [
      createModelAuxVoidFragment('reasoning', 'Restarted reasoning draft.'),
    ],
    messagePendingIncomplete: true,
  });

  const resumedFragments = resumedSession.rounds[0]?.leaderTurn?.messageFragments ?? [];
  assert.equal(resumedFragments.some(fragment => fragment.ft === 'content' && fragment.part.pt === 'text' && fragment.part.text === 'Visible proposal text.'), true);
  assert.equal(resumedFragments.some(fragment => fragment.ft === 'void' && fragment.part.pt === 'ma' && fragment.part.aText === 'Restarted reasoning draft.'), false);
  assert.equal(resumedFragments.some(fragment => fragment.ft === 'content' && fragment.part.pt === 'error'), false);
});

test('leader snapshots keep the previous longer visible text while a resumed stream is still replaying a shorter prefix', () => {
  const session = createCouncilSessionState({
    phaseId: 'phase-1',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 4,
  });

  const initialSession = recordCouncilAgentMessageSnapshot(session, {
    roundIndex: 0,
    participantId: 'leader',
    role: 'leader',
    messageFragments: [
      createTextContentFragment('Visible proposal text with more content.'),
    ],
    messagePendingIncomplete: true,
  });

  const resumedSession = recordCouncilAgentMessageSnapshot(initialSession, {
    roundIndex: 0,
    participantId: 'leader',
    role: 'leader',
    messageFragments: [
      createTextContentFragment('Visible proposal'),
      createModelAuxVoidFragment('reasoning', 'Restarted reasoning draft.'),
    ],
    messagePendingIncomplete: true,
  });

  const resumedText = (resumedSession.rounds[0]?.leaderTurn?.messageFragments ?? [])
    .filter(fragment => fragment.ft === 'content' && fragment.part.pt === 'text')
    .map(fragment => fragment.part.text)
    .join('\n\n');
  assert.equal(resumedText, 'Visible proposal text with more content.');
  assert.equal((resumedSession.rounds[0]?.leaderTurn?.messageFragments ?? [])
    .some(fragment => fragment.ft === 'void' && fragment.part.pt === 'ma' && fragment.part.aText === 'Restarted reasoning draft.'), false);
});

test('leader snapshots do not append restarted reasoning when the resumed stream only matches the same visible text', () => {
  const session = createCouncilSessionState({
    phaseId: 'phase-1',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 4,
  });

  const initialSession = recordCouncilAgentMessageSnapshot(session, {
    roundIndex: 0,
    participantId: 'leader',
    role: 'leader',
    messageFragments: [
      createTextContentFragment('Visible proposal text.'),
    ],
    messagePendingIncomplete: true,
  });

  const resumedSession = recordCouncilAgentMessageSnapshot(initialSession, {
    roundIndex: 0,
    participantId: 'leader',
    role: 'leader',
    messageFragments: [
      createTextContentFragment('Visible proposal text.'),
      createModelAuxVoidFragment('reasoning', 'Restarted reasoning draft.'),
    ],
    messagePendingIncomplete: true,
  });

  assert.equal((resumedSession.rounds[0]?.leaderTurn?.messageFragments ?? [])
    .some(fragment => fragment.ft === 'void' && fragment.part.pt === 'ma' && fragment.part.aText === 'Restarted reasoning draft.'), false);
});

test('reviewer accept ballot parses without a rejection reason', () => {
  const ballot = classifyCouncilReviewBallotFragments([
    '[[accept]]',
  ], 'critic');

  assert.deepEqual(ballot, {
    reviewerParticipantId: 'critic',
    decision: 'accept',
  });
});

test('reviewer reject ballot preserves a rejection reason when present', () => {
  const ballot = classifyCouncilReviewBallotFragments([
    '[[improve]] Missing the caveat about retries.',
  ], 'critic');

  assert.deepEqual(ballot, {
    reviewerParticipantId: 'critic',
    decision: 'reject',
    reason: 'Missing the caveat about retries.',
  });
});

test('reviewer reject ballot parses without a rejection reason', () => {
  const ballot = classifyCouncilReviewBallotFragments([
    '[[improve]]',
  ], 'critic');

  assert.deepEqual(ballot, {
    reviewerParticipantId: 'critic',
    decision: 'reject',
  });
});

test('reviewer rejection without a reason still advances to the next drafting round', () => {
  const session = recordCouncilProposal(createCouncilSessionState({
    phaseId: 'phase-1',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic'],
    maxRounds: 4,
  }), {
    proposalId: 'proposal-1',
    leaderParticipantId: 'leader',
    proposalText: 'Needs work.',
  });

  const revisedSession = applyCouncilReviewBallots(session, [
    { reviewerParticipantId: 'critic', decision: 'reject' },
  ]);

  assert.equal(revisedSession.status, 'drafting');
  assert.equal(revisedSession.roundIndex, 1);
  assert.deepEqual(revisedSession.rounds[1]?.sharedRejectionReasons, []);
});

test('invalid reviewer ballot becomes a synthetic rejection', () => {
  const ballot = classifyCouncilReviewBallotFragments([
    'I do not like this draft.',
  ], 'critic');

  assert.deepEqual(ballot, {
    reviewerParticipantId: 'critic',
    decision: 'reject',
    reason: 'I do not like this draft.',
  });
});

test('empty reviewer ballot still falls back to a synthetic rejection reason', () => {
  const ballot = classifyCouncilReviewBallotFragments([], 'critic');

  assert.deepEqual(ballot, {
    reviewerParticipantId: 'critic',
    decision: 'reject',
    reason: 'review failed',
  });
});

test('leader freeform text before terminal proposal is preserved as deliberation text', () => {
  const result = classifyCouncilTextFragments([
    'Thinking through the tradeoff first.',
    '',
    '[[proposal]] Final user-facing answer.',
  ], true);

  assert.equal(result.action, 'proposal');
  assert.equal(result.response, 'Final user-facing answer.');
  assert.equal(result.deliberationText, 'Thinking through the tradeoff first.');
});

test('reviewer freeform text before terminal accept is preserved as deliberation text', () => {
  const result = classifyCouncilTextFragments([
    'I checked the caveat and the wording looks right.',
    '',
    '[[accept]]',
  ], false);

  assert.equal(result.action, 'accept');
  assert.equal(result.response, '');
  assert.equal(result.deliberationText, 'I checked the caveat and the wording looks right.');
});

test('reviewer freeform text before terminal reject is preserved while the reject reason remains terminal', () => {
  const result = classifyCouncilTextFragments([
    'The answer is close, but it misses one caveat.',
    '',
    '[[improve]] Missing the retry caveat.',
  ], false);

  assert.equal(result.action, 'revise');
  assert.equal(result.response, '');
  assert.equal(result.deliberationText, 'The answer is close, but it misses one caveat.\n\nMissing the retry caveat.');

  const ballot = classifyCouncilReviewBallotFragments([
    'The answer is close, but it misses one caveat.',
    '',
    '[[improve]] Missing the retry caveat.',
  ], 'critic');

  assert.deepEqual(ballot, {
    reviewerParticipantId: 'critic',
    decision: 'reject',
    reason: 'Missing the retry caveat.',
  });
});

test('leader inline proposal marker inside one fragment still splits deliberation from the final proposal', () => {
  const result = classifyCouncilTextFragments([
    'Thinking out loud first.\n\n[[proposal]] Final user-facing answer.',
  ], true);

  assert.equal(result.action, 'proposal');
  assert.equal(result.deliberationText, 'Thinking out loud first.');
  assert.equal(result.response, 'Final user-facing answer.');
});

test('reviewer inline terminal accept inside one fragment still parses as an accept ballot', () => {
  const result = classifyCouncilTextFragments([
    'I checked the proposal closely.\n\n[[accept]]',
  ], false);

  assert.equal(result.action, 'accept');
  assert.equal(result.deliberationText, 'I checked the proposal closely.');
  assert.equal(result.response, '');

  const ballot = classifyCouncilReviewBallotFragments([
    'I checked the proposal closely.\n\n[[accept]]',
  ], 'critic');

  assert.deepEqual(ballot, {
    reviewerParticipantId: 'critic',
    decision: 'accept',
  });
});

test('reviewer turn records preserve freeform output before terminal accept verdict', () => {
  const session = recordCouncilProposal(createCouncilSessionState({
    phaseId: 'phase-turns',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic'],
    maxRounds: 3,
  }), {
    proposalId: 'proposal-1',
    leaderParticipantId: 'leader',
    proposalText: 'Answer.',
  });

  const nextSession = recordCouncilReviewerTurn(session, {
    reviewerParticipantId: 'critic',
    fragmentTexts: [
      'Checked the answer against the requirements.',
      '',
      '[[accept]]',
    ],
  });

  assert.deepEqual(nextSession.rounds[0]?.reviewerTurns?.critic?.events.map(event => ({
    type: event.type,
    text: event.type === 'text-output' ? event.text : undefined,
  })), [
    {
      type: 'text-output',
      text: 'Checked the answer against the requirements.',
    },
    {
      type: 'terminal',
      text: undefined,
    },
  ]);
  assert.equal(nextSession.rounds[0]?.reviewerTurns?.critic?.deliberationText, 'Checked the answer against the requirements.');
  assert.equal(nextSession.rounds[0]?.reviewerTurns?.critic?.terminalAction, 'accept');
  assert.equal(nextSession.rounds[0]?.reviewerTurns?.critic?.terminalReason, null);
});

test('reviewer initial draft is stored separately and kept in the turn event stream before the final vote', () => {
  const session = recordCouncilProposal(createCouncilSessionState({
    phaseId: 'phase-turns',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic'],
    maxRounds: 3,
  }), {
    proposalId: 'proposal-1',
    leaderParticipantId: 'leader',
    proposalText: 'Answer.',
  });

  const draftedSession = recordCouncilReviewerInitialDraft(session, {
    reviewerParticipantId: 'critic',
    draftText: 'My initial answer draft.',
  });
  const votedSession = recordCouncilReviewerTurn(draftedSession, {
    reviewerParticipantId: 'critic',
    fragmentTexts: [
      'I now agree with the Leader proposal.',
      '',
      '[[accept]]',
    ],
  });

  assert.equal(votedSession.rounds[0]?.reviewerTurns?.critic?.initialDraftText, 'My initial answer draft.');
  assert.deepEqual(votedSession.rounds[0]?.reviewerTurns?.critic?.events.map(event => event.type === 'text-output' ? event.text : '[terminal]'), [
    'My initial answer draft.',
    'I now agree with the Leader proposal.',
    '[terminal]',
  ]);
});

test('council rounds move directly from leader proposal to reviewer vote phase', () => {
  let session = createCouncilSessionState({
    phaseId: 'phase-structured-rounds',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 3,
  });

  assert.equal(session.rounds[0]?.phase, 'leader-proposal');
  assert.equal(session.rounds[0]?.leaderProposal, null);

  session = recordCouncilProposal(session, {
    proposalId: 'proposal-1',
    leaderParticipantId: 'leader',
    proposalText: 'Round one proposal.',
  });

  assert.equal(session.rounds[0]?.phase, 'reviewer-votes');
  assert.equal(session.rounds[0]?.leaderProposal?.proposalText, 'Round one proposal.');

  session = recordCouncilReviewerPlan(session, {
    reviewerParticipantId: 'critic',
    planText: 'Check whether the answer covers the caveat.',
  });

  assert.equal(session.rounds[0]?.phase, 'reviewer-votes');
  assert.equal(session.rounds[0]?.reviewerPlans.critic?.planText, 'Check whether the answer covers the caveat.');
  assert.deepEqual(session.rounds[0]?.reviewerVotes, {});

  session = recordCouncilReviewerPlan(session, {
    reviewerParticipantId: 'writer',
    planText: 'Check whether the wording stays concise.',
  });

  assert.equal(session.rounds[0]?.phase, 'reviewer-votes');
  assert.equal(session.rounds[0]?.reviewerPlans.writer?.planText, 'Check whether the wording stays concise.');

  session = recordCouncilReviewerVote(session, {
    reviewerParticipantId: 'critic',
    ballot: {
      reviewerParticipantId: 'critic',
      decision: 'reject',
      reason: 'Missing the key caveat.',
    },
  });

  assert.equal(session.rounds[0]?.phase, 'reviewer-votes');
  assert.equal(session.rounds[0]?.reviewerVotes.critic?.reason, 'Missing the key caveat.');

  session = recordCouncilReviewerVote(session, {
    reviewerParticipantId: 'writer',
    ballot: {
      reviewerParticipantId: 'writer',
      decision: 'accept',
    },
  });
  session = applyCouncilReviewBallots(session, Object.values(session.rounds[0]?.reviewerVotes ?? {}).map(vote => vote.ballot));

  assert.equal(session.rounds[0]?.phase, 'completed');
  assert.equal(session.status, 'drafting');
  assert.deepEqual(session.rounds[1]?.sharedRejectionReasons, ['Missing the key caveat.']);
});

test('leader and reviewer turn records preserve fragment snapshots for exact workflow rendering', () => {
  const leaderFragments = [
    createModelAuxVoidFragment('reasoning', 'Need to check the caveat first.'),
    create_FunctionCallInvocation_ContentFragment('tool-1', 'web_search', '{"q":"retry caveat"}'),
    createTextContentFragment('Final leader proposal.'),
  ];
  let session = recordCouncilProposal(createCouncilSessionState({
    phaseId: 'phase-fragments',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic'],
    maxRounds: 4,
  }), {
    proposalId: 'proposal-1',
    leaderParticipantId: 'leader',
    proposalText: 'Final leader proposal.',
    messageFragments: leaderFragments,
    messagePendingIncomplete: false,
  });

  const reviewerFragments = [
    createModelAuxVoidFragment('reasoning', 'The proposal still misses the retry caveat.'),
    createTextContentFragment('The proposal still misses the retry caveat.\n\n[[improve]] Mention the retry caveat.'),
  ];
  session = recordCouncilReviewerTurn(session, {
    reviewerParticipantId: 'critic',
    fragmentTexts: [
      'The proposal still misses the retry caveat.',
      '',
      '[[improve]] Mention the retry caveat.',
    ],
    messageFragments: reviewerFragments,
    messagePendingIncomplete: true,
  });

  assert.deepEqual(session.rounds[0]?.leaderTurn?.messageFragments.map(fragment => fragment.part.pt), ['ma', 'tool_invocation', 'text']);
  assert.equal(session.rounds[0]?.leaderTurn?.messagePendingIncomplete, false);
  assert.deepEqual(session.rounds[0]?.reviewerTurns.critic?.messageFragments.map(fragment => fragment.part.pt), ['ma', 'text']);
  assert.equal(session.rounds[0]?.reviewerTurns.critic?.messagePendingIncomplete, true);
  assert.notEqual(session.rounds[0]?.leaderTurn?.messageFragments, leaderFragments);
  assert.notEqual(session.rounds[0]?.reviewerTurns.critic?.messageFragments, reviewerFragments);
  assert.equal(session.rounds[0]?.leaderTurn?.messageFragments[0]?.fId, leaderFragments[0]?.fId);
  assert.equal(session.rounds[0]?.reviewerTurns.critic?.messageFragments[0]?.fId, reviewerFragments[0]?.fId);
});

test('recording a reviewer turn without a terminal verdict produces a synthetic rejection', () => {
  const session = recordCouncilProposal(createCouncilSessionState({
    phaseId: 'phase-turns',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic'],
    maxRounds: 3,
  }), {
    proposalId: 'proposal-1',
    leaderParticipantId: 'leader',
    proposalText: 'Answer.',
  });

  const nextSession = recordCouncilReviewerTurn(session, {
    reviewerParticipantId: 'critic',
    fragmentTexts: [
      'I do not think this is ready yet.',
    ],
  });

  assert.equal(nextSession.rounds[0]?.reviewerTurns?.critic?.terminalAction, 'reject');
  assert.equal(nextSession.rounds[0]?.reviewerTurns?.critic?.terminalReason, 'I do not think this is ready yet.');
  assert.equal(nextSession.rounds[0]?.reviewerTurns?.critic?.deliberationText, 'I do not think this is ready yet.');
});

test('agent turn events preserve append order', () => {
  let session = createCouncilSessionState({
    phaseId: 'phase-events',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic'],
    maxRounds: 3,
  });

  session = appendCouncilAgentTurnEvent(session, {
    roundIndex: 0,
    participantId: 'leader',
    role: 'leader',
    event: { type: 'text-output', text: 'First thought.' },
  });
  session = appendCouncilAgentTurnEvent(session, {
    roundIndex: 0,
    participantId: 'leader',
    role: 'leader',
    event: { type: 'text-output', text: 'Second thought.' },
  });

  assert.deepEqual(session.rounds[0]?.leaderTurn?.events.map(event => event.type === 'text-output' ? event.text : null), [
    'First thought.',
    'Second thought.',
  ]);
});

test('explicit deliberation marker keeps leader text on the board', () => {
  const result = classifyCouncilTextFragments([
    '[[deliberation]] Hold the line on the shorter answer.',
  ], true);

  assert.equal(result.action, 'deliberation');
  assert.equal(result.response, '');
  assert.equal(result.deliberationText, 'Hold the line on the shorter answer.');
});

test('leader keeps prefixed deliberation on the board instead of turning it into a final response', () => {
  const result = classifyCouncilTextFragments([
    '[Council deliberation] We still disagree on the tradeoff. Tighten the answer first.',
  ], true);

  assert.equal(result.action, 'deliberation');
  assert.equal(result.response, '');
  assert.equal(result.deliberationText, 'We still disagree on the tradeoff. Tighten the answer first.');
});

test('leader proposal marker becomes an explicit proposal response', () => {
  const result = classifyCouncilTextFragments([
    '[[proposal]] Here is the final user-facing answer.',
  ], true);

  assert.equal(result.action, 'proposal');
  assert.equal(result.response, 'Here is the final user-facing answer.');
  assert.equal(result.deliberationText, '');
});

test('non-leader accept marker becomes an explicit accept response', () => {
  const result = classifyCouncilTextFragments([
    '[[accept]] Final answer text.',
  ], false);

  assert.equal(result.action, 'accept');
  assert.equal(result.response, 'Final answer text.');
  assert.equal(result.deliberationText, '');
});

test('multi-fragment proposal strips marker and joins text blocks', () => {
  const result = classifyCouncilTextFragments([
    '[[proposal]] Final answer title.',
    '',
    'Supporting sentence with details.',
  ], true);

  assert.equal(result.action, 'proposal');
  assert.equal(result.response, 'Final answer title.\n\nSupporting sentence with details.');
  assert.equal(result.deliberationText, '');
});

test('non-leader revise marker stays as deliberation with no response', () => {
  const result = classifyCouncilTextFragments([
    '[[revise]] Mention the retry limit and keep the answer shorter.',
  ], false);

  assert.equal(result.action, 'revise');
  assert.equal(result.response, '');
  assert.equal(result.deliberationText, 'Mention the retry limit and keep the answer shorter.');
});

test('non-leader plain text without marker defaults to revise deliberation', () => {
  const result = classifyCouncilTextFragments([
    'I support the current draft with one edit.',
  ], false);

  assert.equal(result.action, 'revise');
  assert.equal(result.response, '');
  assert.equal(result.deliberationText, 'I support the current draft with one edit.');
});

test('non-leader proposal marker is downgraded to revise deliberation', () => {
  const result = classifyCouncilTextFragments([
    '[[proposal]] This should not become a final answer.',
  ], false);

  assert.equal(result.action, 'revise');
  assert.equal(result.response, '');
  assert.equal(result.deliberationText, 'This should not become a final answer.');
});

test('leader accept marker is downgraded to deliberation', () => {
  const result = classifyCouncilTextFragments([
    '[[accept]] I approve the current draft.',
  ], true);

  assert.equal(result.action, 'deliberation');
  assert.equal(result.response, '');
  assert.equal(result.deliberationText, 'I approve the current draft.');
});

test('leader plain text without marker falls back to proposal for backward compatibility', () => {
  const result = classifyCouncilTextFragments([
    'Here is the final user-facing answer.',
  ], true);

  assert.equal(result.action, 'proposal');
  assert.equal(result.response, 'Here is the final user-facing answer.');
  assert.equal(result.deliberationText, '');
});

test('proposal plus matching accepts reaches council', () => {
  const result = evaluateCouncilPass([
    { participantId: 'leader', isLeader: true, action: 'proposal', response: 'Answer text.' },
    { participantId: 'critic', isLeader: false, action: 'accept', response: 'Answer text.' },
    { participantId: 'writer', isLeader: false, action: 'accept', response: 'Answer text.' },
  ]);

  assert.equal(result.hasCouncil, true);
  assert.equal(result.agreedResponse, 'Answer text.');
});

test('whitespace and case differences still count as acceptance of the same proposal', () => {
  const result = evaluateCouncilPass([
    { participantId: 'leader', isLeader: true, action: 'proposal', response: 'Answer text.' },
    { participantId: 'critic', isLeader: false, action: 'accept', response: '  answer   TEXT.  ' },
    { participantId: 'writer', isLeader: false, action: 'accept', response: 'Answer text.' },
  ]);

  assert.equal(result.hasCouncil, true);
  assert.equal(result.agreedResponse, 'Answer text.');
});

test('revise keeps the pass open even with a leader proposal', () => {
  const result = evaluateCouncilPass([
    { participantId: 'leader', isLeader: true, action: 'proposal', response: 'Answer text.' },
    { participantId: 'critic', isLeader: false, action: 'accept', response: 'Answer text.' },
    { participantId: 'writer', isLeader: false, action: 'revise', response: '' },
  ]);

  assert.equal(result.hasCouncil, false);
  assert.equal(result.agreedResponse, null);
});

test('mismatched accept text does not reach council', () => {
  const result = evaluateCouncilPass([
    { participantId: 'leader', isLeader: true, action: 'proposal', response: 'Answer text.' },
    { participantId: 'critic', isLeader: false, action: 'accept', response: 'Different answer text.' },
  ]);

  assert.equal(result.hasCouncil, false);
  assert.equal(result.agreedResponse, null);
});

test('missing leader proposal does not reach council even if everyone accepts', () => {
  const result = evaluateCouncilPass([
    { participantId: 'leader', isLeader: true, action: 'deliberation', response: '' },
    { participantId: 'critic', isLeader: false, action: 'accept', response: 'Answer text.' },
    { participantId: 'writer', isLeader: false, action: 'accept', response: 'Answer text.' },
  ]);

  assert.equal(result.hasCouncil, false);
  assert.equal(result.agreedResponse, null);
});

test('empty leader proposal does not reach council', () => {
  const result = evaluateCouncilPass([
    { participantId: 'leader', isLeader: true, action: 'proposal', response: '   ' },
    { participantId: 'critic', isLeader: false, action: 'accept', response: 'Answer text.' },
  ]);

  assert.equal(result.hasCouncil, false);
  assert.equal(result.agreedResponse, null);
});

test('single-leader council can finalize immediately when a proposal exists', () => {
  const result = evaluateCouncilPass([
    { participantId: 'leader', isLeader: true, action: 'proposal', response: 'Answer text.' },
  ]);

  assert.equal(result.hasCouncil, true);
  assert.equal(result.agreedResponse, 'Answer text.');
});

test('resume advances to the next pass when every participant already posted in the stored pass', () => {
  const result = getCouncilResumePassIndex({
    initialPassIndex: 2,
    participantIds: ['leader', 'devil'],
    spokenParticipantIdsByPass: new Map([
      [2, new Set(['leader', 'devil'])],
    ]),
    maxPasses: 12,
  });

  assert.equal(result, 3);
});

test('resume stays on the same pass when at least one participant is still missing', () => {
  const result = getCouncilResumePassIndex({
    initialPassIndex: 2,
    participantIds: ['leader', 'devil'],
    spokenParticipantIdsByPass: new Map([
      [2, new Set(['leader'])],
    ]),
    maxPasses: 12,
  });

  assert.equal(result, 2);
});

test('resume skips over multiple completed passes until it finds an incomplete pass', () => {
  const result = getCouncilResumePassIndex({
    initialPassIndex: 2,
    participantIds: ['leader', 'devil'],
    spokenParticipantIdsByPass: new Map([
      [2, new Set(['leader', 'devil'])],
      [3, new Set(['leader', 'devil'])],
      [4, new Set(['leader'])],
    ]),
    maxPasses: 12,
  });

  assert.equal(result, 4);
});

test('resume keeps the initial pass when there are no participants', () => {
  const result = getCouncilResumePassIndex({
    initialPassIndex: 5,
    participantIds: [],
    spokenParticipantIdsByPass: new Map(),
    maxPasses: 12,
  });

  assert.equal(result, 5);
});

test('transcript hydration restores an accepted second-round proposal verbatim', () => {
  const session = hydrateCouncilSessionFromTranscriptEntries({
    phaseId: 'phase-1',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 4,
    entries: [
      { roundIndex: 0, participantId: 'leader', action: 'proposal', messageId: 'proposal-1', text: 'Draft one.' },
      { roundIndex: 0, participantId: 'critic', action: 'reject', messageId: 'critic-r1', text: 'Improve(): Missing the caveat.', reason: 'Missing the caveat.' },
      { roundIndex: 0, participantId: 'writer', action: 'accept', messageId: 'writer-a1', text: 'Accept' },
      { roundIndex: 1, participantId: 'leader', action: 'proposal', messageId: 'proposal-2', text: 'Draft two with caveat.' },
      { roundIndex: 1, participantId: 'critic', action: 'accept', messageId: 'critic-a2', text: 'Accept' },
      { roundIndex: 1, participantId: 'writer', action: 'accept', messageId: 'writer-a2', text: 'Accept' },
    ],
  });

  assert.equal(session.status, 'accepted');
  assert.equal(session.roundIndex, 1);
  assert.equal(session.acceptedProposalId, 'proposal-2');
  assert.equal(session.finalResponse, 'Draft two with caveat.');
  assert.deepEqual(session.rounds[1]?.sharedRejectionReasons, ['Missing the caveat.']);
});

test('transcript hydration keeps a partially reviewed round in reviewing state', () => {
  const session = hydrateCouncilSessionFromTranscriptEntries({
    phaseId: 'phase-1',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 4,
    entries: [
      { roundIndex: 0, participantId: 'leader', action: 'proposal', messageId: 'proposal-1', text: 'Draft one.' },
      { roundIndex: 0, participantId: 'critic', action: 'accept', messageId: 'critic-a1', text: 'Accept' },
    ],
  });

  assert.equal(session.status, 'reviewing');
  assert.equal(session.roundIndex, 0);
  assert.equal(session.rounds[0]?.proposalId, 'proposal-1');
  assert.deepEqual(session.rounds[0]?.ballots, [{
    reviewerParticipantId: 'critic',
    decision: 'accept',
  }]);
});

test('transcript hydration carries forward all rejection reasons into the next drafting round', () => {
  const session = hydrateCouncilSessionFromTranscriptEntries({
    phaseId: 'phase-1',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 4,
    entries: [
      { roundIndex: 0, participantId: 'leader', action: 'proposal', messageId: 'proposal-1', text: 'Draft one.' },
      { roundIndex: 0, participantId: 'critic', action: 'reject', messageId: 'critic-r1', text: 'Improve(): Missing the caveat.', reason: 'Missing the caveat.' },
      { roundIndex: 0, participantId: 'writer', action: 'reject', messageId: 'writer-r1', text: 'Improve(): Too long.', reason: 'Too long.' },
    ],
  });

  assert.equal(session.status, 'drafting');
  assert.equal(session.roundIndex, 1);
  assert.equal(session.rounds[1]?.proposalText, null);
  assert.deepEqual(session.rounds[1]?.sharedRejectionReasons, [
    'Missing the caveat.',
    'Too long.',
  ]);
});

test('transcript hydration keeps the latest ballot per reviewer when duplicates exist', () => {
  const session = hydrateCouncilSessionFromTranscriptEntries({
    phaseId: 'phase-1',
    leaderParticipantId: 'leader',
    reviewerParticipantIds: ['critic', 'writer'],
    maxRounds: 4,
    entries: [
      { roundIndex: 0, participantId: 'leader', action: 'proposal', messageId: 'proposal-1', text: 'Draft one.' },
      { roundIndex: 0, participantId: 'critic', action: 'reject', messageId: 'critic-r1', text: 'Improve(): Missing the caveat.', reason: 'Missing the caveat.' },
      { roundIndex: 0, participantId: 'critic', action: 'accept', messageId: 'critic-a1', text: 'Accept' },
      { roundIndex: 0, participantId: 'writer', action: 'accept', messageId: 'writer-a1', text: 'Accept' },
    ],
  });

  assert.equal(session.status, 'accepted');
  assert.deepEqual(session.rounds[0]?.ballots, [
    {
      reviewerParticipantId: 'critic',
      decision: 'accept',
    },
    {
      reviewerParticipantId: 'writer',
      decision: 'accept',
    },
  ]);
});
