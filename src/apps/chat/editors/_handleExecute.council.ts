import type { DMessageFragment } from '~/common/stores/chat/chat.fragments';
import { isErrorPart, isTextContentFragment, isVoidThinkingFragment } from '~/common/stores/chat/chat.fragments';

export const COUNCIL_TRANSCRIPT_PREFIX = '[Council deliberation]';
export const COUNCIL_INTERRUPTION_REASON_INVALID_PROPOSAL = 'leader-invalid-proposal';
export const COUNCIL_INVALID_PROPOSAL_TEXT = 'Leader failed to produce a valid proposal.';
export const COUNCIL_REVIEW_FAILED_REASON = 'review failed';
export const COUNCIL_REVIEW_VERDICT_MISSING_REASON = 'review verdict missing';
export const COUNCIL_REVIEW_ANALYSIS_MISSING_REASON = 'review analysis missing';
const COUNCIL_TRANSCRIPT_PREFIX_PATTERN = /^\[Council deliberation\]\s*/i;
const LEGACY_CONSENSUS_TRANSCRIPT_PREFIX_PATTERN = /^\[Consensus deliberation\]\s*/i;
const COUNCIL_PROTOCOL_PATTERN = /^\[\[(proposal|accept|revise|deliberation)\]\]\s*/i;
const COUNCIL_REVIEW_BALLOT_PATTERN = /^\[\[(accept|improve)\]\]\s*(.*)$/i;
const INLINE_COUNCIL_PROTOCOL_PATTERN = /^(?<leading>[\s\S]*?)\[\[(?<action>proposal|accept|revise|deliberation)\]\]\s*(?<trailing>[\s\S]*)$/i;
const INLINE_COUNCIL_REVIEW_BALLOT_PATTERN = /^(?<leading>[\s\S]*?)\[\[(?<decision>accept|improve)\]\]\s*(?<trailing>[\s\S]*)$/i;

export type CouncilProtocolAction = 'deliberation' | 'proposal' | 'accept' | 'revise';

export type CouncilPassEntry = {
  participantId: string;
  isLeader: boolean;
  action: CouncilProtocolAction;
  response: string;
};

export type CouncilBallotDecision = 'accept' | 'reject';

export type CouncilBallotRecord = {
  reviewerParticipantId: string;
  decision: CouncilBallotDecision;
  reason?: string;
};

export type CouncilRoundPhase = 'leader-proposal' | 'reviewer-plans' | 'reviewer-votes' | 'completed';

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
  initialDraftText: string;
  deliberationText: string;
  terminalAction: 'proposal' | 'accept' | 'reject' | null;
  terminalText: string;
  terminalReason: string | null;
  messageFragments: DMessageFragment[];
  messagePendingIncomplete: boolean;
  events: CouncilAgentTurnEvent[];
};

export type CouncilProposalRecord = {
  proposalId: string;
  leaderParticipantId: string;
  proposalText: string;
  messageFragments: DMessageFragment[];
  messagePendingIncomplete: boolean;
  events: CouncilAgentTurnEvent[];
  createdAt: number;
};

export type CouncilReviewerPlanRecord = {
  reviewerParticipantId: string;
  planText: string;
  messageFragments: DMessageFragment[];
  messagePendingIncomplete: boolean;
  events: CouncilAgentTurnEvent[];
  createdAt: number;
};

export type CouncilReviewerVoteRecord = {
  reviewerParticipantId: string;
  ballot: CouncilBallotRecord;
  reason: string | null;
  messageFragments: DMessageFragment[];
  messagePendingIncomplete: boolean;
  events: CouncilAgentTurnEvent[];
  createdAt: number;
};

