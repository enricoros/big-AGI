export const CONSENSUS_TRANSCRIPT_PREFIX = '[Consensus deliberation]';
const CONSENSUS_TRANSCRIPT_PREFIX_PATTERN = /^\[Consensus deliberation\]\s*/i;
const CONSENSUS_PROTOCOL_PATTERN = /^\[\[(proposal|accept|revise|deliberation)\]\]\s*/i;
const COUNCIL_REVIEW_BALLOT_PATTERN = /^\[\[(accept|reject)\]\]\s*(.*)$/i;

export type ConsensusProtocolAction = 'deliberation' | 'proposal' | 'accept' | 'revise';

export type ConsensusPassEntry = {
  participantId: string;
  isLeader: boolean;
  action: ConsensusProtocolAction;
  response: string;
};

export type CouncilBallotDecision = 'accept' | 'reject';

export type CouncilBallotRecord = {
  reviewerParticipantId: string;
  decision: CouncilBallotDecision;
  reason?: string;
};

export type CouncilTranscriptEntry = {
  roundIndex: number;
  participantId: string;
  action: 'proposal' | 'accept' | 'reject';
  messageId: string;
  text: string;
  reason?: string;
};

export type CouncilAgentTurnEvent =
  | {
    type: 'text-output';
    createdAt: number;
    text: string;
  }
  | {
    type: 'terminal';
    createdAt: number;
    action: 'proposal' | 'accept' | 'reject';
    text: string;
    reason: string | null;
  };

export type CouncilAgentTurnRecord = {
  participantId: string;
  roundIndex: number;
  role: 'leader' | 'reviewer';
  deliberationText: string;
  terminalAction: 'proposal' | 'accept' | 'reject' | null;
  terminalText: string;
  terminalReason: string | null;
  events: CouncilAgentTurnEvent[];
};

export type CouncilRoundRecord = {
  roundIndex: number;
  proposalId: string | null;
  proposalText: string | null;
  leaderParticipantId: string;
  ballots: CouncilBallotRecord[];
  sharedRejectionReasons: string[];
  leaderTurn: CouncilAgentTurnRecord | null;
  reviewerTurns: Record<string, CouncilAgentTurnRecord>;
  completedAt: number | null;
};

export type CouncilSessionState = {
  status: 'drafting' | 'reviewing' | 'accepted' | 'exhausted' | 'interrupted';
  phaseId: string;
  roundIndex: number;
  maxRounds: number;
  leaderParticipantId: string;
  reviewerParticipantIds: string[];
  rounds: CouncilRoundRecord[];
  acceptedProposalId: string | null;
  finalResponse: string | null;
  interruptionReason: string | null;
  updatedAt: number;
};

export function createCouncilSessionState(params: {
  phaseId: string;
  leaderParticipantId: string;
  reviewerParticipantIds: string[];
  maxRounds: number;
}): CouncilSessionState {
  return {
    status: 'drafting',
    phaseId: params.phaseId,
    roundIndex: 0,
    maxRounds: params.maxRounds,
    leaderParticipantId: params.leaderParticipantId,
    reviewerParticipantIds: [...params.reviewerParticipantIds],
    rounds: [{
      roundIndex: 0,
      proposalId: null,
      proposalText: null,
      leaderParticipantId: params.leaderParticipantId,
      ballots: [],
      sharedRejectionReasons: [],
      leaderTurn: null,
      reviewerTurns: {},
      completedAt: null,
    }],
    acceptedProposalId: null,
    finalResponse: null,
    interruptionReason: null,
    updatedAt: Date.now(),
  };
}

