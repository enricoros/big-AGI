import {
  COUNCIL_INTERRUPTION_REASON_INVALID_PROPOSAL,
  COUNCIL_INVALID_PROPOSAL_TEXT,
  COUNCIL_REVIEW_ANALYSIS_MISSING_REASON,
  COUNCIL_REVIEW_FAILED_REASON,
  COUNCIL_REVIEW_VERDICT_MISSING_REASON,
  hydrateCouncilSessionFromTranscriptEntries,
} from '../editors/_handleExecute.council';
import type { CouncilAgentTurnRecord, CouncilSessionState as WorkflowCouncilSessionState } from '../editors/_handleExecute.council';

import type { CouncilSessionState as OverlayCouncilSessionState } from '~/common/chat-overlay/store-perchat-composer_slice';
import type { DConversationParticipant } from '~/common/stores/chat/chat.conversation';
import { isTextContentFragment, isToolInvocationPart } from '~/common/stores/chat/chat.fragments';
import type { DMessageFragment } from '~/common/stores/chat/chat.fragments';
import type { DMessage } from '~/common/stores/chat/chat.message';
import { PARTICIPANT_REASONING_EFFORT_META } from './layout-bar/ChatBarChat.reasoning';

const COUNCIL_ACCEPT_LABEL = 'Accept()';
const COUNCIL_IMPROVE_LABEL = 'Improve()';


export type CouncilTracePlacement =
  | {
    mode: 'before-message';
    anchorMessageId: string;
  }
  | {
    mode: 'after-phase';
    phaseId: string;
  };

export type CouncilTraceSharedReasons = {
  label: 'Shared with next round' | 'Queued for next round' | 'Final improvement reasons';
  reasons: string[];
};

export type CouncilTraceAgentDetailItem =
  | {
    type: 'text-output';
    text: string;
  }
  | {
    type: 'terminal';
    action: 'proposal' | 'accept' | 'reject';
    text: string;
    reason: string | null;
  };

export type CouncilTraceAgentCard = {
  participantId: string;
  participantName: string;
  participantModelLabel?: string | null;
  participantReasoningLabel?: string | null;
  role: 'leader' | 'reviewer';
  status: 'proposal-ready' | 'accepted' | 'rejected' | 'waiting' | 'failed';
  excerpt: string | null;
  terminalLabel: string | null;
  terminalText: string;
  terminalReason: string | null;
  hasDetails: boolean;
  messageFragments: DMessageFragment[];
  messagePendingIncomplete: boolean;
  detailItems: CouncilTraceAgentDetailItem[];
};

export type CouncilTraceReviewerCard = CouncilTraceAgentCard & {
  decision: 'accept' | 'reject' | 'pending';
  reason: string | null;
};

export type CouncilTraceProgress = {
  completed: number;
  total: number;
  isShared: boolean;
};

export type CouncilTraceRoundItem = {
  roundIndex: number;
  defaultExpanded: boolean;
  phase: WorkflowCouncilSessionState['rounds'][number]['phase'];
  leaderProposalFailed: boolean;
  proposalId: string | null;
  proposalText: string | null;
  leaderParticipantId: string;
  leaderParticipantName: string;
  leaderCard: CouncilTraceAgentCard;
  reviewerCards: CouncilTraceReviewerCard[];
  proposalCard: CouncilTraceAgentCard | null;
  reviewerPlanCards: CouncilTraceAgentCard[];
  reviewerVoteCards: CouncilTraceReviewerCard[];
  reviewerPlanProgress: CouncilTraceProgress;
  reviewerVoteProgress: CouncilTraceProgress;
  sharedReasons: CouncilTraceSharedReasons | null;
};

export type CouncilTraceRenderItem = {
  phaseId: string;
  placement: CouncilTracePlacement;
  rounds: CouncilTraceRoundItem[];
  reviewerCount: number;
  totalRounds: number;
  summaryStatus: 'accepted' | 'reviewing' | 'awaiting-leader-revision' | 'interrupted' | 'stopped' | 'exhausted';
};

type BuildCouncilTraceRenderParams = {
  messages: readonly DMessage[];
  participants: readonly DConversationParticipant[];
  llmLabelsById?: ReadonlyMap<string, string>;
  chatModelLabel?: string | null;
  councilSession: OverlayCouncilSessionState;
  autoCollapsePreviousRounds?: boolean;
  autoExpandNewestRound?: boolean;
};

export type CouncilTraceRenderPlan = {
  traceItem: CouncilTraceRenderItem | null;
  showLegacyDeliberationToggle: boolean;
};

export function buildCouncilTraceRenderPlan(params: BuildCouncilTraceRenderParams): CouncilTraceRenderPlan {
  const traceItem = buildCouncilTraceRenderItem(params) ?? buildHistoricalCouncilTraceRenderItem(params);
  return {
    traceItem,
    showLegacyDeliberationToggle: !traceItem,
  };
}