export type CouncilRoundRecord = {
  roundIndex: number;
  phase: CouncilRoundPhase;
  proposalId: string | null;
  proposalText: string | null;
  leaderParticipantId: string;
  ballots: CouncilBallotRecord[];
  sharedRejectionReasons: string[];
  leaderTurn: CouncilAgentTurnRecord | null;
  reviewerTurns: Record<string, CouncilAgentTurnRecord>;
  leaderProposal: CouncilProposalRecord | null;
  reviewerPlans: Record<string, CouncilReviewerPlanRecord>;
  reviewerVotes: Record<string, CouncilReviewerVoteRecord>;
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

function councilFragmentsHaveErrors(messageFragments: readonly DMessageFragment[] | null | undefined): boolean {
  return (messageFragments ?? []).some(fragment => fragment.ft === 'content' && isErrorPart(fragment.part));
}

function councilFragmentsHaveVisibleText(messageFragments: readonly DMessageFragment[] | null | undefined): boolean {
  return (messageFragments ?? []).some(fragment => isTextContentFragment(fragment) && !!fragment.part.text.trim());
}

function mergeCouncilMessageSnapshotFragments(
  previousFragments: readonly DMessageFragment[] | null | undefined,
  nextFragments: readonly DMessageFragment[] | null | undefined,
): DMessageFragment[] {
  const clonedNextFragments = cloneCouncilMessageFragments(nextFragments);
  const clonedPreviousFragments = cloneCouncilMessageFragments(previousFragments);
  const previousTextFragments = clonedPreviousFragments.filter(isTextContentFragment);
  const nextNonTextFragments = clonedNextFragments.filter(fragment => !isTextContentFragment(fragment));

  if (!previousTextFragments.length)
    return clonedNextFragments;

  const nextTextFragments = clonedNextFragments.filter(isTextContentFragment);
  if (!nextTextFragments.length)
    return [
      ...previousTextFragments,
      ...nextNonTextFragments.filter(fragment => !isVoidThinkingFragment(fragment)),
    ];

  const previousText = previousTextFragments.map(fragment => fragment.part.text).join('\n\n').trim();
  const nextText = nextTextFragments.map(fragment => fragment.part.text).join('\n\n').trim();

  if (previousText && nextText && (
    previousText === nextText
    || (previousText.length > nextText.length && previousText.startsWith(nextText))
  )) {
    return [
      ...previousTextFragments,
      ...nextNonTextFragments.filter(fragment => !isVoidThinkingFragment(fragment)),
    ];
  }

  return clonedNextFragments;
}

export function doesCouncilRoundNeedLeaderProposal(round: CouncilRoundRecord | null | undefined): boolean {
  if (!round)
    return true;

  if (round.phase === 'leader-proposal')
    return true;

  if (!round.proposalId || !round.proposalText?.trim())
    return true;

  if (!round.leaderProposal?.proposalText?.trim())
    return true;

  if (round.leaderTurn?.terminalAction !== 'proposal')
    return true;

  if (round.leaderProposal.messagePendingIncomplete || round.leaderTurn?.messagePendingIncomplete)
    return true;

  return councilFragmentsHaveErrors(round.leaderProposal.messageFragments)
    || councilFragmentsHaveErrors(round.leaderTurn?.messageFragments);
}

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
    rounds: [createCouncilRoundRecord(0, params.leaderParticipantId)],
    acceptedProposalId: null,
    finalResponse: null,
    interruptionReason: null,
    updatedAt: Date.now(),
  };
}

function createCouncilRoundRecord(roundIndex: number, leaderParticipantId: string, sharedRejectionReasons: string[] = []): CouncilRoundRecord {
  return {
    roundIndex,
    phase: 'leader-proposal',
    proposalId: null,
    proposalText: null,
    leaderParticipantId,
    ballots: [],
    sharedRejectionReasons,
    leaderTurn: null,
    reviewerTurns: {},
    leaderProposal: null,
    reviewerPlans: {},
    reviewerVotes: {},
    completedAt: null,
  };
}

function normalizeCouncilBallot(ballot: CouncilBallotRecord): CouncilBallotRecord {
  return ballot.decision === 'reject'
    ? {
        reviewerParticipantId: ballot.reviewerParticipantId,
        decision: 'reject',
        ...(ballot.reason?.trim() ? { reason: ballot.reason.trim() } : {}),
      }
    : {
        reviewerParticipantId: ballot.reviewerParticipantId,
        decision: 'accept',
      };
}

function getRoundPlanPhase(round: CouncilRoundRecord, reviewerParticipantIds: readonly string[]): CouncilRoundPhase {
  if (round.phase === 'reviewer-votes' || round.phase === 'completed')
    return round.phase;

  const completedPlans = reviewerParticipantIds.filter(reviewerParticipantId => !!round.reviewerPlans[reviewerParticipantId]).length;
  return completedPlans >= reviewerParticipantIds.length
    ? 'reviewer-votes'
    : 'reviewer-plans';
}