export function recordCouncilProposal(session: CouncilSessionState, proposal: {
  proposalId: string;
  leaderParticipantId: string;
  proposalText: string;
}): CouncilSessionState {
  const proposalText = proposal.proposalText.trim();
  const nextRounds = session.rounds.map(round => round.roundIndex !== session.roundIndex
    ? round
    : {
      ...round,
      proposalId: proposal.proposalId,
      proposalText,
      leaderParticipantId: proposal.leaderParticipantId,
      ballots: [],
      leaderTurn: {
        participantId: proposal.leaderParticipantId,
        roundIndex: round.roundIndex,
        role: 'leader',
        deliberationText: '',
        terminalAction: 'proposal',
        terminalText: proposalText,
        terminalReason: null,
        events: [{
          type: 'terminal',
          createdAt: Date.now(),
          action: 'proposal',
          text: proposalText,
          reason: null,
        }],
      },
      completedAt: null,
    });

  return {
    ...session,
    status: 'reviewing',
    rounds: nextRounds,
    updatedAt: Date.now(),
  };
}

export function applyCouncilReviewBallots(session: CouncilSessionState, ballots: readonly CouncilBallotRecord[]): CouncilSessionState {
  const currentRound = session.rounds[session.roundIndex];
  if (!currentRound)
    return session;

  const normalizedBallots = ballots.map(ballot => ballot.decision === 'reject'
    ? {
      reviewerParticipantId: ballot.reviewerParticipantId,
      decision: 'reject' as const,
      reason: ballot.reason?.trim() || 'review failed',
    }
    : {
      reviewerParticipantId: ballot.reviewerParticipantId,
      decision: 'accept' as const,
    });

  const completedRound: CouncilRoundRecord = {
    ...currentRound,
    ballots: normalizedBallots,
    completedAt: Date.now(),
  };

  const rejectionReasons = normalizedBallots
    .filter((ballot): ballot is CouncilBallotRecord & { decision: 'reject'; reason: string } => ballot.decision === 'reject' && !!ballot.reason)
    .map(ballot => ballot.reason);

  const nextRounds = session.rounds.map(round => round.roundIndex === completedRound.roundIndex ? completedRound : round);
  if (!rejectionReasons.length) {
    return {
      ...session,
      status: 'accepted',
      rounds: nextRounds,
      acceptedProposalId: completedRound.proposalId,
      finalResponse: completedRound.proposalText,
      updatedAt: Date.now(),
    };
  }

  if (session.roundIndex + 1 >= session.maxRounds) {
    return {
      ...session,
      status: 'exhausted',
      rounds: nextRounds,
      updatedAt: Date.now(),
    };
  }

  const nextRoundIndex = session.roundIndex + 1;
  const nextRound: CouncilRoundRecord = {
    roundIndex: nextRoundIndex,
    proposalId: null,
    proposalText: null,
    leaderParticipantId: session.leaderParticipantId,
    ballots: [],
    sharedRejectionReasons: [
      ...completedRound.sharedRejectionReasons,
      ...rejectionReasons,
    ],
    leaderTurn: null,
    reviewerTurns: {},
    completedAt: null,
  };

  return {
    ...session,
    status: 'drafting',
    roundIndex: nextRoundIndex,
    rounds: [...nextRounds, nextRound],
    updatedAt: Date.now(),
  };
}

