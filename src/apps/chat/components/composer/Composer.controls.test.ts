import assert from 'node:assert/strict';
import test from 'node:test';

import type { DConversationTurnTerminationMode } from '~/common/stores/chat/chat.conversation';
import type { CouncilSessionStatus } from '~/common/chat-overlay/store-perchat-composer_slice';
import type { ChatExecuteMode } from '../../execute-mode/execute-mode.types';

import {
  getComposerActionBarState,
  getComposerCouncilRoundLabel,
  getComposerInterruptionPolicy,
  getComposerResumeLabel,
  getComposerSessionRoundLabel,
  getComposerSessionStatusLabel,
  getComposerThreadTargetDisplay,
  getComposerTurnModeDisplayPolicy,
} from './Composer.controls';


const CHAT_EXECUTE_MODES: ChatExecuteMode[] = [
  'append-user',
  'beam-content',
  'generate-content',
  'generate-image',
  'react-content',
];

const TURN_TERMINATION_MODES: DConversationTurnTerminationMode[] = [
  'round-robin-per-human',
  'continuous',
  'council',
];

const COUNCIL_STATUSES: CouncilSessionStatus[] = [
  'idle',
  'running',
  'paused',
  'stopped',
  'interrupted',
  'completed',
];

test('getComposerInterruptionPolicy maps pause and stop actions across all chat and turn modes', async (t) => {
  for (const turnTerminationMode of TURN_TERMINATION_MODES) {
    for (const chatExecuteMode of CHAT_EXECUTE_MODES) {
      await t.test(`${turnTerminationMode} / ${chatExecuteMode}`, () => {
        const shouldShowPauseForSingleAgent = turnTerminationMode === 'continuous' || turnTerminationMode === 'council';
        const shouldShowPauseForMultiAgent = turnTerminationMode === 'continuous' || turnTerminationMode === 'council' || turnTerminationMode === 'round-robin-per-human';
        const singleAgentPolicy = getComposerInterruptionPolicy({
          assistantAbortible: true,
          assistantParticipantCount: 1,
          chatExecuteMode,
          councilSessionCanResume: false,
          councilSessionStatus: 'running',
          hasTargetConversationId: true,
          turnTerminationMode,
        });
        const multiAgentPolicy = getComposerInterruptionPolicy({
          assistantAbortible: true,
          assistantParticipantCount: 2,
          chatExecuteMode,
          councilSessionCanResume: false,
          councilSessionStatus: 'running',
          hasTargetConversationId: true,
          turnTerminationMode,
        });

        assert.equal(singleAgentPolicy.showStop, true);
        assert.equal(multiAgentPolicy.showStop, true);
        assert.equal(singleAgentPolicy.showPause, shouldShowPauseForSingleAgent);
        assert.equal(multiAgentPolicy.showPause, shouldShowPauseForMultiAgent);
        assert.equal(singleAgentPolicy.pauseAction, shouldShowPauseForSingleAgent ? 'abort-active-pause' : null);
        assert.equal(multiAgentPolicy.pauseAction, shouldShowPauseForMultiAgent ? 'abort-active-pause' : null);
        assert.equal(singleAgentPolicy.stopAction, turnTerminationMode === 'continuous' || turnTerminationMode === 'council' ? 'abort-active-stop' : 'abort-conversation-temp');
        assert.equal(multiAgentPolicy.stopAction, 'abort-active-stop');
      });
    }
  }
});

test('getComposerInterruptionPolicy exposes resume whenever the session is resumable across all chat modes and statuses', async (t) => {
  for (const turnTerminationMode of TURN_TERMINATION_MODES) {
    for (const chatExecuteMode of CHAT_EXECUTE_MODES) {
      for (const councilSessionStatus of COUNCIL_STATUSES) {
        await t.test(`${turnTerminationMode} / ${chatExecuteMode} / ${councilSessionStatus}`, () => {
          const resumableSingleAgentPolicy = getComposerInterruptionPolicy({
            assistantAbortible: false,
            assistantParticipantCount: 1,
            chatExecuteMode,
            councilSessionCanResume: true,
            councilSessionStatus,
            hasTargetConversationId: true,
            turnTerminationMode,
          });
          const resumablePolicy = getComposerInterruptionPolicy({
            assistantAbortible: false,
            assistantParticipantCount: 2,
            chatExecuteMode,
            councilSessionCanResume: true,
            councilSessionStatus,
            hasTargetConversationId: true,
            turnTerminationMode,
          });
          const hiddenResumePolicy = getComposerInterruptionPolicy({
            assistantAbortible: true,
            assistantParticipantCount: 2,
            chatExecuteMode,
            councilSessionCanResume: true,
            councilSessionStatus,
            hasTargetConversationId: true,
            turnTerminationMode,
          });

          assert.equal(resumableSingleAgentPolicy.showResume, true);
          assert.equal(resumableSingleAgentPolicy.resumeAction, 'resume-council');
          assert.equal(resumablePolicy.showResume, true);
          assert.equal(resumablePolicy.resumeAction, 'resume-council');
          assert.equal(hiddenResumePolicy.showResume, false);
          assert.equal(hiddenResumePolicy.resumeAction, null);
        });
      }
    }
  }
});