export function recordCouncilProposal(session: CouncilSessionState, proposal: {
  proposalId: string;
  leaderParticipantId: string;
  proposalText: string;
  deliberationText?: string;
  messageFragments?: readonly DMessageFragment[];
  messagePendingIncomplete?: boolean;
}): CouncilSessionState {
  const now = Date.now();
  const proposalText = proposal.proposalText.trim();
  const deliberationText = proposal.deliberationText?.trim() || '';
  const nextRounds: CouncilRoundRecord[] = session.rounds.map(round => round.roundIndex !== session.roundIndex
    ? round
    : (() => {
      const existingLeaderTurn = round.leaderTurn ?? createCouncilAgentTurnRecord(proposal.leaderParticipantId, round.roundIndex, 'leader');
      const nextEvents = [...existingLeaderTurn.events];
      const lastTextOutput = [...nextEvents]
        .reverse()
        .find((event): event is Extract<CouncilAgentTurnEvent, { type: 'text-output' }> => event.type === 'text-output');
      if (deliberationText && lastTextOutput?.text !== deliberationText) {
        nextEvents.push({
          type: 'text-output',
          createdAt: now,
          text: deliberationText,
        });
      }
      nextEvents.push({
        type: 'terminal',
        createdAt: now,
        action: 'proposal',
        text: proposalText,
        reason: null,
      });

      const nextRound: CouncilRoundRecord = {
        ...round,
        phase: 'reviewer-votes',
        proposalId: proposal.proposalId,
        proposalText,
        leaderParticipantId: proposal.leaderParticipantId,
        ballots: [],
        leaderProposal: {
          proposalId: proposal.proposalId,
          leaderParticipantId: proposal.leaderParticipantId,
          proposalText,
          messageFragments: proposal.messageFragments ? cloneCouncilMessageFragments(proposal.messageFragments) : existingLeaderTurn.messageFragments,
          messagePendingIncomplete: proposal.messageFragments ? !!proposal.messagePendingIncomplete : existingLeaderTurn.messagePendingIncomplete,
          events: nextEvents,
          createdAt: now,
        },
        reviewerPlans: {},
        reviewerVotes: {},
        leaderTurn: {
          ...existingLeaderTurn,
          deliberationText: deliberationText || existingLeaderTurn.deliberationText,
          terminalAction: 'proposal' as const,
          terminalText: proposalText,
          terminalReason: null,
          messageFragments: proposal.messageFragments ? cloneCouncilMessageFragments(proposal.messageFragments) : existingLeaderTurn.messageFragments,
          messagePendingIncomplete: proposal.messageFragments ? !!proposal.messagePendingIncomplete : existingLeaderTurn.messagePendingIncomplete,
          events: nextEvents,
        },
        completedAt: null,
      };
      return nextRound;
    })());

  return {
    ...session,
    status: 'reviewing',
    rounds: nextRounds,
    updatedAt: now,
  };
}

export function applyCouncilReviewBallots(session: CouncilSessionState, ballots: readonly CouncilBallotRecord[]): CouncilSessionState {
  const currentRound = session.rounds[session.roundIndex];
  if (!currentRound)
    return session;

  const normalizedBallots = ballots.map(normalizeCouncilBallot);
  const mergedReviewerVotes = normalizedBallots.reduce((reviewerVotes, ballot) => {
    const existingVote = currentRound.reviewerVotes[ballot.reviewerParticipantId];
    reviewerVotes[ballot.reviewerParticipantId] = existingVote ?? {
      reviewerParticipantId: ballot.reviewerParticipantId,
      ballot,
      reason: ballot.decision === 'reject' ? ballot.reason ?? null : null,
      messageFragments: [],
      messagePendingIncomplete: false,
      events: [{
        type: 'terminal',
        createdAt: Date.now(),
        action: ballot.decision,
        text: '',
        reason: ballot.decision === 'reject' ? ballot.reason ?? null : null,
      }],
      createdAt: Date.now(),
    };
    return reviewerVotes;
  }, { ...currentRound.reviewerVotes } as Record<string, CouncilReviewerVoteRecord>);

  const completedRound: CouncilRoundRecord = {
    ...currentRound,
    phase: 'completed',
    ballots: normalizedBallots,
    reviewerVotes: mergedReviewerVotes,
    completedAt: Date.now(),
  };

  const hasRejections = normalizedBallots.some(ballot => ballot.decision === 'reject');
  const rejectionReasons = normalizedBallots
    .filter((ballot): ballot is CouncilBallotRecord & { decision: 'reject'; reason: string } => ballot.decision === 'reject' && !!ballot.reason)
    .map(ballot => ballot.reason);

  const nextRounds = session.rounds.map(round => round.roundIndex === completedRound.roundIndex ? completedRound : round);
  if (!hasRejections) {
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
  const nextRound: CouncilRoundRecord = createCouncilRoundRecord(
    nextRoundIndex,
    session.leaderParticipantId,
    [
      ...completedRound.sharedRejectionReasons,
      ...rejectionReasons,
    ],
  );

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

    for (const ballot of ballots)
      session = recordCouncilReviewerVote(session, { reviewerParticipantId: ballot.reviewerParticipantId, ballot });

    session = {
      ...session,
      status: 'reviewing',
      rounds: session.rounds.map(round => round.roundIndex !== roundIndex
        ? round
        : {
            ...round,
            phase: 'reviewer-votes',
            ballots,
          }),
      updatedAt: Date.now(),
    };
    break;
  }

  return session;
}

