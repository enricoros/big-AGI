import type { DPersistedCouncilSessionStatus } from '~/common/stores/chat/chat.conversation';

import {
  applyCouncilReviewBallots,
  createCouncilSessionState,
  doesCouncilRoundNeedLeaderProposal,
  recordCouncilProposal,
  recordCouncilReviewerPlan,
  recordCouncilReviewerVote,
} from './_handleExecute.council';
import type { CouncilSessionState } from './_handleExecute.council';
import type { CouncilOp } from './_handleExecute.council.log';


type ReplayedCouncilSessionStatus = DPersistedCouncilSessionStatus | 'stopped';

function isStoppedCouncilSessionResumable(reason: string | null | undefined): boolean {
  void reason;
  return true;
}

export type CouncilOpLogReplay = {
  workflowState: CouncilSessionState | null;
  phaseId: string | null;
  passIndex: number | null;
  canResume: boolean;
  persistedStatus: ReplayedCouncilSessionStatus | null;
  interruptionReason: string | null;
  updatedAt: number | null;
};

export function reduceCouncilOps(ops: readonly CouncilOp[]): CouncilSessionState | null {
  if (!ops.length)
    return null;

  const orderedOps = [...ops].sort((a, b) => a.sequence - b.sequence || a.createdAt - b.createdAt);
  const seenOpIds = new Set<string>();
  let session: CouncilSessionState | null = null;

  for (const op of orderedOps) {
    if (seenOpIds.has(op.opId))
      continue;
    seenOpIds.add(op.opId);

    switch (op.type) {
      case 'session_started': {
        session = withUpdatedAt(createCouncilSessionState({
          phaseId: op.phaseId,
          leaderParticipantId: op.payload.leaderParticipantId,
          reviewerParticipantIds: [...op.payload.reviewerParticipantIds],
          maxRounds: op.payload.maxRounds,
        }), op.createdAt);
        break;
      }

      case 'round_started': {
        assertCouncilSession(session, op.type);
        session = withUpdatedAt({
          ...session,
          status: 'drafting',
          roundIndex: op.payload.roundIndex,
          rounds: upsertRoundForReplay(session.rounds, op.payload.roundIndex, op.payload.leaderParticipantId, op.payload.sharedRejectionReasons),
        }, op.createdAt);
        break;
      }

      case 'leader_turn_committed': {
        assertCouncilSession(session, op.type);
        assertRoundIndex(session, op.payload.roundIndex, op.type);
        session = withUpdatedAt(recordCouncilProposal(session, {
          proposalId: op.payload.proposalId,
          leaderParticipantId: op.payload.participantId,
          proposalText: op.payload.proposalText,
          deliberationText: op.payload.deliberationText,
          messageFragments: op.payload.messageFragments,
          messagePendingIncomplete: op.payload.messagePendingIncomplete,
        }), op.createdAt);
        break;
      }

      case 'reviewer_plan_committed': {
        assertCouncilSession(session, op.type);
        assertRoundIndex(session, op.payload.roundIndex, op.type);
        session = withUpdatedAt(recordCouncilReviewerPlan(session, {
          reviewerParticipantId: op.payload.participantId,
          planText: op.payload.planText,
          messageFragments: op.payload.messageFragments,
          messagePendingIncomplete: op.payload.messagePendingIncomplete,
        }), op.createdAt);
        break;
      }

      case 'reviewer_vote_committed': {
        assertCouncilSession(session, op.type);
        assertRoundIndex(session, op.payload.roundIndex, op.type);
        session = withUpdatedAt(recordCouncilReviewerVote(session, {
          reviewerParticipantId: op.payload.participantId,
          fragmentTexts: op.payload.fragmentTexts,
          ballot: {
            reviewerParticipantId: op.payload.participantId,
            decision: op.payload.decision,
            ...(op.payload.reason ? { reason: op.payload.reason } : {}),
          },
          messageFragments: op.payload.messageFragments,
          messagePendingIncomplete: op.payload.messagePendingIncomplete,
        }), op.createdAt);
        break;
      }

      case 'round_completed': {
        assertCouncilSession(session, op.type);
        assertRoundIndex(session, op.payload.roundIndex, op.type);
        const currentRound = session.rounds[session.roundIndex];
        if (!currentRound)
          throw new Error(`Council op ${op.type} requires an active round`);
        session = withUpdatedAt(applyCouncilReviewBallots(session, currentRound.ballots), op.createdAt);
        break;
      }

      case 'session_paused':
      case 'session_stopped': {
        assertCouncilSession(session, op.type);
        session = withUpdatedAt({
          ...session,
          status: 'interrupted',
          interruptionReason: op.payload.reason,
        }, op.createdAt);
        break;
      }

      case 'session_resumed': {
        assertCouncilSession(session, op.type);
        session = withUpdatedAt({
          ...session,
          status: deriveActiveCouncilStatus(session),
          interruptionReason: op.payload.reason ?? null,
        }, op.createdAt);
        break;
      }

      case 'session_accepted': {
        assertCouncilSession(session, op.type);
        session = withUpdatedAt({
          ...session,
          status: 'accepted',
          acceptedProposalId: op.payload.proposalId,
          finalResponse: op.payload.finalResponse,
        }, op.createdAt);
        break;
      }

      case 'session_exhausted': {
        assertCouncilSession(session, op.type);
        session = withUpdatedAt({
          ...session,
          status: 'exhausted',
        }, op.createdAt);
        break;
      }
    }
  }

  return session;
}