export function buildCouncilTraceRenderItem(params: BuildCouncilTraceRenderParams): CouncilTraceRenderItem | null {
  const workflowState = params.councilSession.workflowState;
  const phaseId = params.councilSession.phaseId ?? workflowState?.phaseId ?? null;
  if (!workflowState || !phaseId)
    return null;

  const autoCollapsePreviousRounds = params.autoCollapsePreviousRounds ?? true;
  const autoExpandNewestRound = params.autoExpandNewestRound ?? true;
  const chatModelLabel = params.chatModelLabel ?? 'Chat model';
  const participantCardsMeta = new Map(params.participants.map(participant => [participant.id, {
    name: participant.name,
    modelLabel: participant.llmId
      ? params.llmLabelsById?.get(participant.llmId) ?? participant.llmId
      : chatModelLabel,
    reasoningLabel: participant.reasoningEffort
      ? PARTICIPANT_REASONING_EFFORT_META[participant.reasoningEffort].label
      : null,
  }]));
  const roundsByIndex = new Map(workflowState.rounds.map(round => [round.roundIndex, round]));
  const latestRoundIndex = workflowState.rounds.reduce((maxRoundIndex, round) => Math.max(maxRoundIndex, round.roundIndex), -1);
  const rounds = [...workflowState.rounds]
    .sort((a, b) => a.roundIndex - b.roundIndex)
    .map(round => {
      const leaderProposalFailed = isLeaderProposalFailedRound(round, workflowState);
      const reviewerPlanProgress = buildReviewerPlanProgress(round, workflowState);
      const reviewerVoteProgress = buildReviewerVoteProgress(round, workflowState);
      const proposalCard = buildProposalCard(round, workflowState, participantCardsMeta);
      const reviewerPlanCards = buildReviewerPlanCards(round, workflowState, participantCardsMeta, reviewerPlanProgress);
      const reviewerVoteCards = buildReviewerVoteCards(round, workflowState, participantCardsMeta, reviewerVoteProgress);

      return {
        roundIndex: round.roundIndex,
        defaultExpanded: round.roundIndex === latestRoundIndex
          ? autoExpandNewestRound
          : !autoCollapsePreviousRounds,
        phase: round.phase,
        leaderProposalFailed,
        proposalId: round.proposalId,
        proposalText: round.proposalText,
        leaderParticipantId: round.leaderParticipantId,
        leaderParticipantName: getParticipantName(participantCardsMeta, round.leaderParticipantId),
        leaderCard: proposalCard ?? buildLeaderCard(round, workflowState, participantCardsMeta),
        reviewerCards: reviewerVoteProgress.isShared
          ? reviewerVoteCards
          : buildReviewerCards(round, workflowState, participantCardsMeta),
        proposalCard,
        reviewerPlanCards,
        reviewerVoteCards,
        reviewerPlanProgress,
        reviewerVoteProgress,
        sharedReasons: deriveSharedReasons(round, roundsByIndex, workflowState, params.councilSession),
      };
    });

  return {
    phaseId,
    placement: findCouncilTracePlacement(params.messages, phaseId),
    rounds,
    reviewerCount: workflowState.reviewerParticipantIds.length,
    totalRounds: workflowState.rounds.length,
    summaryStatus: getCouncilTraceSummaryStatus(params.councilSession, workflowState),
  };
}

