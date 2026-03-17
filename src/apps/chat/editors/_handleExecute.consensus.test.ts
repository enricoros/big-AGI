import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyCouncilReviewBallots,
  appendCouncilAgentTurnEvent,
  classifyCouncilReviewBallotFragments,
  classifyConsensusTextFragments,
  createCouncilSessionState,
  extractCouncilProposalText,
  evaluateConsensusPass,
  getConsensusResumePassIndex,
  hydrateCouncilSessionFromTranscriptEntries,
  recordCouncilProposal,
  recordCouncilReviewerTurn,
} from './_handleExecute.consensus';

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

test('reviewer accept ballot parses without a rejection reason', () => {
  const ballot = classifyCouncilReviewBallotFragments([
    '[[accept]]',
  ], 'critic');

  assert.deepEqual(ballot, {
    reviewerParticipantId: 'critic',
    decision: 'accept',
  });
});

test('reviewer reject ballot requires and preserves a rejection reason', () => {
  const ballot = classifyCouncilReviewBallotFragments([
    '[[reject]] Missing the caveat about retries.',
  ], 'critic');

  assert.deepEqual(ballot, {
    reviewerParticipantId: 'critic',
    decision: 'reject',
    reason: 'Missing the caveat about retries.',
  });
});

test('invalid reviewer ballot becomes a synthetic rejection', () => {
  const ballot = classifyCouncilReviewBallotFragments([
    'I do not like this draft.',
  ], 'critic');

  assert.deepEqual(ballot, {
    reviewerParticipantId: 'critic',
    decision: 'reject',
    reason: 'review failed',
  });
});

test('leader freeform text before terminal proposal is preserved as deliberation text', () => {
  const result = classifyConsensusTextFragments([
    'Thinking through the tradeoff first.',
    '',
    '[[proposal]] Final user-facing answer.',
  ], true);

  assert.equal(result.action, 'proposal');
  assert.equal(result.response, 'Final user-facing answer.');
  assert.equal(result.deliberationText, 'Thinking through the tradeoff first.');
});

test('reviewer freeform text before terminal accept is preserved as deliberation text', () => {
  const result = classifyConsensusTextFragments([
    'I checked the caveat and the wording looks right.',
    '',
    '[[accept]]',
  ], false);

  assert.equal(result.action, 'accept');
  assert.equal(result.response, '');
  assert.equal(result.deliberationText, 'I checked the caveat and the wording looks right.');
});