export function stripCouncilTranscriptPrefix(text: string): string {
  return text
    .replace(COUNCIL_TRANSCRIPT_PREFIX_PATTERN, '')
    .replace(LEGACY_CONSENSUS_TRANSCRIPT_PREFIX_PATTERN, '')
    .trim();
}

function stripCouncilProtocolPrefix(text: string): string {
  return text.replace(COUNCIL_PROTOCOL_PATTERN, '').trim();
}

function parseInlineCouncilProtocol(text: string): {
  action: CouncilProtocolAction;
  leadingText: string;
  trailingText: string;
} | null {
  const match = text.match(INLINE_COUNCIL_PROTOCOL_PATTERN);
  const action = match?.groups?.action?.toLowerCase() as CouncilProtocolAction | undefined;
  if (!match || !action)
    return null;

  return {
    action,
    leadingText: stripCouncilTranscriptPrefix(match.groups?.leading ?? ''),
    trailingText: stripCouncilTranscriptPrefix(match.groups?.trailing ?? ''),
  };
}

function parseInlineCouncilReviewBallot(text: string): {
  decision: CouncilBallotDecision;
  leadingText: string;
  trailingText: string;
} | null {
  const match = text.match(INLINE_COUNCIL_REVIEW_BALLOT_PATTERN);
  const rawDecision = match?.groups?.decision?.toLowerCase();
  const decision = rawDecision === 'accept'
    ? 'accept'
    : rawDecision === 'improve'
      ? 'reject'
      : null;
  if (!match || !decision)
    return null;

  return {
    decision,
    leadingText: stripCouncilTranscriptPrefix(match.groups?.leading ?? ''),
    trailingText: stripCouncilTranscriptPrefix(match.groups?.trailing ?? ''),
  };
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
    initialDraftText: '',
    deliberationText: '',
    terminalAction: null,
    terminalText: '',
    terminalReason: null,
    messageFragments: [],
    messagePendingIncomplete: false,
    events: [],
  };
}

function cloneCouncilMessageFragments(messageFragments: readonly DMessageFragment[] | undefined): DMessageFragment[] {
  return messageFragments?.length ? structuredClone([...messageFragments]) : [];
}