function buildHistoricalCouncilTraceRenderItem(params: BuildCouncilTraceRenderParams): CouncilTraceRenderItem | null {
  const latestHistoricalPhaseId = [...params.messages]
    .reverse()
    .map(message => message.metadata?.council?.phaseId ?? null)
    .find((phaseId): phaseId is string => !!phaseId?.trim()) ?? null;
  if (!latestHistoricalPhaseId)
    return null;

  const phaseMessages = params.messages.filter(message => message.metadata?.council?.phaseId === latestHistoricalPhaseId);
  const deliberationMessages = phaseMessages.filter(message => message.metadata?.council?.kind === 'deliberation');
  if (!deliberationMessages.length)
    return null;

  const resultMessage = phaseMessages.find(message => message.metadata?.council?.kind === 'result') ?? null;
  const invalidProposalNotification = phaseMessages.find(message =>
    message.metadata?.council?.kind === 'notification'
    && getMessagePlainText(message).includes(COUNCIL_INVALID_PROPOSAL_TEXT),
  ) ?? null;

  const leaderParticipantId = resultMessage?.metadata?.council?.leaderParticipantId
    ?? deliberationMessages.find(message => message.metadata?.council?.action === 'proposal')?.metadata?.author?.participantId
    ?? params.participants.find(participant => participant.kind === 'assistant' && participant.isLeader)?.id
    ?? params.participants.find(participant => participant.kind === 'assistant')?.id
    ?? null;
  if (!leaderParticipantId)
    return null;

  const reviewerParticipantIds = [...new Set(deliberationMessages
    .filter(message => {
      const action = message.metadata?.council?.action;
      return action === 'accept' || action === 'reject';
    })
    .map(message => message.metadata?.author?.participantId ?? null)
    .filter((participantId): participantId is string => !!participantId && participantId !== leaderParticipantId))];

  const transcriptEntries = deliberationMessages.flatMap(message => {
    const council = message.metadata?.council;
    const participantId = message.metadata?.author?.participantId ?? null;
    if (!council?.phaseId || typeof council.passIndex !== 'number' || !participantId)
      return [];
    if (council.action !== 'proposal' && council.action !== 'accept' && council.action !== 'reject')
      return [];

    return [{
      roundIndex: council.passIndex,
      participantId,
      action: council.action,
      messageId: message.id,
      text: getMessagePlainText(message),
      reason: council.reason,
    }] as const;
  });
  if (!transcriptEntries.length)
    return null;

  const maxRounds = transcriptEntries.reduce((maxRoundIndex, entry) => Math.max(maxRoundIndex, entry.roundIndex), 0) + 1;
  let workflowState = hydrateCouncilSessionFromTranscriptEntries({
    phaseId: latestHistoricalPhaseId,
    leaderParticipantId,
    reviewerParticipantIds,
    maxRounds,
    entries: transcriptEntries,
  });

  if (resultMessage) {
    workflowState = {
      ...workflowState,
      status: 'accepted',
      acceptedProposalId: workflowState.acceptedProposalId ?? resultMessage.id,
      finalResponse: getMessagePlainText(resultMessage) || workflowState.finalResponse,
    };
  } else if (invalidProposalNotification) {
    workflowState = {
      ...workflowState,
      status: 'interrupted',
      interruptionReason: COUNCIL_INTERRUPTION_REASON_INVALID_PROPOSAL,
    };
  }

  const historicalCouncilSession: OverlayCouncilSessionState = {
    status: resultMessage
      ? 'completed'
      : invalidProposalNotification
        ? 'stopped'
        : 'interrupted',
    executeMode: 'generate-content',
    mode: 'council',
    phaseId: latestHistoricalPhaseId,
    passIndex: workflowState.roundIndex,
    workflowState,
    canResume: false,
    interruptionReason: invalidProposalNotification ? COUNCIL_INTERRUPTION_REASON_INVALID_PROPOSAL : null,
    updatedAt: resultMessage?.updated ?? resultMessage?.created ?? deliberationMessages.at(-1)?.updated ?? deliberationMessages.at(-1)?.created ?? Date.now(),
  };

  return buildCouncilTraceRenderItem({
    ...params,
    councilSession: historicalCouncilSession,
  });
}