export function hydrateCouncilSessionFromTranscriptEntries(params: {
  phaseId: string;
  leaderParticipantId: string;
  reviewerParticipantIds: string[];
  maxRounds: number;
  entries: readonly CouncilTranscriptEntry[];
}): CouncilSessionState {
  let session = createCouncilSessionState({
    phaseId: params.phaseId,
    leaderParticipantId: params.leaderParticipantId,
    reviewerParticipantIds: [...params.reviewerParticipantIds],
    maxRounds: params.maxRounds,
  });

  const roundIndexes = [...new Set(params.entries
    .map(entry => entry.roundIndex)
    .filter(roundIndex => Number.isInteger(roundIndex) && roundIndex >= 0))]
    .sort((a, b) => a - b);

  for (const roundIndex of roundIndexes) {
    if (session.roundIndex !== roundIndex)
      break;

    const roundEntries = params.entries.filter(entry => entry.roundIndex === roundIndex);
    const proposalEntry = [...roundEntries]
      .reverse()
      .find(entry => entry.participantId === params.leaderParticipantId && entry.action === 'proposal');
    if (!proposalEntry)
      break;

    session = recordCouncilProposal(session, {
      proposalId: proposalEntry.messageId,
      leaderParticipantId: params.leaderParticipantId,
      proposalText: proposalEntry.text,
    });

    const ballotByReviewerId = roundEntries.reduce((ballots, entry) => {
      if (entry.action !== 'accept' && entry.action !== 'reject')
        return ballots;
      if (!params.reviewerParticipantIds.includes(entry.participantId))
        return ballots;

      ballots.set(entry.participantId, entry.action === 'reject'
        ? {
            reviewerParticipantId: entry.participantId,
            decision: 'reject' as const,
            reason: entry.reason?.trim() || 'review failed',
          }
        : {
            reviewerParticipantId: entry.participantId,
            decision: 'accept' as const,
          });
      return ballots;
    }, new Map<string, CouncilBallotRecord>());

    const ballots = params.reviewerParticipantIds
      .map(reviewerParticipantId => ballotByReviewerId.get(reviewerParticipantId) ?? null)
      .filter((ballot): ballot is CouncilBallotRecord => !!ballot);

    if (ballots.length >= params.reviewerParticipantIds.length) {
      session = applyCouncilReviewBallots(session, ballots);
      if (session.status === 'accepted' || session.status === 'exhausted')
        break;
      continue;
    }

    session = {
      ...session,
      status: 'reviewing',
      rounds: session.rounds.map(round => round.roundIndex !== roundIndex
        ? round
        : {
            ...round,
            ballots,
          }),
      updatedAt: Date.now(),
    };
    break;
  }

  return session;
}

export function stripConsensusTranscriptPrefix(text: string): string {
  return text.replace(CONSENSUS_TRANSCRIPT_PREFIX_PATTERN, '').trim();
}

function stripConsensusProtocolPrefix(text: string): string {
  return text.replace(CONSENSUS_PROTOCOL_PATTERN, '').trim();
}

function getLastNonEmptyFragmentText(fragmentTexts: readonly string[]): string {
  return [...fragmentTexts]
    .map(text => text.trim())
    .filter(Boolean)
    .at(-1) ?? '';
}

function getLeadingFragmentTexts(fragmentTexts: readonly string[]): string[] {
  const normalizedTexts = fragmentTexts
    .map(text => text.trim())
    .filter(Boolean);
  if (normalizedTexts.length <= 1)
    return [];
  return normalizedTexts.slice(0, -1);
}

function createCouncilAgentTurnRecord(participantId: string, roundIndex: number, role: 'leader' | 'reviewer'): CouncilAgentTurnRecord {
  return {
    participantId,
    roundIndex,
    role,
    deliberationText: '',
    terminalAction: null,
    terminalText: '',
    terminalReason: null,
    events: [],
  };
}