export function extractCouncilProposalText(fragmentTexts: readonly string[]): string {
  return fragmentTexts
    .map(text => text.trim())
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

export function deriveCouncilReviewerFallbackReason(fragmentTexts: readonly string[]): string {
  const fallbackText = classifyCouncilTextFragments(fragmentTexts, false).deliberationText.trim()
    || extractCouncilProposalText(fragmentTexts).trim();
  return fallbackText || COUNCIL_REVIEW_FAILED_REASON;
}

export function classifyCouncilReviewBallotFragments(fragmentTexts: readonly string[], reviewerParticipantId: string): CouncilBallotRecord {
  const ballotText = getLastNonEmptyFragmentText(fragmentTexts);
  const inlineBallot = parseInlineCouncilReviewBallot(ballotText);
  const ballotMatch = ballotText.match(COUNCIL_REVIEW_BALLOT_PATTERN);
  if (!ballotMatch && !inlineBallot)
    return {
      reviewerParticipantId,
      decision: 'reject',
      reason: deriveCouncilReviewerFallbackReason(fragmentTexts),
    };

  const decision = inlineBallot?.decision ?? (ballotMatch?.[1]?.toLowerCase() === 'improve' ? 'reject' : ballotMatch?.[1]?.toLowerCase());
  const trailingText = inlineBallot?.trailingText?.trim() || ballotMatch?.[2]?.trim() || '';
  if (decision === 'accept') {
    return {
      reviewerParticipantId,
      decision: 'accept',
    };
  }

  return {
    reviewerParticipantId,
    decision: 'reject',
    ...(trailingText ? { reason: trailingText } : {}),
  };
}

export function classifyCouncilTextFragments(fragmentTexts: readonly string[], isLeader: boolean): {
  action: CouncilProtocolAction;
  deliberationText: string;
  response: string;
} {
  const normalizedTexts = fragmentTexts
    .map(text => text.trim())
    .filter(Boolean);

  const leadingDeliberationText = getLeadingFragmentTexts(fragmentTexts)
    .map(text => stripCouncilTranscriptPrefix(stripCouncilProtocolPrefix(text)))
    .filter(Boolean)
    .join('\n\n')
    .trim();
  const terminalText = getLastNonEmptyFragmentText(fragmentTexts);
  const inlineProtocol = parseInlineCouncilProtocol(terminalText);
  const terminalProtocolAction = inlineProtocol?.action
    ?? terminalText.match(COUNCIL_PROTOCOL_PATTERN)?.[1]?.toLowerCase() as CouncilProtocolAction | undefined;
  if (terminalProtocolAction) {
    const strippedTerminalText = inlineProtocol?.trailingText
      ?? stripCouncilTranscriptPrefix(stripCouncilProtocolPrefix(terminalText));
    const terminalLeadingText = inlineProtocol?.leadingText?.trim() || '';
    const prefixedDeliberationText = [leadingDeliberationText, terminalLeadingText].filter(Boolean).join('\n\n');

    if (isLeader) {
      if (terminalProtocolAction === 'proposal')
        return {
          action: 'proposal',
          deliberationText: prefixedDeliberationText,
          response: strippedTerminalText,
        };
      if (terminalProtocolAction === 'accept')
        return {
          action: 'deliberation',
          deliberationText: [prefixedDeliberationText, strippedTerminalText].filter(Boolean).join('\n\n'),
          response: '',
        };
    } else {
      if (terminalProtocolAction === 'accept')
        return {
          action: 'accept',
          deliberationText: prefixedDeliberationText,
          response: strippedTerminalText,
        };
      if (terminalProtocolAction === 'proposal')
        return {
          action: 'revise',
          deliberationText: [prefixedDeliberationText, strippedTerminalText].filter(Boolean).join('\n\n'),
          response: '',
        };
    }
  }

  const terminalBallotMatch = terminalText.match(COUNCIL_REVIEW_BALLOT_PATTERN);
  const inlineBallot = parseInlineCouncilReviewBallot(terminalText);
  const terminalRejectReason = inlineBallot?.decision === 'reject'
    ? inlineBallot.trailingText?.trim() || ''
    : terminalBallotMatch?.[1]?.toLowerCase() === 'improve'
      ? terminalBallotMatch[2]?.trim() || ''
      : '';
  if (!isLeader && (inlineBallot?.decision === 'reject' || terminalBallotMatch?.[1]?.toLowerCase() === 'improve')) {
    return {
      action: 'revise',
      deliberationText: [
        leadingDeliberationText,
        inlineBallot?.leadingText?.trim() || '',
        terminalRejectReason,
      ].filter(Boolean).join('\n\n'),
      response: '',
    };
  }

  const explicitProtocolAction = normalizedTexts
    .map(text => text.match(COUNCIL_PROTOCOL_PATTERN)?.[1]?.toLowerCase() ?? null)
    .find((action): action is CouncilProtocolAction => !!action);
  const isPrefixedDeliberation = normalizedTexts.some(text =>
    COUNCIL_TRANSCRIPT_PREFIX_PATTERN.test(text) || LEGACY_CONSENSUS_TRANSCRIPT_PREFIX_PATTERN.test(text));
  const deliberationText = normalizedTexts
    .map(text => stripCouncilTranscriptPrefix(stripCouncilProtocolPrefix(text)))
    .join('\n\n')
    .trim();

  let action: CouncilProtocolAction = explicitProtocolAction
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
          leaderProposal: round.leaderProposal
            ? {
                ...round.leaderProposal,
                events: [...round.leaderProposal.events, params.event],
              }
            : round.leaderProposal,
          leaderTurn: {
            ...leaderTurn,
            events: [...leaderTurn.events, params.event],
          },
        };
      }

      const reviewerTurn = round.reviewerTurns[params.participantId] ?? createCouncilAgentTurnRecord(params.participantId, round.roundIndex, 'reviewer');
      const reviewerPlans = round.phase === 'reviewer-plans'
        ? {
            ...round.reviewerPlans,
            [params.participantId]: {
              reviewerParticipantId: params.participantId,
              planText: round.reviewerPlans[params.participantId]?.planText ?? reviewerTurn.initialDraftText,
              messageFragments: round.reviewerPlans[params.participantId]?.messageFragments ?? reviewerTurn.messageFragments,
              messagePendingIncomplete: round.reviewerPlans[params.participantId]?.messagePendingIncomplete ?? reviewerTurn.messagePendingIncomplete,
              events: [...(round.reviewerPlans[params.participantId]?.events ?? []), params.event],
              createdAt: round.reviewerPlans[params.participantId]?.createdAt ?? Date.now(),
            },
          }
        : round.reviewerPlans;
      const reviewerVotes = round.phase === 'reviewer-votes'
        ? round.reviewerVotes[params.participantId]
          ? {
              ...round.reviewerVotes,
              [params.participantId]: {
                reviewerParticipantId: params.participantId,
                ballot: round.reviewerVotes[params.participantId]!.ballot,
                reason: round.reviewerVotes[params.participantId]!.reason,
                messageFragments: round.reviewerVotes[params.participantId]!.messageFragments,
                messagePendingIncomplete: round.reviewerVotes[params.participantId]!.messagePendingIncomplete,
                events: [...round.reviewerVotes[params.participantId]!.events, params.event],
                createdAt: round.reviewerVotes[params.participantId]!.createdAt,
              },
            }
          : round.reviewerVotes
        : round.reviewerVotes;
      return {
        ...round,
        reviewerPlans,
        reviewerVotes,
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

export function recordCouncilAgentMessageSnapshot(session: CouncilSessionState, params: {
  roundIndex: number;
  participantId: string;
  role: 'leader' | 'reviewer';
  messageFragments: readonly DMessageFragment[];
  messagePendingIncomplete?: boolean;
}): CouncilSessionState {
  return {
    ...session,
    rounds: session.rounds.map(round => {
      if (round.roundIndex !== params.roundIndex)
        return round;

      if (params.role === 'leader') {
        const leaderTurn = round.leaderTurn ?? createCouncilAgentTurnRecord(params.participantId, round.roundIndex, 'leader');
        const mergedLeaderFragments = mergeCouncilMessageSnapshotFragments(leaderTurn.messageFragments, params.messageFragments);
        return {
          ...round,
          leaderProposal: round.leaderProposal
            ? {
                ...round.leaderProposal,
                messageFragments: mergedLeaderFragments,
                messagePendingIncomplete: !!params.messagePendingIncomplete,
              }
            : round.leaderProposal,
          leaderTurn: {
            ...leaderTurn,
            messageFragments: mergedLeaderFragments,
            messagePendingIncomplete: !!params.messagePendingIncomplete,
          },
        };
      }

      const reviewerTurn = round.reviewerTurns[params.participantId] ?? createCouncilAgentTurnRecord(params.participantId, round.roundIndex, 'reviewer');
      const mergedReviewerFragments = mergeCouncilMessageSnapshotFragments(reviewerTurn.messageFragments, params.messageFragments);
      const reviewerPlans = round.phase === 'reviewer-plans'
        ? {
            ...round.reviewerPlans,
            [params.participantId]: {
              reviewerParticipantId: params.participantId,
              planText: round.reviewerPlans[params.participantId]?.planText ?? reviewerTurn.initialDraftText,
              messageFragments: mergedReviewerFragments,
              messagePendingIncomplete: !!params.messagePendingIncomplete,
              events: round.reviewerPlans[params.participantId]?.events ?? reviewerTurn.events,
              createdAt: round.reviewerPlans[params.participantId]?.createdAt ?? Date.now(),
            },
          }
        : round.reviewerPlans;
      const reviewerVotes = round.phase === 'reviewer-votes'
        ? round.reviewerVotes[params.participantId]
          ? {
              ...round.reviewerVotes,
              [params.participantId]: {
                reviewerParticipantId: params.participantId,
                ballot: round.reviewerVotes[params.participantId]!.ballot,
                reason: round.reviewerVotes[params.participantId]!.reason,
                messageFragments: mergedReviewerFragments,
                messagePendingIncomplete: !!params.messagePendingIncomplete,
                events: round.reviewerVotes[params.participantId]!.events,
                createdAt: round.reviewerVotes[params.participantId]!.createdAt,
              },
            }
          : round.reviewerVotes
        : round.reviewerVotes;
      return {
        ...round,
        reviewerPlans,
        reviewerVotes,
        reviewerTurns: {
          ...round.reviewerTurns,
          [params.participantId]: {
            ...reviewerTurn,
            messageFragments: mergedReviewerFragments,
            messagePendingIncomplete: !!params.messagePendingIncomplete,
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
  ballot?: CouncilBallotRecord;
  messageFragments?: readonly DMessageFragment[];
  messagePendingIncomplete?: boolean;
}): CouncilSessionState {
  return recordCouncilReviewerVote(session, params);
}

export function recordCouncilReviewerVote(session: CouncilSessionState, params: {
  reviewerParticipantId: string;
  fragmentTexts?: readonly string[];
  ballot?: CouncilBallotRecord;
  messageFragments?: readonly DMessageFragment[];
  messagePendingIncomplete?: boolean;
}): CouncilSessionState {
  const currentRound = session.rounds[session.roundIndex];
  if (!currentRound)
    return session;

  const fragmentTexts = params.fragmentTexts ?? [];
  const deliberation = classifyCouncilTextFragments(fragmentTexts, false);
  const ballot = normalizeCouncilBallot(params.ballot ?? classifyCouncilReviewBallotFragments(fragmentTexts, params.reviewerParticipantId));
  const existingTurn = currentRound.reviewerTurns[params.reviewerParticipantId]
    ?? createCouncilAgentTurnRecord(params.reviewerParticipantId, currentRound.roundIndex, 'reviewer');
  const now = Date.now();
  const events = [...existingTurn.events];
  const lastTextOutput = [...events]
    .reverse()
    .find((event): event is Extract<CouncilAgentTurnEvent, { type: 'text-output' }> => event.type === 'text-output');
  if (deliberation.deliberationText && lastTextOutput?.text !== deliberation.deliberationText) {
    events.push({
      type: 'text-output',
      createdAt: now,
      text: deliberation.deliberationText,
    });
  }
  events.push({
    type: 'terminal',
    createdAt: now,
    action: ballot.decision,
    text: ballot.decision === 'accept' ? deliberation.response : '',
    reason: ballot.decision === 'reject' ? ballot.reason ?? null : null,
  });

  return {
    ...session,
    rounds: session.rounds.map(round => round.roundIndex !== session.roundIndex
      ? round
      : {
        ...round,
        phase: 'reviewer-votes',
        ballots: [
          ...round.ballots.filter(existing => existing.reviewerParticipantId !== params.reviewerParticipantId),
          ballot,
        ],
        reviewerVotes: {
          ...round.reviewerVotes,
          [params.reviewerParticipantId]: {
            reviewerParticipantId: params.reviewerParticipantId,
            ballot,
            reason: ballot.decision === 'reject' ? ballot.reason ?? null : null,
            messageFragments: params.messageFragments ? cloneCouncilMessageFragments(params.messageFragments) : (round.reviewerVotes[params.reviewerParticipantId]?.messageFragments ?? existingTurn.messageFragments),
            messagePendingIncomplete: params.messageFragments ? !!params.messagePendingIncomplete : (round.reviewerVotes[params.reviewerParticipantId]?.messagePendingIncomplete ?? existingTurn.messagePendingIncomplete),
            events,
            createdAt: round.reviewerVotes[params.reviewerParticipantId]?.createdAt ?? now,
          },
        },
        reviewerTurns: {
          ...round.reviewerTurns,
          [params.reviewerParticipantId]: {
            ...existingTurn,
            initialDraftText: existingTurn.initialDraftText,
            deliberationText: deliberation.deliberationText,
            terminalAction: ballot.decision,
            terminalText: ballot.decision === 'accept' ? deliberation.response : '',
            terminalReason: ballot.decision === 'reject' ? ballot.reason ?? null : null,
            messageFragments: params.messageFragments ? cloneCouncilMessageFragments(params.messageFragments) : existingTurn.messageFragments,
            messagePendingIncomplete: params.messageFragments ? !!params.messagePendingIncomplete : existingTurn.messagePendingIncomplete,
            events,
          },
        },
      }),
    updatedAt: now,
  };
}

export function recordCouncilReviewerInitialDraft(session: CouncilSessionState, params: {
  reviewerParticipantId: string;
  draftText: string;
  messageFragments?: readonly DMessageFragment[];
  messagePendingIncomplete?: boolean;
}): CouncilSessionState {
  return recordCouncilReviewerPlan(session, {
    reviewerParticipantId: params.reviewerParticipantId,
    planText: params.draftText,
    messageFragments: params.messageFragments,
    messagePendingIncomplete: params.messagePendingIncomplete,
  });
}

export function recordCouncilReviewerPlan(session: CouncilSessionState, params: {
  reviewerParticipantId: string;
  planText: string;
  messageFragments?: readonly DMessageFragment[];
  messagePendingIncomplete?: boolean;
}): CouncilSessionState {
  const currentRound = session.rounds[session.roundIndex];
  if (!currentRound)
    return session;

  const existingTurn = currentRound.reviewerTurns[params.reviewerParticipantId]
    ?? createCouncilAgentTurnRecord(params.reviewerParticipantId, currentRound.roundIndex, 'reviewer');
  const planText = params.planText.trim();
  const now = Date.now();
  const events = [...existingTurn.events];
  const lastTextOutput = [...events]
    .reverse()
    .find((event): event is Extract<CouncilAgentTurnEvent, { type: 'text-output' }> => event.type === 'text-output');
  if (planText && lastTextOutput?.text !== planText) {
    events.push({
      type: 'text-output',
      createdAt: now,
      text: planText,
    });
  }

  return {
    ...session,
    rounds: session.rounds.map(round => {
      if (round.roundIndex !== session.roundIndex)
        return round;

      const nextRound: CouncilRoundRecord = {
        ...round,
        reviewerPlans: {
          ...round.reviewerPlans,
          [params.reviewerParticipantId]: {
            reviewerParticipantId: params.reviewerParticipantId,
            planText,
            messageFragments: params.messageFragments ? cloneCouncilMessageFragments(params.messageFragments) : (round.reviewerPlans[params.reviewerParticipantId]?.messageFragments ?? existingTurn.messageFragments),
            messagePendingIncomplete: params.messageFragments ? !!params.messagePendingIncomplete : (round.reviewerPlans[params.reviewerParticipantId]?.messagePendingIncomplete ?? existingTurn.messagePendingIncomplete),
            events,
            createdAt: round.reviewerPlans[params.reviewerParticipantId]?.createdAt ?? now,
          },
        },
        reviewerTurns: {
          ...round.reviewerTurns,
          [params.reviewerParticipantId]: {
            ...existingTurn,
            initialDraftText: planText,
            messageFragments: params.messageFragments ? cloneCouncilMessageFragments(params.messageFragments) : existingTurn.messageFragments,
            messagePendingIncomplete: params.messageFragments ? !!params.messagePendingIncomplete : existingTurn.messagePendingIncomplete,
            events,
          },
        },
      };

      return {
        ...nextRound,
        phase: getRoundPlanPhase(nextRound, session.reviewerParticipantIds),
      };
    }),
    updatedAt: now,
  };
}

export function evaluateCouncilPass(entries: readonly CouncilPassEntry[]): {
  hasCouncil: boolean;
  agreedResponse: string | null;
} {
  const leaderEntries = entries.filter(entry => entry.isLeader);
  const leaderProposal = leaderEntries.find(entry => entry.action === 'proposal' && !!entry.response.trim()) ?? null;
  if (!leaderProposal)
    return { hasCouncil: false, agreedResponse: null };

  const proposalSignature = getCouncilTextSignature(leaderProposal.response);
  if (!proposalSignature)
    return { hasCouncil: false, agreedResponse: null };

  const nonLeaderEntries = entries.filter(entry => !entry.isLeader);
  const allAccepted = nonLeaderEntries.every(entry =>
    entry.action === 'accept' && getCouncilTextSignature(entry.response) === proposalSignature);

  return {
    hasCouncil: allAccepted,
    agreedResponse: allAccepted ? leaderProposal.response.trim() : null,
  };
}

function getCouncilTextSignature(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function getCouncilResumePassIndex(params: {
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
