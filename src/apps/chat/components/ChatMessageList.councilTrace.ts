import type { CouncilSessionState as WorkflowCouncilSessionState } from '../editors/_handleExecute.consensus';

import type { CouncilSessionState as OverlayCouncilSessionState } from '~/common/chat-overlay/store-perchat-composer_slice';
import type { DConversationParticipant } from '~/common/stores/chat/chat.conversation';
import type { DMessage } from '~/common/stores/chat/chat.message';


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
  label: 'Shared with next round' | 'Queued for next round' | 'Final rejection reasons';
  reasons: string[];
};

export type CouncilTraceReviewerCard = {
  participantId: string;
  participantName: string;
  decision: 'accept' | 'reject' | 'pending';
  reason: string | null;
};

export type CouncilTraceRoundItem = {
  roundIndex: number;
  defaultExpanded: boolean;
  proposalId: string | null;
  proposalText: string | null;
  leaderParticipantId: string;
  leaderParticipantName: string;
  reviewerCards: CouncilTraceReviewerCard[];
  sharedReasons: CouncilTraceSharedReasons | null;
};

export type CouncilTraceRenderItem = {
  phaseId: string;
  placement: CouncilTracePlacement;
  rounds: CouncilTraceRoundItem[];
  reviewerCount: number;
  totalRounds: number;
  summaryStatus: 'accepted' | 'reviewing' | 'awaiting-leader-revision' | 'interrupted' | 'exhausted';
};

type BuildCouncilTraceRenderParams = {
  messages: readonly DMessage[];
  participants: readonly DConversationParticipant[];
  councilSession: OverlayCouncilSessionState;
};

export type CouncilTraceRenderPlan = {
  traceItem: CouncilTraceRenderItem | null;
  showLegacyDeliberationToggle: boolean;
};

export function buildCouncilTraceRenderPlan(params: BuildCouncilTraceRenderParams): CouncilTraceRenderPlan {
  const traceItem = buildCouncilTraceRenderItem(params);
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

  const rounds = [...workflowState.rounds]
    .sort((a, b) => b.roundIndex - a.roundIndex)
    .map((round, index) => ({
      roundIndex: round.roundIndex,
      defaultExpanded: index === 0,
      proposalId: round.proposalId,
      proposalText: round.proposalText,
      leaderParticipantId: round.leaderParticipantId,
      leaderParticipantName: getParticipantName(params.participants, round.leaderParticipantId),
      reviewerCards: buildReviewerCards(round.roundIndex, workflowState, params.participants),
      sharedReasons: deriveSharedReasons(round.roundIndex, workflowState, params.councilSession),
    }));

  return {
    phaseId,
    placement: findCouncilTracePlacement(params.messages, phaseId),
    rounds,
    reviewerCount: workflowState.reviewerParticipantIds.length,
    totalRounds: workflowState.rounds.length,
    summaryStatus: getCouncilTraceSummaryStatus(params.councilSession, workflowState),
  };
}

function getParticipantName(participants: readonly DConversationParticipant[], participantId: string): string {
  return participants.find(participant => participant.id === participantId)?.name ?? participantId;
}

function findCouncilTracePlacement(messages: readonly DMessage[], phaseId: string): CouncilTracePlacement {
  const resultMessage = messages.find(message =>
    message.metadata?.consensus?.kind === 'result'
      && message.metadata.consensus.phaseId === phaseId,
  );

  return resultMessage
    ? { mode: 'before-message', anchorMessageId: resultMessage.id }
    : { mode: 'after-phase', phaseId };
}

function deriveSharedReasons(
  roundIndex: number,
  workflowState: WorkflowCouncilSessionState,
  overlayCouncilSession: OverlayCouncilSessionState,
): CouncilTraceSharedReasons | null {
  const round = workflowState.rounds.find(entry => entry.roundIndex === roundIndex);
  if (!round)
    return null;

  const reasons = round.ballots
    .filter((ballot): ballot is typeof ballot & { decision: 'reject'; reason: string } => ballot.decision === 'reject' && !!ballot.reason)
    .map(ballot => ballot.reason);
  if (!reasons.length)
    return null;

  const nextRound = workflowState.rounds.find(entry => entry.roundIndex === roundIndex + 1);
  if (nextRound?.proposalText)
    return { label: 'Shared with next round', reasons };
  if (nextRound && overlayCouncilSession.status !== 'interrupted')
    return { label: 'Shared with next round', reasons };
  if (nextRound)
    return { label: 'Queued for next round', reasons };
  return {
    label: getCouncilTraceSummaryStatus(overlayCouncilSession, workflowState) === 'exhausted'
      ? 'Final rejection reasons'
      : 'Queued for next round',
    reasons,
  };
}

function buildReviewerCards(
  roundIndex: number,
  workflowState: WorkflowCouncilSessionState,
  participants: readonly DConversationParticipant[],
): CouncilTraceReviewerCard[] {
  const round = workflowState.rounds.find(entry => entry.roundIndex === roundIndex);
  if (!round)
    return [];

  const allowPendingBallots = workflowState.status === 'reviewing' && workflowState.roundIndex === roundIndex;

  return workflowState.reviewerParticipantIds.flatMap(reviewerParticipantId => {
    const ballot = round.ballots.find(entry => entry.reviewerParticipantId === reviewerParticipantId);
    if (!ballot && !allowPendingBallots)
      return [];

    return [{
      participantId: reviewerParticipantId,
      participantName: getParticipantName(participants, reviewerParticipantId),
      decision: ballot?.decision ?? 'pending',
      reason: ballot?.decision === 'reject' ? ballot.reason ?? null : null,
    }];
  });
}

function getCouncilTraceSummaryStatus(
  overlayCouncilSession: OverlayCouncilSessionState,
  workflowState: WorkflowCouncilSessionState,
): CouncilTraceRenderItem['summaryStatus'] {
  if (workflowState.status === 'accepted' || overlayCouncilSession.status === 'completed')
    return 'accepted';
  if (workflowState.status === 'exhausted' || overlayCouncilSession.status === 'stopped')
    return 'exhausted';
  if (overlayCouncilSession.status === 'interrupted' || workflowState.status === 'interrupted')
    return 'interrupted';
  if (workflowState.status === 'drafting')
    return 'awaiting-leader-revision';
  return 'reviewing';
}
