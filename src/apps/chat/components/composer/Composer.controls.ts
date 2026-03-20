import type { CouncilSessionStatus } from '~/common/chat-overlay/store-perchat-composer_slice';
import type { DConversationTurnTerminationMode } from '~/common/stores/chat/chat.conversation';

import type { ChatExecuteMode } from '../../execute-mode/execute-mode.types';


export type ComposerStopAction =
  | 'abort-active-stop'
  | 'abort-conversation-temp'
  | null;

export type ComposerPauseAction =
  | 'abort-active-pause'
  | null;

export type ComposerResumeAction =
  | 'resume-council'
  | null;

export type ComposerActionBarIcon =
  | 'beam'
  | 'paintbrush'
  | 'psychology'
  | 'send'
  | 'telegram'
  | null;

export function getComposerActionBarState(params: {
  allAttachmentsCompatible: boolean;
  assistantAbortible: boolean;
  assistantParticipantCount: number;
  chatExecuteMenuShown: boolean;
  chatExecuteMode: ChatExecuteMode;
  chatExecuteModeSendColor: string;
  chatExecuteModeSendLabel: string;
  isMobile: boolean;
  micContinuation: boolean;
  turnTerminationMode: DConversationTurnTerminationMode;
}) {
  const isText = params.chatExecuteMode === 'generate-content';
  const isTextBeam = params.chatExecuteMode === 'beam-content';
  const isAppend = params.chatExecuteMode === 'append-user';
  const isReAct = params.chatExecuteMode === 'react-content';
  const isDraw = params.chatExecuteMode === 'generate-image';
  const showCouncilBypassSendAction = isText && params.assistantParticipantCount > 1 && params.turnTerminationMode === 'council';

  const sendButtonVariant = (isAppend || (params.isMobile && isTextBeam)) ? 'outlined' as const : 'solid' as const;
  const sendButtonColor =
    params.assistantAbortible ? 'warning'
      : !params.allAttachmentsCompatible ? 'warning'
        : params.chatExecuteModeSendColor;

  const sendButtonLabel = isText && params.assistantParticipantCount > 1
    ? params.turnTerminationMode === 'continuous'
      ? 'Start loop'
      : params.turnTerminationMode === 'council'
        ? 'Seek council agreement'
        : 'Send to room'
    : params.chatExecuteModeSendLabel;
  const showQueueSendAction = isText && params.assistantAbortible;
  const primarySendButtonLabel = showQueueSendAction ? 'Queue message' : sendButtonLabel;
  const secondarySendButtonLabel = showCouncilBypassSendAction ? 'Send to leader' : null;

  const turnModeChip = isText && params.assistantParticipantCount > 1
    ? {
      color: params.turnTerminationMode === 'continuous'
        ? 'warning' as const
        : params.turnTerminationMode === 'council'
          ? 'primary' as const
          : 'neutral' as const,
      label: params.turnTerminationMode === 'continuous'
        ? 'Agents loop'
        : params.turnTerminationMode === 'council'
          ? 'Council'
          : 'Human-driven',
      helper: params.turnTerminationMode === 'continuous'
        ? 'Agents will keep taking turns until you stop them.'
        : params.turnTerminationMode === 'council'
          ? 'Triggered agents must converge on the same reply before anything is shown.'
          : 'A human message starts an ordered pass; agent @mentions can extend the room until no follow-ups remain.',
    }
    : null;

  const primaryIcon: ComposerActionBarIcon =
    params.micContinuation ? null
      : isAppend ? 'send'
        : isReAct ? 'psychology'
          : isTextBeam ? 'beam'
            : isDraw ? 'paintbrush'
              : 'telegram';

  return {
    expanderVariant: params.chatExecuteMenuShown ? 'outlined' as const : params.assistantAbortible ? 'soft' as const : null,
    primaryIcon,
    primarySendButtonLabel,
    secondarySendButtonLabel,
    sendButtonColor,
    sendButtonVariant,
    showQueueSendAction,
    turnModeChip,
  };
}