test('reviewer freeform text before terminal reject is preserved while the reject reason remains terminal', () => {
  const result = classifyConsensusTextFragments([
    'The answer is close, but it misses one caveat.',
    '',
    '[[reject]] Missing the retry caveat.',
  ], false);

  assert.equal(result.action, 'revise');
  assert.equal(result.response, '');
  assert.equal(result.deliberationText, 'The answer is close, but it misses one caveat.\n\nMissing the retry caveat.');

  const ballot = classifyCouncilReviewBallotFragments([
    'The answer is close, but it misses one caveat.',
    '',
    '[[reject]] Missing the retry caveat.',
  ], 'critic');

  assert.deepEqual(ballot, {
    reviewerParticipantId: 'critic',
    decision: 'reject',
    reason: 'Missing the retry caveat.',
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
  assert.equal(nextSession.rounds[0]?.reviewerTurns?.critic?.terminalReason, 'review failed');
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
  const result = classifyConsensusTextFragments([
    '[[deliberation]] Hold the line on the shorter answer.',
  ], true);

  assert.equal(result.action, 'deliberation');
  assert.equal(result.response, '');
  assert.equal(result.deliberationText, 'Hold the line on the shorter answer.');
});

test('leader keeps prefixed deliberation on the board instead of turning it into a final response', () => {
  const result = classifyConsensusTextFragments([
    '[Consensus deliberation] We still disagree on the tradeoff. Tighten the answer first.',
  ], true);

  assert.equal(result.action, 'deliberation');
  assert.equal(result.response, '');
  assert.equal(result.deliberationText, 'We still disagree on the tradeoff. Tighten the answer first.');
});

test('leader proposal marker becomes an explicit proposal response', () => {
  const result = classifyConsensusTextFragments([
    '[[proposal]] Here is the final user-facing answer.',
  ], true);

  assert.equal(result.action, 'proposal');
  assert.equal(result.response, 'Here is the final user-facing answer.');
  assert.equal(result.deliberationText, '');
});

test('non-leader accept marker becomes an explicit accept response', () => {
  const result = classifyConsensusTextFragments([
    '[[accept]] Final answer text.',
  ], false);

  assert.equal(result.action, 'accept');
  assert.equal(result.response, 'Final answer text.');
  assert.equal(result.deliberationText, '');
});

test('multi-fragment proposal strips marker and joins text blocks', () => {
  const result = classifyConsensusTextFragments([
    '[[proposal]] Final answer title.',
    '',
    'Supporting sentence with details.',
  ], true);

  assert.equal(result.action, 'proposal');
  assert.equal(result.response, 'Final answer title.\n\nSupporting sentence with details.');
  assert.equal(result.deliberationText, '');
});

test('non-leader revise marker stays as deliberation with no response', () => {
  const result = classifyConsensusTextFragments([
    '[[revise]] Mention the retry limit and keep the answer shorter.',
  ], false);

  assert.equal(result.action, 'revise');
  assert.equal(result.response, '');
  assert.equal(result.deliberationText, 'Mention the retry limit and keep the answer shorter.');
});

test('non-leader plain text without marker defaults to revise deliberation', () => {
  const result = classifyConsensusTextFragments([
    'I support the current draft with one edit.',
  ], false);

  assert.equal(result.action, 'revise');
  assert.equal(result.response, '');
  assert.equal(result.deliberationText, 'I support the current draft with one edit.');
});

test('non-leader proposal marker is downgraded to revise deliberation', () => {
  const result = classifyConsensusTextFragments([
    '[[proposal]] This should not become a final answer.',
  ], false);

  assert.equal(result.action, 'revise');
  assert.equal(result.response, '');
  assert.equal(result.deliberationText, 'This should not become a final answer.');
});

test('leader accept marker is downgraded to deliberation', () => {
  const result = classifyConsensusTextFragments([
    '[[accept]] I approve the current draft.',
  ], true);

  assert.equal(result.action, 'deliberation');
  assert.equal(result.response, '');
  assert.equal(result.deliberationText, 'I approve the current draft.');
});

test('leader plain text without marker falls back to proposal for backward compatibility', () => {
  const result = classifyConsensusTextFragments([
    'Here is the final user-facing answer.',
  ], true);

  assert.equal(result.action, 'proposal');
  assert.equal(result.response, 'Here is the final user-facing answer.');
  assert.equal(result.deliberationText, '');
});

test('proposal plus matching accepts reaches consensus', () => {
  const result = evaluateConsensusPass([
    { participantId: 'leader', isLeader: true, action: 'proposal', response: 'Answer text.' },
    { participantId: 'critic', isLeader: false, action: 'accept', response: 'Answer text.' },
    { participantId: 'writer', isLeader: false, action: 'accept', response: 'Answer text.' },
  ]);

  assert.equal(result.hasConsensus, true);
  assert.equal(result.agreedResponse, 'Answer text.');
});

test('whitespace and case differences still count as acceptance of the same proposal', () => {
  const result = evaluateConsensusPass([
    { participantId: 'leader', isLeader: true, action: 'proposal', response: 'Answer text.' },
    { participantId: 'critic', isLeader: false, action: 'accept', response: '  answer   TEXT.  ' },
    { participantId: 'writer', isLeader: false, action: 'accept', response: 'Answer text.' },
  ]);

  assert.equal(result.hasConsensus, true);
  assert.equal(result.agreedResponse, 'Answer text.');
});

test('revise keeps the pass open even with a leader proposal', () => {
  const result = evaluateConsensusPass([
    { participantId: 'leader', isLeader: true, action: 'proposal', response: 'Answer text.' },
    { participantId: 'critic', isLeader: false, action: 'accept', response: 'Answer text.' },
    { participantId: 'writer', isLeader: false, action: 'revise', response: '' },
  ]);

  assert.equal(result.hasConsensus, false);
  assert.equal(result.agreedResponse, null);
});

test('mismatched accept text does not reach consensus', () => {
  const result = evaluateConsensusPass([
    { participantId: 'leader', isLeader: true, action: 'proposal', response: 'Answer text.' },
    { participantId: 'critic', isLeader: false, action: 'accept', response: 'Different answer text.' },
  ]);

  assert.equal(result.hasConsensus, false);
  assert.equal(result.agreedResponse, null);
});

test('missing leader proposal does not reach consensus even if everyone accepts', () => {
  const result = evaluateConsensusPass([
    { participantId: 'leader', isLeader: true, action: 'deliberation', response: '' },
    { participantId: 'critic', isLeader: false, action: 'accept', response: 'Answer text.' },
    { participantId: 'writer', isLeader: false, action: 'accept', response: 'Answer text.' },
  ]);

  assert.equal(result.hasConsensus, false);
  assert.equal(result.agreedResponse, null);
});

test('empty leader proposal does not reach consensus', () => {
  const result = evaluateConsensusPass([
    { participantId: 'leader', isLeader: true, action: 'proposal', response: '   ' },
    { participantId: 'critic', isLeader: false, action: 'accept', response: 'Answer text.' },
  ]);

  assert.equal(result.hasConsensus, false);
  assert.equal(result.agreedResponse, null);
});

test('single-leader consensus can finalize immediately when a proposal exists', () => {
  const result = evaluateConsensusPass([
    { participantId: 'leader', isLeader: true, action: 'proposal', response: 'Answer text.' },
  ]);

  assert.equal(result.hasConsensus, true);
  assert.equal(result.agreedResponse, 'Answer text.');
});

test('resume advances to the next pass when every participant already posted in the stored pass', () => {
  const result = getConsensusResumePassIndex({
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
  const result = getConsensusResumePassIndex({
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
  const result = getConsensusResumePassIndex({
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
  const result = getConsensusResumePassIndex({
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
      { roundIndex: 0, participantId: 'critic', action: 'reject', messageId: 'critic-r1', text: 'Reject: Missing the caveat.', reason: 'Missing the caveat.' },
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
      { roundIndex: 0, participantId: 'critic', action: 'reject', messageId: 'critic-r1', text: 'Reject: Missing the caveat.', reason: 'Missing the caveat.' },
      { roundIndex: 0, participantId: 'writer', action: 'reject', messageId: 'writer-r1', text: 'Reject: Too long.', reason: 'Too long.' },
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
      { roundIndex: 0, participantId: 'critic', action: 'reject', messageId: 'critic-r1', text: 'Reject: Missing the caveat.', reason: 'Missing the caveat.' },
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