test('getComposerInterruptionPolicy requires both a target conversation and resume capability before showing resume', () => {
  const missingConversation = getComposerInterruptionPolicy({
    assistantAbortible: false,
    assistantParticipantCount: 2,
    chatExecuteMode: 'generate-content',
    councilSessionCanResume: true,
    councilSessionStatus: 'paused',
    hasTargetConversationId: false,
    turnTerminationMode: 'council',
  });
  const noResumeCapability = getComposerInterruptionPolicy({
    assistantAbortible: false,
    assistantParticipantCount: 2,
    chatExecuteMode: 'generate-content',
    councilSessionCanResume: false,
    councilSessionStatus: 'paused',
    hasTargetConversationId: true,
    turnTerminationMode: 'council',
  });

  assert.equal(missingConversation.showResume, false);
  assert.equal(noResumeCapability.showResume, false);
});

test('getComposerInterruptionPolicy exposes pause and resume outside council mode for human-driven rooms and agent loops', () => {
  const humanDrivenPolicy = getComposerInterruptionPolicy({
    assistantAbortible: true,
    assistantParticipantCount: 4,
    chatExecuteMode: 'generate-content',
    councilSessionCanResume: true,
    councilSessionStatus: 'interrupted',
    hasTargetConversationId: true,
    turnTerminationMode: 'round-robin-per-human',
  });
  const agentsLoopPolicy = getComposerInterruptionPolicy({
    assistantAbortible: false,
    assistantParticipantCount: 1,
    chatExecuteMode: 'generate-content',
    councilSessionCanResume: true,
    councilSessionStatus: 'paused',
    hasTargetConversationId: true,
    turnTerminationMode: 'continuous',
  });

  assert.equal(humanDrivenPolicy.isCouncilSession, false);
  assert.equal(humanDrivenPolicy.showPause, true);
  assert.equal(humanDrivenPolicy.pauseAction, 'abort-active-pause');
  assert.equal(humanDrivenPolicy.showResume, false);
  assert.equal(agentsLoopPolicy.isCouncilSession, false);
  assert.equal(agentsLoopPolicy.showPause, false);
  assert.equal(agentsLoopPolicy.showResume, true);
  assert.equal(agentsLoopPolicy.resumeAction, 'resume-council');
});

test('getComposerInterruptionPolicy exposes resume for single-agent human-driven chats after unexpected interruption', () => {
  const interruptedSingleAgentPolicy = getComposerInterruptionPolicy({
    assistantAbortible: false,
    assistantParticipantCount: 1,
    chatExecuteMode: 'generate-content',
    councilSessionCanResume: true,
    councilSessionStatus: 'interrupted',
    hasTargetConversationId: true,
    turnTerminationMode: 'round-robin-per-human',
  });

  assert.equal(interruptedSingleAgentPolicy.isCouncilSession, false);
  assert.equal(interruptedSingleAgentPolicy.showPause, false);
  assert.equal(interruptedSingleAgentPolicy.showResume, true);
  assert.equal(interruptedSingleAgentPolicy.resumeAction, 'resume-council');
});

test('getComposerActionBarState shows queueing while an assistant reply is abortible', () => {
  const result = getComposerActionBarState({
    allAttachmentsCompatible: true,
    assistantAbortible: true,
    assistantParticipantCount: 1,
    chatExecuteMenuShown: false,
    chatExecuteMode: 'generate-content',
    chatExecuteModeSendColor: 'primary',
    chatExecuteModeSendLabel: 'Send',
    isMobile: false,
    micContinuation: false,
    turnTerminationMode: 'round-robin-per-human',
  });

  assert.deepStrictEqual(result, {
    expanderVariant: 'soft',
    primaryIcon: 'telegram',
    primarySendButtonLabel: 'Queue message',
    secondarySendButtonLabel: null,
    sendButtonColor: 'warning',
    sendButtonVariant: 'solid',
    showQueueSendAction: true,
    turnModeChip: null,
  });
});