function getMessagePlainText(message: DMessage): string {
  return message.fragments
    .filter(isTextContentFragment)
    .map(fragment => fragment.part.text.trim())
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

type CouncilTraceParticipantMeta = {
  name: string;
  modelLabel: string | null;
  reasoningLabel: string | null;
};

function getParticipantMeta(
  participantCardsMeta: ReadonlyMap<string, CouncilTraceParticipantMeta>,
  participantId: string,
): CouncilTraceParticipantMeta {
  return participantCardsMeta.get(participantId) ?? {
    name: participantId,
    modelLabel: null,
    reasoningLabel: null,
  };
}

function getParticipantName(participantCardsMeta: ReadonlyMap<string, CouncilTraceParticipantMeta>, participantId: string): string {
  return getParticipantMeta(participantCardsMeta, participantId).name;
}

function findCouncilTracePlacement(messages: readonly DMessage[], phaseId: string): CouncilTracePlacement {
  const resultMessage = messages.find(message =>
    message.metadata?.council?.kind === 'result'
      && message.metadata.council.phaseId === phaseId,
  );

  return resultMessage
    ? { mode: 'before-message', anchorMessageId: resultMessage.id }
    : { mode: 'after-phase', phaseId };
}

function deriveSharedReasons(
  round: WorkflowCouncilSessionState['rounds'][number],
  roundsByIndex: ReadonlyMap<number, WorkflowCouncilSessionState['rounds'][number]>,
  workflowState: WorkflowCouncilSessionState,
  overlayCouncilSession: OverlayCouncilSessionState,
): CouncilTraceSharedReasons | null {
  const reasons = workflowState.reviewerParticipantIds
    .map(reviewerParticipantId => round.reviewerVotes[reviewerParticipantId]?.ballot ?? round.ballots.find(ballot => ballot.reviewerParticipantId === reviewerParticipantId) ?? null)
    .filter((ballot): ballot is typeof ballot & { decision: 'reject'; reason: string } => !!ballot && ballot.decision === 'reject' && !!ballot.reason)
    .map(ballot => ballot.reason)
    .reduce<string[]>((dedupedReasons, reason) => {
      const normalizedReason = reason.trim();
      if (!normalizedReason)
        return dedupedReasons;
      if (dedupedReasons.includes(normalizedReason))
        return dedupedReasons;
      dedupedReasons.push(normalizedReason);
      return dedupedReasons;
    }, []);
  if (!reasons.length)
    return null;

  const visibleReasons = reasons.filter(reason => !isSyntheticReviewerFailureReason(reason));
  if (!visibleReasons.length)
    return null;

  const nextRound = roundsByIndex.get(round.roundIndex + 1);
  if (nextRound?.proposalText)
    return { label: 'Shared with next round', reasons: visibleReasons };
  if (nextRound && overlayCouncilSession.status !== 'interrupted')
    return { label: 'Shared with next round', reasons: visibleReasons };
  if (nextRound)
    return { label: 'Queued for next round', reasons: visibleReasons };
  const summaryStatus = getCouncilTraceSummaryStatus(overlayCouncilSession, workflowState);
  return {
    label: summaryStatus === 'exhausted' || summaryStatus === 'stopped'
      ? 'Final improvement reasons'
      : 'Queued for next round',
    reasons: visibleReasons,
  };
}

function buildReviewerCards(
  round: WorkflowCouncilSessionState['rounds'][number],
  workflowState: WorkflowCouncilSessionState,
  participantCardsMeta: ReadonlyMap<string, CouncilTraceParticipantMeta>,
): CouncilTraceReviewerCard[] {
  const allowPendingBallots = workflowState.status === 'reviewing' && workflowState.roundIndex === round.roundIndex;

  return workflowState.reviewerParticipantIds.flatMap(reviewerParticipantId => {
    const vote = round.reviewerVotes[reviewerParticipantId];
    const ballot = vote?.ballot ?? round.ballots.find(entry => entry.reviewerParticipantId === reviewerParticipantId);
    const turn = round.reviewerTurns[reviewerParticipantId] ?? null;
    if (!ballot && !turn && !allowPendingBallots)
      return [];

    const visibleVoteMessageFragments = sanitizeReviewerVoteMessageFragments(
      vote?.messageFragments ?? turn?.messageFragments ?? [],
      ballot ?? null,
    );
    const status = ballot?.decision === 'accept'
      ? 'accepted'
      : ballot?.decision === 'reject'
        ? 'rejected'
        : 'waiting';
    const syntheticReviewerFailure = ballot?.decision === 'reject' && isSyntheticReviewerFailureReason(ballot.reason);
    const syntheticFailurePresentation = syntheticReviewerFailure
      ? getSyntheticReviewerFailurePresentation(ballot.reason)
      : null;
    const fallbackReviewText = ballot?.decision === 'accept'
      ? COUNCIL_ACCEPT_LABEL
      : syntheticFailurePresentation
        ? syntheticFailurePresentation.excerpt
        : ballot?.decision === 'reject'
        ? ballot.reason ?? null
        : null;
    const excerpt = syntheticFailurePresentation?.excerpt ?? getAgentCardExcerpt(turn, fallbackReviewText);
    const visibleTurn = sanitizeReviewerTurnForDisplay(turn, syntheticReviewerFailure, visibleVoteMessageFragments);
    const participantMeta = getParticipantMeta(participantCardsMeta, reviewerParticipantId);
    return [createAgentCard({
      participantId: reviewerParticipantId,
      participantName: participantMeta.name,
      participantModelLabel: participantMeta.modelLabel,
      participantReasoningLabel: participantMeta.reasoningLabel,
      role: 'reviewer',
      status,
      excerpt,
      terminalLabel: ballot?.decision === 'accept'
        ? COUNCIL_ACCEPT_LABEL
        : syntheticFailurePresentation
          ? syntheticFailurePresentation.label
        : ballot?.decision === 'reject'
          ? COUNCIL_IMPROVE_LABEL
          : null,
      terminalText: turn?.terminalText ?? '',
      terminalReason: syntheticFailurePresentation ? null : ballot?.decision === 'reject' ? ballot.reason ?? null : null,
      decision: ballot?.decision ?? 'pending',
      reason: syntheticFailurePresentation ? null : ballot?.decision === 'reject' ? ballot.reason ?? null : null,
    }, visibleTurn, fallbackReviewText)];
  });
}

function buildReviewerPlanProgress(
  round: WorkflowCouncilSessionState['rounds'][number],
  workflowState: WorkflowCouncilSessionState,
): CouncilTraceProgress {
  const completed = workflowState.reviewerParticipantIds.filter(reviewerParticipantId => !!round.reviewerPlans[reviewerParticipantId]).length;
  const total = workflowState.reviewerParticipantIds.length;
  return {
    completed,
    total,
    isShared: total > 0 && completed >= total && round.phase !== 'leader-proposal',
  };
}

function buildReviewerVoteProgress(
  round: WorkflowCouncilSessionState['rounds'][number],
  workflowState: WorkflowCouncilSessionState,
): CouncilTraceProgress {
  const completed = workflowState.reviewerParticipantIds.filter(reviewerParticipantId => !!(round.reviewerVotes[reviewerParticipantId] ?? round.ballots.find(ballot => ballot.reviewerParticipantId === reviewerParticipantId))).length;
  const total = workflowState.reviewerParticipantIds.length;
  return {
    completed,
    total,
    isShared: round.phase === 'completed',
  };
}

function buildProposalCard(
  round: WorkflowCouncilSessionState['rounds'][number],
  workflowState: WorkflowCouncilSessionState,
  participantCardsMeta: ReadonlyMap<string, CouncilTraceParticipantMeta>,
): CouncilTraceAgentCard | null {
  if (!round.leaderProposal && !round.proposalText)
    return null;
  return buildLeaderCard(round, workflowState, participantCardsMeta);
}

function buildReviewerPlanCards(
  round: WorkflowCouncilSessionState['rounds'][number],
  workflowState: WorkflowCouncilSessionState,
  participantCardsMeta: ReadonlyMap<string, CouncilTraceParticipantMeta>,
  progress: CouncilTraceProgress,
): CouncilTraceAgentCard[] {
  return workflowState.reviewerParticipantIds.flatMap(reviewerParticipantId => {
    const reviewerPlan = round.reviewerPlans[reviewerParticipantId];
    if (!reviewerPlan)
      return [];

    const syntheticTurn: CouncilAgentTurnRecord = {
      participantId: reviewerParticipantId,
      roundIndex: round.roundIndex,
      role: 'reviewer',
      initialDraftText: reviewerPlan.planText,
      deliberationText: '',
      terminalAction: null,
      terminalText: reviewerPlan.planText,
      terminalReason: null,
      messageFragments: reviewerPlan.messageFragments,
      messagePendingIncomplete: reviewerPlan.messagePendingIncomplete,
      events: reviewerPlan.events,
    };

    const participantMeta = getParticipantMeta(participantCardsMeta, reviewerParticipantId);
    return [createAgentCard({
      participantId: reviewerParticipantId,
      participantName: participantMeta.name,
      participantModelLabel: participantMeta.modelLabel,
      participantReasoningLabel: participantMeta.reasoningLabel,
      role: 'reviewer',
      status: 'proposal-ready',
      excerpt: getAgentCardExcerpt(syntheticTurn, reviewerPlan.planText),
      terminalLabel: 'Analysis ready',
      terminalText: reviewerPlan.planText,
      terminalReason: null,
    }, syntheticTurn, reviewerPlan.planText)];
  });
}

function buildReviewerVoteCards(
  round: WorkflowCouncilSessionState['rounds'][number],
  workflowState: WorkflowCouncilSessionState,
  participantCardsMeta: ReadonlyMap<string, CouncilTraceParticipantMeta>,
  progress: CouncilTraceProgress,
): CouncilTraceReviewerCard[] {
  return workflowState.reviewerParticipantIds.flatMap(reviewerParticipantId => {
    const vote = round.reviewerVotes[reviewerParticipantId];
    const ballot = vote?.ballot ?? round.ballots.find(entry => entry.reviewerParticipantId === reviewerParticipantId);
    const turn = round.reviewerTurns[reviewerParticipantId] ?? null;
    const reviewerPlanText = round.reviewerPlans[reviewerParticipantId]?.planText ?? turn?.initialDraftText ?? null;
    if (!ballot)
      return [];

    const visibleVoteMessageFragments = sanitizeReviewerVoteMessageFragments(stripReviewerPlanEchoFromVoteFragments(
      vote?.messageFragments ?? turn?.messageFragments ?? [],
      reviewerPlanText,
    ), ballot);
    const status = ballot?.decision === 'accept'
      ? 'accepted'
      : ballot?.decision === 'reject'
        ? 'rejected'
        : 'waiting';
    const syntheticReviewerFailure = ballot?.decision === 'reject' && isSyntheticReviewerFailureReason(ballot.reason);
    const syntheticFailurePresentation = syntheticReviewerFailure
      ? getSyntheticReviewerFailurePresentation(ballot.reason)
      : null;
    const latestVoteText = visibleVoteMessageFragments
      .filter(isTextContentFragment)
      .map(fragment => fragment.part.text.trim())
      .filter(Boolean)
      .at(-1) ?? null;
    const visibleTurn = sanitizeReviewerTurnForDisplay(turn, syntheticReviewerFailure, visibleVoteMessageFragments);
    const excerpt = syntheticFailurePresentation?.excerpt ?? (
      ballot.decision === 'accept'
        ? latestVoteText
          ?? normalizeCouncilTraceText(turn?.deliberationText)
          ?? normalizeCouncilTraceText(reviewerPlanText)
          ?? normalizeCouncilTraceText(turn?.terminalText)
          ?? COUNCIL_ACCEPT_LABEL
        : latestVoteText ?? null
    );
    const participantMeta = getParticipantMeta(participantCardsMeta, reviewerParticipantId);
    return [createAgentCard({
      participantId: reviewerParticipantId,
      participantName: participantMeta.name,
      participantModelLabel: participantMeta.modelLabel,
      participantReasoningLabel: participantMeta.reasoningLabel,
      role: 'reviewer',
      status,
      excerpt,
      terminalLabel: ballot?.decision === 'accept'
        ? COUNCIL_ACCEPT_LABEL
        : syntheticFailurePresentation
          ? syntheticFailurePresentation.label
        : ballot?.decision === 'reject'
          ? COUNCIL_IMPROVE_LABEL
          : null,
      terminalText: turn?.terminalText ?? '',
      terminalReason: syntheticFailurePresentation ? null : ballot?.decision === 'reject' ? ballot.reason ?? null : null,
      decision: ballot?.decision ?? 'pending',
      reason: syntheticFailurePresentation ? null : ballot?.decision === 'reject' ? ballot.reason ?? null : null,
    }, visibleTurn)];
  });
}

function isSyntheticReviewerFailureReason(reason: string | null | undefined): boolean {
  return reason === COUNCIL_REVIEW_FAILED_REASON
    || reason === COUNCIL_REVIEW_VERDICT_MISSING_REASON
    || reason === COUNCIL_REVIEW_ANALYSIS_MISSING_REASON;
}

function getSyntheticReviewerFailurePresentation(reason: string | null | undefined): {
  label: string;
  excerpt: string;
} | null {
  if (reason === COUNCIL_REVIEW_VERDICT_MISSING_REASON) {
    return {
      label: 'Missing verdict',
      excerpt: 'The reviewer response did not call Accept() or Improve().',
    };
  }

  if (reason === COUNCIL_REVIEW_ANALYSIS_MISSING_REASON) {
    return {
      label: 'Missing analysis',
      excerpt: 'The reviewer called Accept() without a substantive review.',
    };
  }

  if (reason === COUNCIL_REVIEW_FAILED_REASON) {
    return {
      label: 'Review failed',
      excerpt: 'The reviewer failed before submitting a verdict.',
    };
  }

  return null;
}

function sanitizeReviewerVoteMessageFragments(
  messageFragments: readonly DMessageFragment[],
  ballot: WorkflowCouncilSessionState['rounds'][number]['reviewerVotes'][string]['ballot'] | WorkflowCouncilSessionState['rounds'][number]['ballots'][number] | null | undefined,
): DMessageFragment[] {
  if (!ballot || ballot.decision !== 'reject' || !isSyntheticReviewerFailureReason(ballot.reason))
    return [...messageFragments];

  return [];
}

function sanitizeReviewerTurnForDisplay(
  turn: CouncilTraceAgentTurnSource,
  syntheticReviewerFailure: boolean,
  messageFragments: readonly DMessageFragment[],
): CouncilTraceAgentTurnSource {
  if (!turn)
    return turn;

  if (!syntheticReviewerFailure) {
    return {
      ...turn,
      messageFragments: [...messageFragments],
    };
  }

  return {
    ...turn,
    initialDraftText: '',
    deliberationText: '',
    terminalAction: null,
    terminalText: '',
    terminalReason: null,
    messageFragments: [...messageFragments],
    events: [],
  };
}

function stripReviewerPlanEchoFromVoteFragments(
  messageFragments: readonly DMessageFragment[],
  reviewerPlanText: string | null,
): DMessageFragment[] {
  const normalizedPlanText = reviewerPlanText?.trim();
  if (!normalizedPlanText)
    return [...messageFragments];

  return messageFragments.filter(fragment => !isTextContentFragment(fragment) || fragment.part.text.trim() !== normalizedPlanText);
}

function buildLeaderCard(
  round: WorkflowCouncilSessionState['rounds'][number],
  workflowState: WorkflowCouncilSessionState,
  participantCardsMeta: ReadonlyMap<string, CouncilTraceParticipantMeta>,
): CouncilTraceAgentCard {
  const leaderParticipantId = round.leaderParticipantId ?? workflowState.leaderParticipantId;
  const turn = round?.leaderTurn ?? null;
  const leaderProposalFailed = isLeaderProposalFailedRound(round, workflowState);
  const participantMeta = getParticipantMeta(participantCardsMeta, leaderParticipantId);

  return createAgentCard({
    participantId: leaderParticipantId,
    participantName: participantMeta.name,
    participantModelLabel: participantMeta.modelLabel,
    participantReasoningLabel: participantMeta.reasoningLabel,
    role: 'leader',
    status: leaderProposalFailed
      ? 'failed'
      : turn?.terminalAction === 'proposal'
        ? 'proposal-ready'
        : 'waiting',
    excerpt: leaderProposalFailed
      ? COUNCIL_INVALID_PROPOSAL_TEXT
      : getAgentCardExcerpt(turn, round?.proposalText ?? null),
    terminalLabel: leaderProposalFailed
      ? 'Proposal failed'
      : turn?.terminalAction === 'proposal'
        ? 'Proposal ready'
        : null,
    terminalText: leaderProposalFailed
      ? COUNCIL_INVALID_PROPOSAL_TEXT
      : turn?.terminalText ?? round?.proposalText ?? '',
    terminalReason: leaderProposalFailed ? COUNCIL_INVALID_PROPOSAL_TEXT : turn?.terminalReason ?? null,
  }, turn, leaderProposalFailed ? COUNCIL_INVALID_PROPOSAL_TEXT : round?.proposalText ?? null);
}

type CouncilTraceAgentTurnSource =
  | CouncilAgentTurnRecord
  | WorkflowCouncilSessionState['rounds'][number]['reviewerTurns'][string]
  | null;

type CouncilTraceAgentCardBase = Omit<CouncilTraceAgentCard, 'hasDetails' | 'detailItems' | 'messageFragments' | 'messagePendingIncomplete'>;
type CouncilTraceReviewerCardBase = Omit<CouncilTraceReviewerCard, 'hasDetails' | 'detailItems' | 'messageFragments' | 'messagePendingIncomplete'>;

function createAgentCard<T extends CouncilTraceAgentCardBase | CouncilTraceReviewerCardBase>(
  cardBase: T,
  turn: CouncilTraceAgentTurnSource,
  fallbackTerminalText: string | null = null,
): T & Pick<CouncilTraceAgentCard, 'hasDetails' | 'detailItems' | 'messageFragments' | 'messagePendingIncomplete'> {
  const card = {
    ...cardBase,
    hasDetails: hasExpandableAgentDetails(cardBase, turn, fallbackTerminalText),
    messageFragments: turn?.messageFragments ?? [],
    messagePendingIncomplete: turn?.messagePendingIncomplete ?? false,
  } as T & Pick<CouncilTraceAgentCard, 'hasDetails' | 'detailItems' | 'messageFragments' | 'messagePendingIncomplete'>;
  let cachedDetailItems: CouncilTraceAgentDetailItem[] | null = null;

  Object.defineProperty(card, 'detailItems', {
    enumerable: true,
    configurable: true,
    get: () => {
      if (cachedDetailItems === null)
        cachedDetailItems = buildAgentDetailItems(turn, fallbackTerminalText);
      return cachedDetailItems;
    },
  });

  return card;
}

function normalizeCouncilTraceText(text: string | null | undefined): string | null {
  const normalizedText = text?.trim();
  return normalizedText ? normalizedText : null;
}

function getVisibleCouncilTraceTexts(cardBase: CouncilTraceAgentCardBase | CouncilTraceReviewerCardBase): Set<string> {
  const visibleTexts = new Set<string>();
  const excerptText = normalizeCouncilTraceText(cardBase.excerpt);
  if (excerptText)
    visibleTexts.add(excerptText);
  if ('reason' in cardBase) {
    const reasonText = normalizeCouncilTraceText(cardBase.reason);
    if (reasonText)
      visibleTexts.add(reasonText);
  }
  return visibleTexts;
}

function structuredFragmentsRevealAdditionalContent(
  messageFragments: readonly DMessageFragment[],
  visibleTexts: ReadonlySet<string>,
): boolean {
  for (const fragment of messageFragments) {
    if (!isTextContentFragment(fragment))
      return true;

    const fragmentText = normalizeCouncilTraceText(fragment.part.text);
    if (fragmentText && !visibleTexts.has(fragmentText))
      return true;
  }

  return false;
}

function hasExpandableAgentDetails(
  cardBase: CouncilTraceAgentCardBase | CouncilTraceReviewerCardBase,
  turn: CouncilTraceAgentTurnSource,
  fallbackTerminalText: string | null = null,
): boolean {
  const visibleTexts = getVisibleCouncilTraceTexts(cardBase);

  if (!turn) {
    const fallbackText = normalizeCouncilTraceText(fallbackTerminalText);
    return !!fallbackText && !visibleTexts.has(fallbackText);
  }

  if ((turn.messageFragments?.length ?? 0) > 0)
    return structuredFragmentsRevealAdditionalContent(turn.messageFragments, visibleTexts);

  if (turn.events.length) {
    for (const event of turn.events) {
      if (event.type === 'text-output') {
        const eventText = normalizeCouncilTraceText(event.text);
        if (eventText && !visibleTexts.has(eventText))
          return true;
        continue;
      }

      const terminalText = normalizeCouncilTraceText(event.text);
      if (terminalText && !visibleTexts.has(terminalText))
        return true;

      const terminalReason = normalizeCouncilTraceText(event.reason);
      if (terminalReason && !visibleTexts.has(terminalReason))
        return true;
    }

    return false;
  }

  return [
    turn.initialDraftText,
    turn.deliberationText,
    turn.terminalText,
    turn.terminalReason,
    fallbackTerminalText,
  ].some(text => {
    const normalizedText = normalizeCouncilTraceText(text);
    return !!normalizedText && !visibleTexts.has(normalizedText);
  });
}

function buildAgentDetailItems(
  turn: CouncilTraceAgentTurnSource,
  fallbackTerminalText: string | null = null,
): CouncilTraceAgentDetailItem[] {
  if (!turn) {
    return fallbackTerminalText
      ? [{
          type: 'terminal',
          action: 'proposal',
          text: fallbackTerminalText,
          reason: null,
        }]
      : [];
  }

  if (turn.events.length) {
    const detailItems: CouncilTraceAgentDetailItem[] = [];
    for (const event of turn.events) {
      if (event.type === 'text-output') {
        detailItems.push({ type: 'text-output', text: event.text });
        continue;
      }
      if (event.type === 'terminal') {
        detailItems.push({
          type: 'terminal',
          action: event.action,
          text: event.text,
          reason: event.reason,
        });
      }
    }
    return detailItems;
  }

  if (!turn.terminalAction)
    return turn.initialDraftText
      ? [{
          type: 'text-output',
          text: turn.initialDraftText,
        }]
      : [];

  return [
    ...(turn.initialDraftText ? [{
      type: 'text-output' as const,
      text: turn.initialDraftText,
    }] : []),
    ...(turn.deliberationText ? [{
      type: 'text-output' as const,
      text: turn.deliberationText,
    }] : []),
    {
      type: 'terminal' as const,
      action: turn.terminalAction,
      text: turn.terminalText,
      reason: turn.terminalReason,
    },
  ];
}

function getAgentCardExcerpt(
  turn: CouncilTraceAgentTurnSource,
  fallbackText: string | null,
): string | null {
  const getMeaningfulText = (text: string | null | undefined): string | null => {
    const normalizedText = text?.trim();
    return normalizedText ? normalizedText : null;
  };

  let latestTextOutput: string | null = null;
  if (turn?.events.length) {
    for (let index = turn.events.length - 1; index >= 0; index--) {
      const event = turn.events[index];
      if (event?.type === 'text-output') {
        latestTextOutput = getMeaningfulText(event.text);
        break;
      }
    }
  }

  const latestFragmentText = (turn?.messageFragments ?? [])
    .filter(isTextContentFragment)
    .map(fragment => fragment.part.text.trim())
    .filter(Boolean)
    .at(-1) ?? null;

  return (turn?.messagePendingIncomplete ? latestFragmentText : null)
    ?? latestTextOutput
    ?? latestFragmentText
    ?? getMeaningfulText(turn?.initialDraftText)
    ?? getMeaningfulText(turn?.deliberationText)
    ?? getMeaningfulText(turn?.terminalText)
    ?? getMeaningfulText(fallbackText)
    ?? null;
}

function getCouncilTraceSummaryStatus(
  overlayCouncilSession: OverlayCouncilSessionState,
  workflowState: WorkflowCouncilSessionState,
): CouncilTraceRenderItem['summaryStatus'] {
  if (workflowState.status === 'accepted' || overlayCouncilSession.status === 'completed')
    return 'accepted';
  if (overlayCouncilSession.status === 'stopped')
    return 'stopped';
  if (workflowState.status === 'exhausted')
    return 'exhausted';
  if (overlayCouncilSession.status === 'interrupted' || workflowState.status === 'interrupted')
    return 'interrupted';
  if (workflowState.status === 'drafting')
    return 'awaiting-leader-revision';
  return 'reviewing';
}

function isLeaderProposalFailedRound(
  round: WorkflowCouncilSessionState['rounds'][number],
  workflowState: WorkflowCouncilSessionState,
): boolean {
  return workflowState.roundIndex === round.roundIndex
    && round.phase === 'leader-proposal'
    && !round.proposalText
    && workflowState.status === 'interrupted'
    && workflowState.interruptionReason === COUNCIL_INTERRUPTION_REASON_INVALID_PROPOSAL;
}