export function replayCouncilOpLog(ops: readonly CouncilOp[]): CouncilOpLogReplay {
  if (!ops.length) {
    return {
      workflowState: null,
      phaseId: null,
      passIndex: null,
      canResume: false,
      persistedStatus: null,
      interruptionReason: null,
      updatedAt: null,
    };
  }

  const orderedOps = [...ops].sort((a, b) => a.sequence - b.sequence || a.createdAt - b.createdAt);
  const lastOp = orderedOps.at(-1) ?? null;
  let workflowState: CouncilSessionState | null = null;
  try {
    workflowState = reduceCouncilOps(orderedOps);
  } catch (error) {
    console.warn('Ignoring malformed council op log during replay.', {
      phaseId: lastOp?.phaseId ?? null,
      conversationId: lastOp?.conversationId ?? null,
      opCount: orderedOps.length,
      error,
    });
    return {
      workflowState: null,
      phaseId: lastOp?.phaseId ?? null,
      passIndex: null,
      canResume: false,
      persistedStatus: null,
      interruptionReason: null,
      updatedAt: lastOp?.createdAt ?? null,
    };
  }
  if (!workflowState || !lastOp) {
    return {
      workflowState: null,
      phaseId: null,
      passIndex: null,
      canResume: false,
      persistedStatus: null,
      interruptionReason: null,
      updatedAt: null,
    };
  }

  if (lastOp.type === 'session_paused') {
    return {
      workflowState,
      phaseId: workflowState.phaseId,
      passIndex: workflowState.roundIndex,
      canResume: true,
      persistedStatus: 'paused',
      interruptionReason: lastOp.payload.reason,
      updatedAt: lastOp.createdAt,
    };
  }

  if (lastOp.type === 'session_stopped') {
    const canResume = isStoppedCouncilSessionResumable(lastOp.payload.reason);
    return {
      workflowState,
      phaseId: workflowState.phaseId,
      passIndex: workflowState.roundIndex,
      canResume,
      persistedStatus: 'stopped',
      interruptionReason: lastOp.payload.reason,
      updatedAt: lastOp.createdAt,
    };
  }

  if (workflowState.status === 'accepted' || workflowState.status === 'exhausted') {
    return {
      workflowState,
      phaseId: workflowState.phaseId,
      passIndex: workflowState.roundIndex,
      canResume: false,
      persistedStatus: null,
      interruptionReason: workflowState.interruptionReason,
      updatedAt: lastOp.createdAt,
    };
  }

  return {
    workflowState: workflowState.status === 'interrupted'
      ? {
          ...workflowState,
          status: deriveActiveCouncilStatus(workflowState),
          interruptionReason: workflowState.interruptionReason,
        }
      : workflowState,
    phaseId: workflowState.phaseId,
    passIndex: workflowState.roundIndex,
    canResume: true,
    persistedStatus: 'interrupted',
    interruptionReason: workflowState.interruptionReason ?? 'recovered-from-log',
    updatedAt: lastOp.createdAt,
  };
}

function assertCouncilSession(session: CouncilSessionState | null, opType: CouncilOp['type']): asserts session is CouncilSessionState {
  if (!session)
    throw new Error(`Council op ${opType} requires session_started first`);
}

function assertRoundIndex(session: CouncilSessionState, roundIndex: number, opType: CouncilOp['type']): void {
  if (session.roundIndex !== roundIndex)
    throw new Error(`Council op ${opType} expected round ${session.roundIndex} but received ${roundIndex}`);
}

function withUpdatedAt(session: CouncilSessionState, updatedAt: number): CouncilSessionState {
  return {
    ...session,
    updatedAt,
  };
}

function upsertRoundForReplay(
  rounds: readonly CouncilSessionState['rounds'][number][],
  roundIndex: number,
  leaderParticipantId: string,
  sharedRejectionReasons: readonly string[],
): CouncilSessionState['rounds'] {
  const existingRound = rounds.find(round => round.roundIndex === roundIndex) ?? null;
  const nextRound = existingRound
    ? {
        ...existingRound,
        leaderParticipantId,
        sharedRejectionReasons: [...sharedRejectionReasons],
      }
    : {
        roundIndex,
        phase: 'leader-proposal' as const,
        proposalId: null,
        proposalText: null,
        leaderParticipantId,
        ballots: [],
        sharedRejectionReasons: [...sharedRejectionReasons],
        leaderTurn: null,
        reviewerTurns: {},
        leaderProposal: null,
        reviewerPlans: {},
        reviewerVotes: {},
        completedAt: null,
      };

  return [...rounds.filter(round => round.roundIndex !== roundIndex), nextRound]
    .sort((a, b) => a.roundIndex - b.roundIndex);
}

function deriveActiveCouncilStatus(session: CouncilSessionState): CouncilSessionState['status'] {
  if (session.status === 'accepted' || session.status === 'exhausted')
    return session.status;

  const currentRound = session.rounds[session.roundIndex];
  if (doesCouncilRoundNeedLeaderProposal(currentRound))
    return 'drafting';

  return 'reviewing';
}