test('getComposerActionBarState derives the council send state for multi-agent text chats', () => {
  const result = getComposerActionBarState({
    allAttachmentsCompatible: true,
    assistantAbortible: false,
    assistantParticipantCount: 3,
    chatExecuteMenuShown: false,
    chatExecuteMode: 'generate-content',
    chatExecuteModeSendColor: 'primary',
    chatExecuteModeSendLabel: 'Send',
    isMobile: false,
    micContinuation: false,
    turnTerminationMode: 'council',
  });

  assert.deepStrictEqual(result, {
    expanderVariant: null,
    primaryIcon: 'telegram',
    primarySendButtonLabel: 'Seek council agreement',
    secondarySendButtonLabel: 'Send to leader',
    sendButtonColor: 'primary',
    sendButtonVariant: 'solid',
    showQueueSendAction: false,
    turnModeChip: {
      color: 'primary',
      helper: 'Triggered agents must converge on the same reply before anything is shown.',
      label: 'Council',
    },
  });
});

test('getComposerActionBarState derives the continuous send state for multi-agent text chats', () => {
  const result = getComposerActionBarState({
    allAttachmentsCompatible: true,
    assistantAbortible: false,
    assistantParticipantCount: 4,
    chatExecuteMenuShown: false,
    chatExecuteMode: 'generate-content',
    chatExecuteModeSendColor: 'primary',
    chatExecuteModeSendLabel: 'Send',
    isMobile: false,
    micContinuation: false,
    turnTerminationMode: 'continuous',
  });

  assert.equal(result.primarySendButtonLabel, 'Start loop');
  assert.equal(result.secondarySendButtonLabel, null);
  assert.deepStrictEqual(result.turnModeChip, {
    color: 'warning',
    helper: 'Agents will keep taking turns until you stop them.',
    label: 'Agents loop',
  });
});

test('getComposerActionBarState derives the human-led room state for multi-agent text chats', () => {
  const result = getComposerActionBarState({
    allAttachmentsCompatible: true,
    assistantAbortible: false,
    assistantParticipantCount: 2,
    chatExecuteMenuShown: false,
    chatExecuteMode: 'generate-content',
    chatExecuteModeSendColor: 'primary',
    chatExecuteModeSendLabel: 'Send',
    isMobile: false,
    micContinuation: false,
    turnTerminationMode: 'round-robin-per-human',
  });

  assert.equal(result.primarySendButtonLabel, 'Send to room');
  assert.equal(result.secondarySendButtonLabel, null);
  assert.deepStrictEqual(result.turnModeChip, {
    color: 'neutral',
    helper: 'A human message starts an ordered pass; agent @mentions can extend the room until no follow-ups remain.',
    label: 'Human-driven',
  });
});

test('getComposerActionBarState warns on incompatible attachments even when not aborting', () => {
  const result = getComposerActionBarState({
    allAttachmentsCompatible: false,
    assistantAbortible: false,
    assistantParticipantCount: 1,
    chatExecuteMenuShown: false,
    chatExecuteMode: 'generate-content',
    chatExecuteModeSendColor: 'primary',
    chatExecuteModeSendLabel: 'Send',
    isMobile: false,
    micContinuation: false,
    turnTerminationMode: 'round-robin-per-human',
  });

  assert.equal(result.sendButtonColor, 'warning');
  assert.equal(result.secondarySendButtonLabel, null);
});