export function extractCouncilProposalText(fragmentTexts: readonly string[]): string {
  return fragmentTexts
    .map(text => text.trim())
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

export function classifyCouncilReviewBallotFragments(fragmentTexts: readonly string[], reviewerParticipantId: string): CouncilBallotRecord {
  const ballotText = getLastNonEmptyFragmentText(fragmentTexts);
  const ballotMatch = ballotText.match(COUNCIL_REVIEW_BALLOT_PATTERN);
  if (!ballotMatch)
    return {
      reviewerParticipantId,
      decision: 'reject',
      reason: 'review failed',
    };

  const decision = ballotMatch[1]?.toLowerCase();
  const trailingText = ballotMatch[2]?.trim() || '';
  if (decision === 'accept') {
    return {
      reviewerParticipantId,
      decision: 'accept',
    };
  }

  return {
    reviewerParticipantId,
    decision: 'reject',
    reason: trailingText || 'review failed',
  };
}

export function classifyConsensusTextFragments(fragmentTexts: readonly string[], isLeader: boolean): {
  action: ConsensusProtocolAction;
  deliberationText: string;
  response: string;
} {
  const normalizedTexts = fragmentTexts
    .map(text => text.trim())
    .filter(Boolean);

  const leadingDeliberationText = getLeadingFragmentTexts(fragmentTexts)
    .map(text => stripConsensusTranscriptPrefix(stripConsensusProtocolPrefix(text)))
    .filter(Boolean)
    .join('\n\n')
    .trim();
  const terminalText = getLastNonEmptyFragmentText(fragmentTexts);
  const terminalProtocolAction = terminalText.match(CONSENSUS_PROTOCOL_PATTERN)?.[1]?.toLowerCase() as ConsensusProtocolAction | undefined;
  if (terminalProtocolAction) {
    const strippedTerminalText = stripConsensusTranscriptPrefix(stripConsensusProtocolPrefix(terminalText));

    if (isLeader) {
      if (terminalProtocolAction === 'proposal')
        return {
          action: 'proposal',
          deliberationText: leadingDeliberationText,
          response: strippedTerminalText,
        };
      if (terminalProtocolAction === 'accept')
        return {
          action: 'deliberation',
          deliberationText: [leadingDeliberationText, strippedTerminalText].filter(Boolean).join('\n\n'),
          response: '',
        };
    } else {
      if (terminalProtocolAction === 'accept')
        return {
          action: 'accept',
          deliberationText: leadingDeliberationText,
          response: strippedTerminalText,
        };
      if (terminalProtocolAction === 'proposal')
        return {
          action: 'revise',
          deliberationText: [leadingDeliberationText, strippedTerminalText].filter(Boolean).join('\n\n'),
          response: '',
        };
    }
  }

  const terminalBallotMatch = terminalText.match(COUNCIL_REVIEW_BALLOT_PATTERN);
  if (!isLeader && terminalBallotMatch?.[1]?.toLowerCase() === 'reject') {
    return {
      action: 'revise',
      deliberationText: [leadingDeliberationText, terminalBallotMatch[2]?.trim() || ''].filter(Boolean).join('\n\n'),
      response: '',
    };
  }

  const explicitProtocolAction = normalizedTexts
    .map(text => text.match(CONSENSUS_PROTOCOL_PATTERN)?.[1]?.toLowerCase() ?? null)
    .find((action): action is ConsensusProtocolAction => !!action);
  const isPrefixedDeliberation = normalizedTexts.some(text => CONSENSUS_TRANSCRIPT_PREFIX_PATTERN.test(text));
  const deliberationText = normalizedTexts
    .map(text => stripConsensusTranscriptPrefix(stripConsensusProtocolPrefix(text)))
    .join('\n\n')
    .trim();

  let action: ConsensusProtocolAction = explicitProtocolAction
    ?? (isPrefixedDeliberation ? 'deliberation' : isLeader ? 'proposal' : 'revise');

  if (!isLeader && action === 'proposal')
    action = 'revise';
  if (isLeader && action === 'accept')
    action = 'deliberation';

  const response = (action === 'proposal' || action === 'accept') && deliberationText
    ? deliberationText
    : '';

  return {
    action,
    deliberationText: response ? '' : deliberationText,
    response,
  };
}

export function appendCouncilAgentTurnEvent(session: CouncilSessionState, params: {
  roundIndex: number;
  participantId: string;
  role: 'leader' | 'reviewer';
  event: CouncilAgentTurnEvent;
}): CouncilSessionState {
  return {
    ...session,
    rounds: session.rounds.map(round => {
      if (round.roundIndex !== params.roundIndex)
        return round;

      if (params.role === 'leader') {
        const leaderTurn = round.leaderTurn ?? createCouncilAgentTurnRecord(params.participantId, round.roundIndex, 'leader');
        return {
          ...round,
          leaderTurn: {
            ...leaderTurn,
            events: [...leaderTurn.events, params.event],
          },
        };
      }

      const reviewerTurn = round.reviewerTurns[params.participantId] ?? createCouncilAgentTurnRecord(params.participantId, round.roundIndex, 'reviewer');
      return {
        ...round,
        reviewerTurns: {
          ...round.reviewerTurns,
          [params.participantId]: {
            ...reviewerTurn,
            events: [...reviewerTurn.events, params.event],
          },
        },
      };
    }),
    updatedAt: Date.now(),
  };
}

export function recordCouncilReviewerTurn(session: CouncilSessionState, params: {
  reviewerParticipantId: string;
  fragmentTexts: readonly string[];
}): CouncilSessionState {
  const currentRound = session.rounds[session.roundIndex];
  if (!currentRound)
    return session;

  const deliberation = classifyConsensusTextFragments(params.fragmentTexts, false);
  const ballot = classifyCouncilReviewBallotFragments(params.fragmentTexts, params.reviewerParticipantId);
  const existingTurn = currentRound.reviewerTurns[params.reviewerParticipantId]
    ?? createCouncilAgentTurnRecord(params.reviewerParticipantId, currentRound.roundIndex, 'reviewer');
  const now = Date.now();
  const events = [
    ...(deliberation.deliberationText ? [{
      type: 'text-output' as const,
      createdAt: now,
      text: deliberation.deliberationText,
    }] : []),
    {
      type: 'terminal' as const,
      createdAt: now,
      action: ballot.decision,
      text: ballot.decision === 'accept' ? deliberation.response : '',
      reason: ballot.decision === 'reject' ? ballot.reason ?? 'review failed' : null,
    },
  ];

  return {
    ...session,
    rounds: session.rounds.map(round => round.roundIndex !== session.roundIndex
      ? round
      : {
        ...round,
        ballots: [
          ...round.ballots.filter(existing => existing.reviewerParticipantId !== params.reviewerParticipantId),
          ballot,
        ],
        reviewerTurns: {
          ...round.reviewerTurns,
          [params.reviewerParticipantId]: {
            ...existingTurn,
            deliberationText: deliberation.deliberationText,
            terminalAction: ballot.decision,
            terminalText: ballot.decision === 'accept' ? deliberation.response : '',
            terminalReason: ballot.decision === 'reject' ? ballot.reason ?? 'review failed' : null,
            events,
          },
        },
      }),
    updatedAt: now,
  };
}

export function evaluateConsensusPass(entries: readonly ConsensusPassEntry[]): {
  hasConsensus: boolean;
  agreedResponse: string | null;
} {
  const leaderEntries = entries.filter(entry => entry.isLeader);
  const leaderProposal = leaderEntries.find(entry => entry.action === 'proposal' && !!entry.response.trim()) ?? null;
  if (!leaderProposal)
    return { hasConsensus: false, agreedResponse: null };

  const proposalSignature = getConsensusTextSignature(leaderProposal.response);
  if (!proposalSignature)
    return { hasConsensus: false, agreedResponse: null };

  const nonLeaderEntries = entries.filter(entry => !entry.isLeader);
  const allAccepted = nonLeaderEntries.every(entry =>
    entry.action === 'accept' && getConsensusTextSignature(entry.response) === proposalSignature);

  return {
    hasConsensus: allAccepted,
    agreedResponse: allAccepted ? leaderProposal.response.trim() : null,
  };
}

function getConsensusTextSignature(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function getConsensusResumePassIndex(params: {
  initialPassIndex: number;
  participantIds: readonly string[];
  spokenParticipantIdsByPass: ReadonlyMap<number, ReadonlySet<string>>;
  maxPasses: number;
}): number {
  const participantCount = params.participantIds.length;
  if (!participantCount)
    return params.initialPassIndex;

  let passIndex = params.initialPassIndex;
  while (passIndex < params.maxPasses) {
    const spokenParticipantIds = params.spokenParticipantIdsByPass.get(passIndex);
    if (!spokenParticipantIds || spokenParticipantIds.size < participantCount)
      return passIndex;
    passIndex++;
  }

  return params.initialPassIndex;
}
