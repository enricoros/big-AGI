import type { DMessageFragment } from '~/common/stores/chat/chat.fragments';
import { agiUuid } from '~/common/util/idUtils';

import type { CouncilBallotDecision } from './_handleExecute.council';


export type CouncilSessionStartedPayload = {
  leaderParticipantId: string;
  reviewerParticipantIds: string[];
  maxRounds: number;
  latestUserMessageId?: string | null;
};

export type CouncilRoundStartedPayload = {
  roundIndex: number;
  leaderParticipantId: string;
  reviewerParticipantIds: string[];
  sharedRejectionReasons: string[];
};

export type CouncilLeaderTurnCommittedPayload = {
  roundIndex: number;
  participantId: string;
  proposalId: string;
  proposalText: string;
  deliberationText: string;
  messageFragments: DMessageFragment[];
  messagePendingIncomplete?: boolean;
};

export type CouncilReviewerPlanCommittedPayload = {
  roundIndex: number;
  participantId: string;
  planText: string;
  messageFragments: DMessageFragment[];
  messagePendingIncomplete?: boolean;
};

export type CouncilReviewerVoteCommittedPayload = {
  roundIndex: number;
  participantId: string;
  decision: CouncilBallotDecision;
  reason: string | null;
  fragmentTexts?: string[];
  messageFragments: DMessageFragment[];
  messagePendingIncomplete?: boolean;
};

export type CouncilRoundCompletedPayload = {
  roundIndex: number;
  outcome: 'accepted' | 'revise';
  rejectionReasons: string[];
};

export type CouncilSessionPausedPayload = {
  reason: string;
};

export type CouncilSessionResumedPayload = {
  reason?: string | null;
};

export type CouncilSessionStoppedPayload = {
  reason: string;
};

export type CouncilSessionAcceptedPayload = {
  roundIndex: number;
  proposalId: string;
  finalResponse: string;
};

export type CouncilSessionExhaustedPayload = {
  roundIndex: number;
};

export type CouncilOpPayloadByType = {
  session_started: CouncilSessionStartedPayload;
  round_started: CouncilRoundStartedPayload;
  leader_turn_committed: CouncilLeaderTurnCommittedPayload;
  reviewer_plan_committed: CouncilReviewerPlanCommittedPayload;
  reviewer_vote_committed: CouncilReviewerVoteCommittedPayload;
  round_completed: CouncilRoundCompletedPayload;
  session_paused: CouncilSessionPausedPayload;
  session_resumed: CouncilSessionResumedPayload;
  session_stopped: CouncilSessionStoppedPayload;
  session_accepted: CouncilSessionAcceptedPayload;
  session_exhausted: CouncilSessionExhaustedPayload;
};

export type CouncilOpType = keyof CouncilOpPayloadByType;

export type CouncilOp<T extends CouncilOpType = CouncilOpType> =
  T extends CouncilOpType
    ? {
        opId: string;
        phaseId: string;
        conversationId: string;
        sequence: number;
        createdAt: number;
        type: T;
        payload: CouncilOpPayloadByType[T];
      }
    : never;

export function createCouncilOp<T extends CouncilOpType>(
  existingOps: readonly CouncilOp[],
  type: T,
  payload: CouncilOpPayloadByType[T],
  meta?: {
    phaseId?: string;
    conversationId?: string;
    opId?: string;
    createdAt?: number;
  },
): CouncilOp<T> {
  return {
    opId: meta?.opId ?? agiUuid('council-op'),
    phaseId: meta?.phaseId ?? existingOps.at(-1)?.phaseId ?? '',
    conversationId: meta?.conversationId ?? existingOps.at(-1)?.conversationId ?? '',
    sequence: getNextCouncilSequence(existingOps),
    createdAt: meta?.createdAt ?? Date.now(),
    type,
    payload,
  } as CouncilOp<T>;
}

export function appendCouncilOps(existingOps: readonly CouncilOp[], nextOps: readonly CouncilOp[]): CouncilOp[] {
  const merged = [...existingOps];
  const existingOpIds = new Set(existingOps.map(op => op.opId));
  for (const nextOp of nextOps) {
    if (existingOpIds.has(nextOp.opId))
      continue;
    existingOpIds.add(nextOp.opId);
    merged.push(nextOp);
  }
  return merged.sort((a, b) => a.sequence - b.sequence || a.createdAt - b.createdAt);
}

function getNextCouncilSequence(existingOps: readonly CouncilOp[]): number {
  return existingOps.reduce((maxSequence, op) => Math.max(maxSequence, op.sequence), -1) + 1;
}