test('getComposerActionBarState uses outlined variant for append and mobile beam modes', async (t) => {
  await t.test('append-user', () => {
    const result = getComposerActionBarState({
      allAttachmentsCompatible: true,
      assistantAbortible: false,
      assistantParticipantCount: 1,
      chatExecuteMenuShown: false,
      chatExecuteMode: 'append-user',
      chatExecuteModeSendColor: 'neutral',
      chatExecuteModeSendLabel: 'Append',
      isMobile: false,
      micContinuation: false,
      turnTerminationMode: 'round-robin-per-human',
    });

    assert.equal(result.sendButtonVariant, 'outlined');
    assert.equal(result.primaryIcon, 'send');
    assert.equal(result.primarySendButtonLabel, 'Append');
    assert.equal(result.secondarySendButtonLabel, null);
  });

  await t.test('beam-content on mobile', () => {
    const result = getComposerActionBarState({
      allAttachmentsCompatible: true,
      assistantAbortible: false,
      assistantParticipantCount: 1,
      chatExecuteMenuShown: false,
      chatExecuteMode: 'beam-content',
      chatExecuteModeSendColor: 'secondary',
      chatExecuteModeSendLabel: 'Beam',
      isMobile: true,
      micContinuation: false,
      turnTerminationMode: 'round-robin-per-human',
    });

    assert.equal(result.sendButtonVariant, 'outlined');
    assert.equal(result.primaryIcon, 'beam');
    assert.equal(result.primarySendButtonLabel, 'Beam');
    assert.equal(result.secondarySendButtonLabel, null);
  });
});

test('getComposerActionBarState suppresses the send icon during mic continuation and outlines the expander when the menu is open', () => {
  const result = getComposerActionBarState({
    allAttachmentsCompatible: true,
    assistantAbortible: false,
    assistantParticipantCount: 1,
    chatExecuteMenuShown: true,
    chatExecuteMode: 'react-content',
    chatExecuteModeSendColor: 'success',
    chatExecuteModeSendLabel: 'Reason',
    isMobile: false,
    micContinuation: true,
    turnTerminationMode: 'round-robin-per-human',
  });

  assert.equal(result.primaryIcon, null);
  assert.equal(result.expanderVariant, 'outlined');
  assert.equal(result.primarySendButtonLabel, 'Reason');
  assert.equal(result.secondarySendButtonLabel, null);
});

test('getComposerCouncilRoundLabel uses round naming for council progress', () => {
  assert.equal(getComposerCouncilRoundLabel(0), ' · round 1');
  assert.equal(getComposerCouncilRoundLabel(2), ' · round 3');
  assert.equal(getComposerCouncilRoundLabel(null), '');
});

test('composer session round labels are only shown for council mode', () => {
  assert.equal(getComposerSessionRoundLabel('council', 2), ' · round 3');
  assert.equal(getComposerSessionRoundLabel('round-robin-per-human', 2), '');
  assert.equal(getComposerSessionRoundLabel('continuous', 2), '');
  assert.equal(getComposerSessionRoundLabel('round-robin-per-human', null), '');
});

test('composer session labels follow the active turn mode instead of always saying council', () => {
  assert.equal(getComposerSessionStatusLabel('round-robin-per-human', 'paused'), 'Room paused');
  assert.equal(getComposerSessionStatusLabel('continuous', 'interrupted'), 'Loop interrupted');
  assert.equal(getComposerSessionStatusLabel('continuous', 'stopped', '@exit-loop'), 'Loop ended by leader');
  assert.equal(getComposerSessionStatusLabel('council', 'completed'), 'Council completed');
  assert.equal(getComposerSessionStatusLabel('round-robin-per-human', 'idle'), null);
  assert.equal(getComposerResumeLabel('round-robin-per-human', 1), 'Resume reply');
  assert.equal(getComposerResumeLabel('round-robin-per-human', 2), 'Resume room');
  assert.equal(getComposerResumeLabel('continuous', 1), 'Resume loop');
  assert.equal(getComposerResumeLabel('council', 3), 'Resume council');
});

test('turn mode display policy avoids redundant desktop chip plus helper copy', () => {
  assert.deepStrictEqual(getComposerTurnModeDisplayPolicy(true, true), {
    showChip: true,
    showHelper: false,
  });
  assert.deepStrictEqual(getComposerTurnModeDisplayPolicy(false, true), {
    showChip: false,
    showHelper: true,
  });
  assert.deepStrictEqual(getComposerTurnModeDisplayPolicy(false, false), {
    showChip: false,
    showHelper: false,
  });
});

test('composer thread target display only exposes the council board chip in council mode', () => {
  assert.deepStrictEqual(getComposerThreadTargetDisplay('council'), {
    promptLabel: 'Council board',
    showChip: true,
  });
  assert.deepStrictEqual(getComposerThreadTargetDisplay('round-robin-per-human'), {
    promptLabel: 'room',
    showChip: false,
  });
  assert.deepStrictEqual(getComposerThreadTargetDisplay('continuous'), {
    promptLabel: 'room',
    showChip: false,
  });
});