export function getComposerCouncilRoundLabel(passIndex: number | null | undefined): string {
  return typeof passIndex === 'number' ? ` · round ${passIndex + 1}` : '';
}

export function getComposerSessionRoundLabel(
  turnTerminationMode: DConversationTurnTerminationMode,
  passIndex: number | null | undefined,
): string {
  return turnTerminationMode === 'council'
    ? getComposerCouncilRoundLabel(passIndex)
    : '';
}

function getComposerSessionSubject(turnTerminationMode: DConversationTurnTerminationMode): string {
  return turnTerminationMode === 'council'
    ? 'Council'
    : turnTerminationMode === 'continuous'
      ? 'Loop'
      : 'Room';
}

export function getComposerSessionStatusLabel(
  turnTerminationMode: DConversationTurnTerminationMode,
  councilSessionStatus: CouncilSessionStatus,
  interruptionReason?: string | null,
): string | null {
  const subject = getComposerSessionSubject(turnTerminationMode);
  if (turnTerminationMode === 'continuous' && councilSessionStatus === 'stopped' && interruptionReason === '@exit-loop')
    return 'Loop ended by leader';
  return councilSessionStatus === 'paused'
    ? `${subject} paused`
    : councilSessionStatus === 'stopped'
      ? `${subject} stopped`
      : councilSessionStatus === 'interrupted'
        ? `${subject} interrupted`
        : councilSessionStatus === 'completed'
          ? `${subject} completed`
          : councilSessionStatus === 'running'
            ? `${subject} running`
            : null;
}

export function getComposerResumeLabel(
  turnTerminationMode: DConversationTurnTerminationMode,
  assistantParticipantCount: number,
): string {
  if (turnTerminationMode === 'round-robin-per-human' && assistantParticipantCount <= 1)
    return 'Resume reply';

  return `Resume ${getComposerSessionSubject(turnTerminationMode).toLowerCase()}`;
}

export function getComposerTurnModeDisplayPolicy(isMobile: boolean, hasTurnModeChip: boolean) {
  return {
    showChip: hasTurnModeChip && isMobile,
    showHelper: hasTurnModeChip && !isMobile,
  };
}

export function getComposerThreadTargetDisplay(turnTerminationMode: DConversationTurnTerminationMode) {
  return {
    promptLabel: turnTerminationMode === 'council' ? 'Council board' : 'room',
    showChip: turnTerminationMode === 'council',
  };
}

export function getComposerInterruptionPolicy(params: {
  assistantAbortible: boolean;
  assistantParticipantCount: number;
  chatExecuteMode: ChatExecuteMode;
  councilSessionCanResume: boolean;
  councilSessionStatus: CouncilSessionStatus;
  hasTargetConversationId: boolean;
  turnTerminationMode: DConversationTurnTerminationMode;
}) {
  void params.chatExecuteMode;
  void params.councilSessionStatus;

  const isCouncilSession = params.turnTerminationMode === 'council';
  const hasSessionLifecycleControls =
    params.turnTerminationMode === 'continuous'
    || params.turnTerminationMode === 'council'
    || params.assistantParticipantCount > 1;
  const isMultiAgentSession = params.assistantParticipantCount > 1 || params.turnTerminationMode === 'continuous' || isCouncilSession;
  const showPause = params.assistantAbortible && hasSessionLifecycleControls;
  const showStop = params.assistantAbortible;
  const showResume = params.hasTargetConversationId && params.councilSessionCanResume && !params.assistantAbortible;

  return {
    isCouncilSession,
    showPause,
    showStop,
    showResume,
    pauseAction: showPause ? 'abort-active-pause' as const : null,
    stopAction: showStop
      ? (isMultiAgentSession ? 'abort-active-stop' : 'abort-conversation-temp')
      : null,
    resumeAction: showResume ? 'resume-council' as const : null,
  };
}
