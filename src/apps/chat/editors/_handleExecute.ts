import type { DLLMId } from '~/common/stores/llms/llms.types';
import { getChatLLMId } from '~/common/stores/llms/store-llms';
import { getChatAutoAI } from '../store-app-chat';

import type { SystemPurposeId } from '../../../data';
import { SystemPurposes } from '../../../data';

import { agiCustomId, agiUuid } from '~/common/util/idUtils';

import type { DConversationId, DConversationParticipant, DConversationTurnTerminationMode } from '~/common/stores/chat/chat.conversation';
import { createDMessageEmpty, createDMessageTextContent, MESSAGE_FLAG_VND_ANT_CACHE_AUTO, MESSAGE_FLAG_VND_ANT_CACHE_USER, messageHasUserFlag, messageSetUserFlag } from '~/common/stores/chat/chat.message';
import type { DMessage, DMessageCouncilChannel } from '~/common/stores/chat/chat.message';
import { messageFragmentsReduceText } from '~/common/stores/chat/chat.message';
import { duplicateDMessage } from '~/common/stores/chat/chat.message';
import { createIdleCouncilSessionState } from '~/common/chat-overlay/store-perchat-composer_slice';
import { createTextContentFragment, isContentOrAttachmentFragment, isImageRefPart, isTextContentFragment, isZyncAssetImageReferencePart } from '~/common/stores/chat/chat.fragments';
import { getConversationParticipants, getConversationTurnTerminationMode } from '~/common/stores/chat/store-chats';

import type { ChatExecuteMode } from '../execute-mode/execute-mode.types';
import { textToDrawCommand } from '../commands/CommandsDraw';

import {
  applyCouncilReviewBallots,
  classifyCouncilReviewBallotFragments,
  classifyConsensusTextFragments,
  CONSENSUS_TRANSCRIPT_PREFIX,
  createCouncilSessionState,
  evaluateConsensusPass,
  extractCouncilProposalText,
  getConsensusResumePassIndex,
  hydrateCouncilSessionFromTranscriptEntries,
  recordCouncilProposal,
} from './_handleExecute.consensus';
import type { ConsensusProtocolAction, CouncilSessionState } from './_handleExecute.consensus';
import type { PersonaRunOptions } from './chat-persona';
import type { ChatExecutionRuntime, ChatExecutionSession } from './chat-execution.runtime';


async function inlineUpdatePurposeInHistory(history: DMessage[], assistantLlmId: DLLMId | undefined, purposeId: SystemPurposeId | null, customPrompt?: string | null): Promise<void> {
  const systemMessageIndex = history.findIndex(message => message.role === 'system');

  let systemMessage: DMessage = systemMessageIndex >= 0
    ? history.splice(systemMessageIndex, 1)[0]
    : createDMessageEmpty('system');

  const extraInstruction = customPrompt?.trim() || '';
  if (!systemMessage.updated && purposeId && SystemPurposes[purposeId]?.systemMessage) {
    systemMessage.purposeId = purposeId;
    let systemMessageText = SystemPurposes[purposeId].systemMessage;
    try {
      const { bareBonesPromptMixer } = await import('~/modules/persona/pmix/pmix');
      systemMessageText = bareBonesPromptMixer(SystemPurposes[purposeId].systemMessage, assistantLlmId);
    } catch {
      // Node-only tests do not load the Next font pipeline used by the prompt mixer.
    }
    if (extraInstruction)
      systemMessageText = `${systemMessageText.trim()}\n\nAdditional agent instructions:\n${extraInstruction}`;
    systemMessage.fragments = [createTextContentFragment(systemMessageText)];

    if (purposeId === 'Custom')
      systemMessage.updated = Date.now();

    systemMessage = { ...systemMessage };
  }

  history.unshift(systemMessage);
}

function inlineUpdateAutoPromptCaching(history: DMessage[]): void {
  let setAuto = getChatAutoAI().autoVndAntBreakpoints;
  if (setAuto && history.length > 0) {
    const { gt1000 } = history.reduce((acc, message) => {
      if (acc.gt1000)
        return acc;
      acc.tokens += message.tokenCount || 0;
      acc.gt1000 = acc.tokens > 1000;
      return acc;
    }, { tokens: 0, gt1000: false });
    setAuto = gt1000;
  }

  let breakpointsRemaining = 2;
  for (let index = history.length - 1; index >= 0; index--) {
    if (!setAuto) {
      if (messageHasUserFlag(history[index], MESSAGE_FLAG_VND_ANT_CACHE_AUTO))
        history[index] = { ...history[index], userFlags: messageSetUserFlag(history[index], MESSAGE_FLAG_VND_ANT_CACHE_AUTO, false) };
      continue;
    }

    const isSystemInstruction = index === 0 && history[index].role === 'system';
    if (!isSystemInstruction && history[index].role !== 'user')
      continue;

    let autoState = --breakpointsRemaining >= 0 || isSystemInstruction;
    if (autoState && messageHasUserFlag(history[index], MESSAGE_FLAG_VND_ANT_CACHE_USER))
      autoState = false;
    if (autoState !== messageHasUserFlag(history[index], MESSAGE_FLAG_VND_ANT_CACHE_AUTO))
      history[index] = { ...history[index], userFlags: messageSetUserFlag(history[index], MESSAGE_FLAG_VND_ANT_CACHE_AUTO, autoState) };
  }
}

async function resolveChatExecutionRuntime(runtime?: ChatExecutionRuntime): Promise<ChatExecutionRuntime> {
  if (runtime)
    return runtime;
  const { getDefaultChatExecutionRuntime } = await import('./chat-execution.runtime.default');
  return getDefaultChatExecutionRuntime();
}

function escapeMentionToken(mention: string): string {
  return mention.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findMentionMatchIndex(messageText: string, mention: string): number | null {
  const normalizedMention = mention.trim();
  if (!normalizedMention)
    return null;

  const explicitMentionRegex = new RegExp(`(^|[^\\p{L}\\p{N}])@${escapeMentionToken(normalizedMention)}(?=$|[^\\p{L}\\p{N}])`, 'iu');
  const explicitMatch = explicitMentionRegex.exec(messageText);
  if (explicitMatch)
    return explicitMatch.index + ((explicitMatch[0] ?? '').length - (`@${normalizedMention}`).length);

  const bareMentionRegex = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeMentionToken(normalizedMention)}(?=$|[^\\p{L}\\p{N}])`, 'iu');
  const bareMatch = bareMentionRegex.exec(messageText);
  if (bareMatch)
    return bareMatch.index + ((bareMatch[0] ?? '').length - normalizedMention.length);

  return null;
}

function hasMentionToken(message: DMessage | null, mention: string): boolean {
  if (!message)
    return false;

  return message.fragments.some(fragment => isTextContentFragment(fragment) && findMentionMatchIndex(fragment.part.text, mention) !== null);
}

function getMentionedParticipants(
  message: DMessage | null,
  participants: DConversationParticipant[],
  excludeParticipantIds: ReadonlySet<string> = new Set(),
): DConversationParticipant[] {
  if (!message)
    return [];

  const messageText = messageFragmentsReduceText(message.fragments).trim();
  const implicitReplyParticipants = (message.metadata?.inReferenceTo ?? [])
    .filter(reference => reference.mCarryAuthorMention !== false)
    .map(reference => {
      const participantId = reference.mAuthorParticipantId?.trim() || null;
      if (participantId)
        return participants.find(participant => participant.id === participantId) ?? null;

      const participantName = reference.mAuthorParticipantName?.trim() || null;
      if (!participantName)
        return null;

      return participants.find(participant => participant.name?.trim() === participantName) ?? null;
    })
    .filter((participant): participant is DConversationParticipant => !!participant && !excludeParticipantIds.has(participant.id));

  const implicitReplyParticipantIds = new Set(implicitReplyParticipants.map(participant => participant.id));
  if (!messageText)
    return implicitReplyParticipants;

  const allMentionMatch = new RegExp(`(^|[^\\p{L}\\p{N}])@all(?=$|[^\\p{L}\\p{N}])`, 'iu').exec(messageText);
  const explicitMentions = participants
    .filter(participant => !excludeParticipantIds.has(participant.id) && !!participant.name?.trim())
    .map(participant => {
      const matchIndex = findMentionMatchIndex(messageText, participant.name ?? '');
      return matchIndex !== null ? { participant, index: matchIndex } : null;
    })
    .filter((entry): entry is { participant: DConversationParticipant; index: number } => !!entry)
    .sort((a, b) => a.index - b.index)
    .map(entry => entry.participant);

  const mergedExplicitMentions = [
    ...implicitReplyParticipants,
    ...explicitMentions.filter(participant => !implicitReplyParticipantIds.has(participant.id)),
  ];

  if (!allMentionMatch)
    return mergedExplicitMentions;

  const explicitMentionIds = new Set(mergedExplicitMentions.map(participant => participant.id));
  const remainingParticipants = participants.filter(participant => !excludeParticipantIds.has(participant.id) && !explicitMentionIds.has(participant.id));
  return [...mergedExplicitMentions, ...remainingParticipants];
}

function wasParticipantMentioned(message: DMessage | null, participant: DConversationParticipant): boolean {
  return getMentionedParticipants(message, [participant]).length > 0;
}

function hasStopToken(message: DMessage | null): boolean {
  if (!message)
    return false;

  const messageText = messageFragmentsReduceText(message.fragments).trim();
  return /(^|[^\p{L}\p{N}])@stop(?=$|[^\p{L}\p{N}])/iu.test(messageText);
}

function buildMultiAgentCoordinationMessage(participants: DConversationParticipant[], activeParticipant: DConversationParticipant): DMessage {
  const assistantLines = participants
    .filter(participant => participant.kind === 'assistant' && participant.personaId)
    .map((participant, index) => {
      const speakMode = participant.speakWhen === 'when-mentioned' ? 'speaks only when @mentioned' : 'speaks every turn';
      const activeMarker = participant.id === activeParticipant.id ? ' [you are this agent]' : '';
      return `${index + 1}. ${participant.name} — ${participant.personaId}${participant.llmId ? ` — model ${participant.llmId}` : ''} — ${speakMode}${activeMarker}`;
    });

  const instruction = [
    'You are participating in a multi-agent group chat.',
    'Other assistant messages in the conversation were written by other agents in the same room, not by the user.',
    'Read the latest user request and the prior assistant replies before answering.',
    'Do not treat prior assistant replies as pasted transcript or quoted input from the user.',
    'Avoid repeating the same answer when another agent already covered it; instead continue, refine, or add a distinct contribution.',
    'Current agent roster and speaking order:',
    ...assistantLines,
  ].join('\n');

  const message = createDMessageTextContent('system', instruction);
  message.updated = message.created;
  return message;
}

async function preparePersonaHistory(sourceHistory: Readonly<DMessage[]>, assistantLlmId: DLLMId, purposeId: SystemPurposeId, participants: DConversationParticipant[], activeParticipant: DConversationParticipant): Promise<DMessage[]> {
  const participantHistory = [...sourceHistory];
  await inlineUpdatePurposeInHistory(participantHistory, assistantLlmId, purposeId, activeParticipant.customPrompt);

  const coordinationMessage = buildMultiAgentCoordinationMessage(participants, activeParticipant);
  const systemMessage = participantHistory.find(message => message.role === 'system') ?? null;
  const systemTextFragment = systemMessage?.fragments.find(isTextContentFragment) ?? null;
  const coordinationTextFragment = coordinationMessage.fragments.find(isTextContentFragment) ?? null;

  if (systemMessage && systemTextFragment && coordinationTextFragment) {
    systemTextFragment.part.text = `${systemTextFragment.part.text.trim()}\n\n${coordinationTextFragment.part.text}`;
  } else {
    participantHistory.unshift(coordinationMessage);
  }

  inlineUpdateAutoPromptCaching(participantHistory);
  return participantHistory;
}


function findConsensusPlaceholderMessageId(
  messages: Readonly<DMessage[]>,
  phaseId: string,
  passIndex: number,
  participantId: string,
): string | null {
  return [...messages]
    .reverse()
    .find(message => {
      const consensus = message.metadata?.consensus;
      return message.role === 'assistant'
        && !!message.pendingIncomplete
        && consensus?.kind === 'deliberation'
        && consensus.phaseId === phaseId
        && consensus.passIndex === passIndex
        && message.metadata?.author?.participantId === participantId;
    })?.id ?? null;
}

function getConsensusParticipantsRemaining(messages: Readonly<DMessage[]>, phaseId: string, passIndex: number, runnableParticipants: DConversationParticipant[]): DConversationParticipant[] {
  const spokenParticipantIds = new Set(messages
    .filter(message => {
      const consensus = message.metadata?.consensus;
      return message.role === 'assistant'
        && consensus?.kind === 'deliberation'
        && consensus.phaseId === phaseId
        && consensus.passIndex === passIndex
        && !!message.metadata?.author?.participantId;
    })
    .map(message => message.metadata?.author?.participantId)
    .filter((participantId): participantId is string => !!participantId));

  return runnableParticipants.filter(participant => !spokenParticipantIds.has(participant.id));
}

function getConsensusSpokenParticipantIdsByPass(messages: Readonly<DMessage[]>, phaseId: string): Map<number, Set<string>> {
  return messages.reduce((spokenByPass, message) => {
    const consensus = message.metadata?.consensus;
    const participantId = message.metadata?.author?.participantId;
    if (message.role !== 'assistant'
      || consensus?.kind !== 'deliberation'
      || consensus.phaseId !== phaseId
      || typeof consensus.passIndex !== 'number'
      || !participantId)
      return spokenByPass;

    const spokenParticipantIds = spokenByPass.get(consensus.passIndex) ?? new Set<string>();
    spokenParticipantIds.add(participantId);
    spokenByPass.set(consensus.passIndex, spokenParticipantIds);
    return spokenByPass;
  }, new Map<number, Set<string>>());
}

function normalizeCouncilChannel(channel: DMessageCouncilChannel | null | undefined): DMessageCouncilChannel {
  return channel?.channel
    ? {
      ...channel,
      ...(channel.directParticipantIds ? { directParticipantIds: [...channel.directParticipantIds] } : {}),
      ...(channel.visibleToParticipantIds ? { visibleToParticipantIds: [...channel.visibleToParticipantIds] } : {}),
    }
    : { channel: 'public-board' };
}

function describeCouncilChannel(councilChannel: DMessageCouncilChannel, participants: DConversationParticipant[], conversationId: DConversationId): string {
  void participants;
  void conversationId;

  if (councilChannel.channel === 'public-board')
    return 'the public council board';

  if (councilChannel.channel === 'direct') {
    const directNames = (councilChannel.directParticipantIds ?? [])
      .map(participantId => participants.find(participant => participant.id === participantId)?.name ?? null)
      .filter((name): name is string => !!name);
    return directNames.length ? `direct chat (${directNames.join(' · ')})` : 'that direct chat';
  }

  return 'that council thread';
}

function messageMatchesCouncilChannel(message: DMessage, councilChannel: DMessageCouncilChannel): boolean {
  const messageChannel = normalizeCouncilChannel(message.metadata?.councilChannel);

  if (councilChannel.channel === 'public-board')
    return messageChannel.channel === 'public-board';

  if (councilChannel.channel === 'direct') {
    if (messageChannel.channel !== 'direct')
      return false;
    const threadParticipantIds = new Set(councilChannel.directParticipantIds ?? []);
    return (messageChannel.directParticipantIds ?? []).some(participantId => threadParticipantIds.has(participantId));
  }

  return messageChannel.channel === councilChannel.channel;
}

function getParticipantsForCouncilChannel(
  participants: DConversationParticipant[],
  councilChannel: DMessageCouncilChannel,
  conversationId: DConversationId,
): DConversationParticipant[] {
  void conversationId;

  if (councilChannel.channel === 'public-board')
    return participants;

  if (councilChannel.channel === 'direct') {
    const directIds = new Set(councilChannel.directParticipantIds ?? []);
    return participants.filter(participant => directIds.has(participant.id));
  }

  return participants;
}

function getHistoryForCouncilChannel(messages: Readonly<DMessage[]>, councilChannel: DMessageCouncilChannel): DMessage[] {
  return messages
    .filter(message => message.role === 'system' || messageMatchesCouncilChannel(message, councilChannel))
    .map(message => duplicateDMessage(message, false));
}
const CONSENSUS_PUBLIC_BOARD_CHANNEL: DMessageCouncilChannel = { channel: 'public-board' };
const CONSENSUS_MAX_PASSES = 12;

type ConsensusPassAction = {
  participant: DConversationParticipant;
  action: ConsensusProtocolAction;
  messageId: string;
  response: string;
  deliberationText: string;
};

type ConsensusDeliberation = {
  participant: DConversationParticipant;
  action: ConsensusProtocolAction;
  deliberationText: string;
  response: string;
  assistantMessageId: string | null;
};

type CouncilRunInterruption = 'paused' | 'stopped' | 'interrupted';

function getCouncilInterruption(abortController: AbortController): { status: CouncilRunInterruption; reason: string } | null {
  if (!abortController.signal.aborted)
    return null;

  const rawReason = typeof abortController.signal.reason === 'string'
    ? abortController.signal.reason.trim()
    : '';

  if (rawReason === '@pause')
    return { status: 'paused', reason: rawReason };
  if (rawReason === '@stop' || rawReason === 'stop' || rawReason === 'chat-stop')
    return { status: 'stopped', reason: rawReason || 'chat-stop' };
  return { status: 'interrupted', reason: rawReason || 'aborted' };
}

function setCouncilSessionRunning(
  session: ChatExecutionSession,
  executeMode: ChatExecuteMode,
  mode: DConversationTurnTerminationMode,
  phaseId: string | null,
  passIndex: number | null,
  workflowState: CouncilSessionState | null = null,
): void {
  const nextSession = {
    status: 'running' as const,
    executeMode,
    mode,
    phaseId,
    passIndex,
    workflowState,
    canResume: false,
    interruptionReason: null,
  };
  session.updateCouncilSession(nextSession);
  session.persistCouncilSession(null);
}

function finalizeCouncilSession(
  session: ChatExecutionSession,
  interruption: { status: CouncilRunInterruption; reason: string } | null,
  mode: DConversationTurnTerminationMode,
  phaseId: string | null,
  passIndex: number | null,
  workflowState: CouncilSessionState | null = null,
): void {
  if (interruption) {
    const resumableSession = {
      status: interruption.status,
      executeMode: 'generate-content' as const,
      mode,
      phaseId,
      passIndex,
      workflowState,
      canResume: interruption.status !== 'stopped',
      interruptionReason: interruption.reason,
      updatedAt: Date.now(),
    };
    session.updateCouncilSession(resumableSession);
    session.persistCouncilSession(resumableSession.canResume
      ? {
          status: resumableSession.status === 'paused' ? 'paused' : 'interrupted',
          executeMode: resumableSession.executeMode,
          mode: resumableSession.mode,
          phaseId: resumableSession.phaseId,
          passIndex: resumableSession.passIndex,
          workflowState: resumableSession.workflowState,
          canResume: resumableSession.canResume,
          interruptionReason: resumableSession.interruptionReason,
          updatedAt: resumableSession.updatedAt,
        }
      : null);
    return;
  }

  session.setCouncilSession({
    ...createIdleCouncilSessionState(),
    status: 'completed',
    executeMode: 'generate-content',
    mode,
    phaseId,
    passIndex,
    workflowState,
    canResume: false,
    interruptionReason: null,
    updatedAt: Date.now(),
  });
  session.persistCouncilSession(null);
}

function beginCouncilSession(
  session: ChatExecutionSession,
  mode: DConversationTurnTerminationMode,
  phaseId: string | null = null,
  workflowState: CouncilSessionState | null = null,
): void {
  session.setCouncilSession({
    ...createIdleCouncilSessionState(),
    status: 'running',
    executeMode: 'generate-content',
    mode,
    phaseId,
    passIndex: workflowState?.roundIndex ?? 0,
    workflowState,
    canResume: false,
    interruptionReason: null,
    updatedAt: Date.now(),
  });
  session.persistCouncilSession(null);
}

function getConsensusLeaderParticipant(participants: DConversationParticipant[]): DConversationParticipant | null {
  return participants.find(participant => participant.isLeader) ?? participants[0] ?? null;
}

function isConsensusDeliberationMessage(message: Pick<DMessage, 'metadata'> | null | undefined): boolean {
  return message?.metadata?.consensus?.kind === 'deliberation';
}

function getConsensusVisibleTranscript(messages: Readonly<DMessage[]>, phaseId: string): DMessage[] {
  return messages.filter(message => {
    const consensus = message.metadata?.consensus;
    return consensus?.kind === 'deliberation' && consensus.phaseId === phaseId;
  });
}

function getCouncilSourceHistory(messages: Readonly<DMessage[]>, phaseId: string): DMessage[] {
  return messages
    .filter(message => {
      const consensus = message.metadata?.consensus;
      if (!consensus)
        return true;
      return consensus.phaseId !== phaseId;
    })
    .map(message => duplicateDMessage(message, false));
}

function appendCouncilInstruction(history: DMessage[], instructionLines: string[]): DMessage[] {
  const instruction = instructionLines.join('\n');
  const councilMessage = createDMessageTextContent('system', instruction);
  councilMessage.updated = councilMessage.created;

  const systemMessage = history.find(message => message.role === 'system') ?? null;
  const systemTextFragment = systemMessage?.fragments.find(isTextContentFragment) ?? null;
  const councilTextFragment = councilMessage.fragments.find(isTextContentFragment) ?? null;

  if (systemMessage && systemTextFragment && councilTextFragment) {
    systemTextFragment.part.text = `${systemTextFragment.part.text.trim()}\n\n${councilTextFragment.part.text}`;
    return history;
  }

  history.unshift(councilMessage);
  return history;
}

async function prepareCouncilLeaderHistory(
  sourceHistory: Readonly<DMessage[]>,
  assistantLlmId: DLLMId,
  purposeId: SystemPurposeId,
  participants: DConversationParticipant[],
  activeParticipant: DConversationParticipant,
  rejectionReasons: readonly string[],
  roundIndex: number,
): Promise<DMessage[]> {
  const participantHistory = [...sourceHistory];
  await inlineUpdatePurposeInHistory(participantHistory, assistantLlmId, purposeId, activeParticipant.customPrompt);

  const reviewerNames = participants
    .filter(participant => participant.kind === 'assistant' && participant.id !== activeParticipant.id)
    .map(participant => participant.name);

  const instruction = [
    'Stateful Council mode is active.',
    'You are the Leader.',
    'Reviewers are isolated from each other and will only return Accept or Reject(reason).',
    'Write the single best user-facing answer that addresses the original user request.',
    'Output only the proposal text. Do not add labels, explanations, or reviewer instructions.',
    `Current round: ${roundIndex + 1}.`,
    `Current agent: ${activeParticipant.name}.`,
    reviewerNames.length ? `Reviewers: ${reviewerNames.join(', ')}.` : 'There are no reviewers.',
    rejectionReasons.length
      ? `Prior rejection reasons:\n${rejectionReasons.map((reason, index) => `${index + 1}. ${reason}`).join('\n')}`
      : 'Prior rejection reasons: none.',
  ];

  appendCouncilInstruction(participantHistory, instruction);
  inlineUpdateAutoPromptCaching(participantHistory);
  return participantHistory;
}

async function prepareCouncilReviewerHistory(
  sourceHistory: Readonly<DMessage[]>,
  assistantLlmId: DLLMId,
  purposeId: SystemPurposeId,
  activeParticipant: DConversationParticipant,
  leaderParticipant: DConversationParticipant,
  proposalText: string,
  rejectionReasons: readonly string[],
  roundIndex: number,
): Promise<DMessage[]> {
  const participantHistory = [...sourceHistory];
  await inlineUpdatePurposeInHistory(participantHistory, assistantLlmId, purposeId, activeParticipant.customPrompt);

  const instruction = [
    'Stateful Council mode is active.',
    'You are an isolated reviewer.',
    `Leader: ${leaderParticipant.name}.`,
    'You cannot communicate with other reviewers during this round.',
    'Review the current Leader proposal against the user request.',
    'Return exactly one of the following forms and nothing else:',
    '[[accept]]',
    '[[reject]] <reason>',
    'If you reject, provide one concise reason. Do not rewrite the answer.',
    `Current round: ${roundIndex + 1}.`,
    `Current proposal:\n${proposalText}`,
    rejectionReasons.length
      ? `Shared rejection reasons from earlier rounds:\n${rejectionReasons.map((reason, index) => `${index + 1}. ${reason}`).join('\n')}`
      : 'Shared rejection reasons from earlier rounds: none.',
  ];

  appendCouncilInstruction(participantHistory, instruction);
  inlineUpdateAutoPromptCaching(participantHistory);
  return participantHistory;
}

function getAssistantMessageForParticipantSinceLatestUser(messages: Readonly<DMessage[]>, latestUserMessageId: string | null, participantId: string): DMessage | null {
  return [...getAssistantMessagesSinceLatestUser(messages, latestUserMessageId)]
    .reverse()
    .find(message => message.metadata?.author?.participantId === participantId) ?? null;
}


async function runCouncilLeaderProposal(
  runtime: ChatExecutionRuntime,
  session: ChatExecutionSession,
  llmId: DLLMId,
  conversationId: DConversationId,
  participant: DConversationParticipant,
  participantHistory: Readonly<DMessage[]>,
  sharedAbortController: AbortController,
): Promise<string> {
  const { finalMessage } = await runtime.runPersona({
    assistantLlmId: llmId,
    conversationId,
    systemPurposeId: participant.personaId!,
    keepAbortController: true,
    sharedAbortController,
    participant,
    sourceHistory: participantHistory,
    createPlaceholder: false,
    session,
  });

  return extractCouncilProposalText((finalMessage.fragments ?? [])
    .filter(isTextContentFragment)
    .map(fragment => fragment.part.text));
}

async function runCouncilReviewerBallot(
  runtime: ChatExecutionRuntime,
  session: ChatExecutionSession,
  llmId: DLLMId,
  conversationId: DConversationId,
  participant: DConversationParticipant,
  participantHistory: Readonly<DMessage[]>,
  sharedAbortController: AbortController,
) {
  const { finalMessage } = await runtime.runPersona({
    assistantLlmId: llmId,
    conversationId,
    systemPurposeId: participant.personaId!,
    keepAbortController: true,
    sharedAbortController,
    participant,
    sourceHistory: participantHistory,
    createPlaceholder: false,
    session,
  });

  return classifyCouncilReviewBallotFragments((finalMessage.fragments ?? [])
    .filter(isTextContentFragment)
    .map(fragment => fragment.part.text), participant.id);
}

function createCouncilRoundMessage(
  participant: DConversationParticipant,
  participantLlmId: DLLMId,
  phaseId: string,
  roundIndex: number,
  action: 'proposal' | 'accept' | 'reject',
  text: string,
  leaderParticipantId: string,
  reason?: string,
): DMessage {
  const visibleText = action === 'proposal'
    ? text
    : action === 'accept'
      ? 'Accept'
      : `Reject: ${reason || 'review failed'}`;
  const message = createDMessageTextContent('assistant', visibleText);
  message.metadata = {
    ...message.metadata,
    author: {
      participantId: participant.id,
      participantName: participant.name,
      personaId: participant.personaId,
      llmId: participant.llmId ?? participantLlmId,
    },
    councilChannel: CONSENSUS_PUBLIC_BOARD_CHANNEL,
    initialRecipients: [{ rt: 'public-board' }],
    consensus: {
      kind: 'deliberation',
      phaseId,
      passIndex: roundIndex,
      provisional: false,
      action,
      agreedResponse: action === 'proposal' ? text : undefined,
      leaderParticipantId,
      reason: action === 'reject' ? reason || 'review failed' : undefined,
    },
  };
  message.updated = message.created;
  return message;
}

function createCouncilNotificationMessage(phaseId: string, roundIndex: number, text: string): DMessage {
  const message = createDMessageTextContent('system', text);
  message.metadata = {
    ...message.metadata,
    councilChannel: { channel: 'system' },
    consensus: {
      kind: 'notification',
      phaseId,
      passIndex: roundIndex,
    },
  };
  message.updated = message.created;
  return message;
}

function appendCouncilAcceptedResult(session: ChatExecutionSession, agreedResponse: string, leaderParticipant: DConversationParticipant, phaseId: string, roundIndex: number): void {
  const finalMessage = createDMessageTextContent('assistant', agreedResponse);
  finalMessage.metadata = {
    ...finalMessage.metadata,
    author: {
      participantId: leaderParticipant.id,
      participantName: leaderParticipant.name,
      personaId: leaderParticipant.personaId ?? null,
      llmId: leaderParticipant.llmId ?? null,
    },
    consensus: {
      kind: 'result',
      phaseId,
      passIndex: roundIndex,
      action: 'agree',
      agreedResponse,
      leaderParticipantId: leaderParticipant.id,
    },
  };
  session.messageAppend(finalMessage);
}

export async function runConsensusSequence(
  session: ChatExecutionSession,
  conversationId: DConversationId,
  participantsInOrder: DConversationParticipant[],
  defaultChatLlmId: DLLMId,
  latestUserMessageId: string | null,
  initialCouncilState: CouncilSessionState | null = null,
  runtime?: ChatExecutionRuntime,
): Promise<boolean> {
  void latestUserMessageId;

  if (!participantsInOrder.length)
    return false;

  const phaseId = initialCouncilState?.phaseId ?? `consensus-${agiCustomId(12)}`;
  const resolvedRuntime = await resolveChatExecutionRuntime(runtime);
  const sharedAbortController = resolvedRuntime.createAbortController();
  const leaderParticipant = getConsensusLeaderParticipant(participantsInOrder);
  if (!leaderParticipant)
    return false;
  const reviewerParticipants = participantsInOrder.filter(participant => participant.id !== leaderParticipant?.id && participant.kind === 'assistant' && !!participant.personaId);
  let currentCouncilState: CouncilSessionState = initialCouncilState ?? createCouncilSessionState({
    phaseId,
    leaderParticipantId: leaderParticipant.id,
    reviewerParticipantIds: reviewerParticipants.map(participant => participant.id),
    maxRounds: CONSENSUS_MAX_PASSES,
  });
  session.setAbortController(sharedAbortController, 'chat-persona-consensus');
  beginCouncilSession(session, 'consensus', phaseId, currentCouncilState);

  try {
    while (!sharedAbortController.signal.aborted && (currentCouncilState.status === 'drafting' || currentCouncilState.status === 'reviewing')) {
      const roundIndex = currentCouncilState.roundIndex;
      setCouncilSessionRunning(session, 'generate-content', 'consensus', phaseId, roundIndex, currentCouncilState);
      const currentConversationHistory = session.historyViewHeadOrThrow(`chat-persona-consensus-round-${roundIndex}`) as Readonly<DMessage[]>;
      const latestUserMessage = [...currentConversationHistory].reverse().find(message => message.role === 'user') ?? null;
      if (hasStopToken(latestUserMessage)) {
        sharedAbortController.abort('@stop');
        break;
      }

      if (!leaderParticipant.personaId)
        break;

      const leaderLlmId = leaderParticipant.llmId ?? defaultChatLlmId;
      if (!leaderLlmId)
        break;

      const councilSourceHistory = getCouncilSourceHistory(currentConversationHistory, phaseId);
      if (currentCouncilState.status === 'drafting') {
        const leaderHistory = await prepareCouncilLeaderHistory(
          councilSourceHistory,
          leaderLlmId,
          leaderParticipant.personaId,
          participantsInOrder,
          leaderParticipant,
          currentCouncilState.rounds[currentCouncilState.roundIndex]?.sharedRejectionReasons ?? [],
          currentCouncilState.roundIndex,
        );
        const proposalText = await runCouncilLeaderProposal(
          resolvedRuntime,
          session,
          leaderLlmId,
          conversationId,
          leaderParticipant,
          leaderHistory,
          sharedAbortController,
        );
        if (sharedAbortController.signal.aborted)
          break;

        if (!proposalText.trim()) {
          session.messageAppend(createCouncilNotificationMessage(
            phaseId,
            roundIndex,
            'Leader failed to produce a valid proposal. Council will stop.',
          ));
          return false;
        }

        currentCouncilState = recordCouncilProposal(currentCouncilState, {
          proposalId: `${phaseId}-proposal-${roundIndex + 1}`,
          leaderParticipantId: leaderParticipant.id,
          proposalText,
        });
        session.messageAppend(createCouncilRoundMessage(
          leaderParticipant,
          leaderLlmId,
          phaseId,
          roundIndex,
          'proposal',
          proposalText,
          leaderParticipant.id,
        ));
        setCouncilSessionRunning(session, 'generate-content', 'consensus', phaseId, roundIndex, currentCouncilState);
      }

      const activeRound = currentCouncilState.rounds[currentCouncilState.roundIndex];
      const proposalText = activeRound?.proposalText?.trim() ?? '';
      if (!proposalText)
        return false;

      let ballots = [...(activeRound?.ballots ?? [])];
      const reviewedParticipantIds = new Set(ballots.map(ballot => ballot.reviewerParticipantId));

      for (const reviewer of reviewerParticipants) {
        if (sharedAbortController.signal.aborted)
          break;
        if (reviewedParticipantIds.has(reviewer.id))
          continue;

        const reviewerLlmId = reviewer.llmId ?? defaultChatLlmId;
        let ballot;
        if (!reviewer.personaId || !reviewerLlmId) {
          ballot = {
            reviewerParticipantId: reviewer.id,
            decision: 'reject' as const,
            reason: 'review failed',
          };
        } else {
          try {
            const reviewerHistory = await prepareCouncilReviewerHistory(
              councilSourceHistory,
              reviewerLlmId,
              reviewer.personaId,
              reviewer,
              leaderParticipant,
              proposalText,
              currentCouncilState.rounds[currentCouncilState.roundIndex]?.sharedRejectionReasons ?? [],
              currentCouncilState.roundIndex,
            );
            ballot = await runCouncilReviewerBallot(
              resolvedRuntime,
              session,
              reviewerLlmId,
              conversationId,
              reviewer,
              reviewerHistory,
              sharedAbortController,
            );
          } catch {
            if (sharedAbortController.signal.aborted)
              break;
            ballot = {
              reviewerParticipantId: reviewer.id,
              decision: 'reject' as const,
              reason: 'review failed',
            };
          }
        }

        if (sharedAbortController.signal.aborted)
          break;

        ballots = [...ballots, ballot];
        reviewedParticipantIds.add(reviewer.id);
        session.messageAppend(createCouncilRoundMessage(
          reviewer,
          reviewerLlmId ?? defaultChatLlmId ?? '',
          phaseId,
          roundIndex,
          ballot.decision,
          proposalText,
          leaderParticipant.id,
          ballot.reason,
        ));

        currentCouncilState = {
          ...currentCouncilState,
          status: 'reviewing',
          rounds: currentCouncilState.rounds.map(round => round.roundIndex !== roundIndex
            ? round
            : {
                ...round,
                ballots,
              }),
          updatedAt: Date.now(),
        };
        setCouncilSessionRunning(session, 'generate-content', 'consensus', phaseId, roundIndex, currentCouncilState);
      }

      if (sharedAbortController.signal.aborted)
        break;

      currentCouncilState = applyCouncilReviewBallots(currentCouncilState, ballots);
      if (currentCouncilState.status === 'accepted') {
        if (currentCouncilState.finalResponse)
          appendCouncilAcceptedResult(session, currentCouncilState.finalResponse, leaderParticipant, phaseId, roundIndex);
        return !sharedAbortController.signal.aborted;
      }

      if (currentCouncilState.status === 'exhausted') {
        const rejectionReasons = ballots.reduce<string[]>((reasons, ballot) => {
          if (ballot.decision === 'reject' && ballot.reason)
            reasons.push(ballot.reason);
          return reasons;
        }, []);
        session.messageAppend(createCouncilNotificationMessage(
          phaseId,
          roundIndex,
          rejectionReasons.length
            ? `Council exhausted after ${roundIndex + 1} rounds. Final rejection reasons:\n${rejectionReasons.map((reason, index) => `${index + 1}. ${reason}`).join('\n')}`
            : `Council exhausted after ${roundIndex + 1} rounds.`,
        ));
        return false;
      }

      const rejectionReasons = ballots.reduce<string[]>((reasons, ballot) => {
        if (ballot.decision === 'reject' && ballot.reason)
          reasons.push(ballot.reason);
        return reasons;
      }, []);
      if (rejectionReasons.length) {
        session.messageAppend(createCouncilNotificationMessage(
          phaseId,
          roundIndex,
          `Round ${roundIndex + 1} rejected. Rejection reasons:\n${rejectionReasons.map((reason, index) => `${index + 1}. ${reason}`).join('\n')}`,
        ));
      }
    }

    return false;
  } finally {
    const interruption = getCouncilInterruption(sharedAbortController);
    session.clearAbortController('chat-persona-consensus');
    finalizeCouncilSession(session, interruption, 'consensus', phaseId, currentCouncilState.roundIndex, currentCouncilState);
  }
}

async function runParticipantSequence(
  session: ChatExecutionSession,
  conversationId: DConversationId,
  participantsInOrder: DConversationParticipant[],
  allAssistantParticipants: DConversationParticipant[],
  defaultChatLlmId: DLLMId,
  turnTerminationMode: DConversationTurnTerminationMode,
  latestUserMessageId: string | null,
  councilChannel: DMessageCouncilChannel,
  runtime?: ChatExecutionRuntime,
): Promise<boolean> {
  if (!participantsInOrder.length)
    return false;

  const resolvedRuntime = await resolveChatExecutionRuntime(runtime);
  const sharedAbortController = resolvedRuntime.createAbortController();
  session.setAbortController(sharedAbortController, 'chat-persona-multi');
  beginCouncilSession(session, turnTerminationMode);

  let continuousTurnCount = 0;

  try {
    const results: boolean[] = [];
    const participantCount = participantsInOrder.length;
    let pendingMentionedParticipantIds: string[] = [];
    let allowRoundRobinMentionContinuation = false;

    while (!sharedAbortController.signal.aborted) {
      setCouncilSessionRunning(session, 'generate-content', turnTerminationMode, null, continuousTurnCount);
      const historyForTurn = getHistoryForCouncilChannel(
        session.historyViewHeadOrThrow(`chat-persona-multi-${continuousTurnCount}`) as Readonly<DMessage[]>,
        councilChannel,
      );
      const latestUserMessage = [...historyForTurn].reverse().find(message => message.role === 'user') ?? null;
      if (hasStopToken(latestUserMessage)) {
        sharedAbortController.abort('@stop');
        break;
      }
      const participantsForPassBase = turnTerminationMode === 'continuous'
        ? getContinuousParticipants(historyForTurn, latestUserMessageId, participantsInOrder)
        : allowRoundRobinMentionContinuation
          ? participantsInOrder
          : getParticipantsRemainingThisTurn(historyForTurn, latestUserMessageId, participantsInOrder);

      const queuedMentionedParticipants = pendingMentionedParticipantIds
        .map(participantId => participantsForPassBase.find(participant => participant.id === participantId) ?? null)
        .filter((participant): participant is DConversationParticipant => !!participant);
      const queuedMentionedParticipantIds = new Set(queuedMentionedParticipants.map(participant => participant.id));
      const participantsForPass = [
        ...queuedMentionedParticipants,
        ...participantsForPassBase.filter(participant => !queuedMentionedParticipantIds.has(participant.id)),
      ];
      pendingMentionedParticipantIds = [];

      if (!participantsForPass.length)
        break;

      let madeProgressThisPass = false;

      for (const participant of participantsForPass) {
        if (sharedAbortController.signal.aborted)
          break;

        const participantPersonaId = participant.personaId;
        const participantLlmId = participant.llmId ?? defaultChatLlmId;
        if (!participantPersonaId || !participantLlmId)
          continue;

        const sourceHistory = getHistoryForCouncilChannel(
          session.historyViewHeadOrThrow(`chat-persona-multi-${participant.id}-${continuousTurnCount}`) as Readonly<DMessage[]>,
          councilChannel,
        );
        const participantHistory = await preparePersonaHistory(sourceHistory, participantLlmId, participantPersonaId, participantsInOrder, participant);
        const result = await resolvedRuntime.runPersona({
          assistantLlmId: participantLlmId,
          conversationId,
          systemPurposeId: participantPersonaId,
          keepAbortController: true,
          sharedAbortController,
          participant,
          sourceHistory: participantHistory,
          createPlaceholder: true,
          messageChannel: councilChannel,
          session,
        });
        results.push(result.success);

        madeProgressThisPass = madeProgressThisPass || result.success;

        if (sharedAbortController.signal.aborted)
          break;

        const updatedHistory = session.historyViewHeadOrThrow(`chat-persona-multi-after-${participant.id}-${continuousTurnCount}`) as Readonly<DMessage[]>;
        const latestAssistantMessage = [...updatedHistory].reverse().find(message => message.role === 'assistant' && message.metadata?.author?.participantId === participant.id) ?? null;
        const mentionedParticipants = getMentionedParticipants(latestAssistantMessage, allAssistantParticipants, new Set([participant.id]));
        if (!mentionedParticipants.length)
          continue;

        if (turnTerminationMode === 'continuous') {
          pendingMentionedParticipantIds = [
            ...mentionedParticipants.map(mentionedParticipant => mentionedParticipant.id),
            ...pendingMentionedParticipantIds.filter(participantId => !mentionedParticipants.some(mentionedParticipant => mentionedParticipant.id === participantId)),
          ];
          break;
        }

        allowRoundRobinMentionContinuation = true;
        pendingMentionedParticipantIds = [
          ...mentionedParticipants.map(mentionedParticipant => mentionedParticipant.id),
          ...pendingMentionedParticipantIds.filter(participantId => !mentionedParticipants.some(mentionedParticipant => mentionedParticipant.id === participantId)),
        ];

        const currentParticipantIndex = participantsForPass.indexOf(participant);
        if (currentParticipantIndex < 0)
          continue;

        const trailingParticipants = participantsForPass.slice(currentParticipantIndex + 1);
        const followUpParticipants = mentionedParticipants;
        if (!followUpParticipants.length)
          continue;

        const followUpParticipantIds = new Set(followUpParticipants.map(followUpParticipant => followUpParticipant.id));
        const reorderedTrailingParticipants = [
          ...followUpParticipants,
          ...trailingParticipants.filter(trailingParticipant => !followUpParticipantIds.has(trailingParticipant.id)),
        ];
        participantsForPass.splice(currentParticipantIndex + 1, trailingParticipants.length, ...reorderedTrailingParticipants);
      }

      if ((turnTerminationMode !== 'continuous' && !allowRoundRobinMentionContinuation) || !madeProgressThisPass)
        break;

      if (turnTerminationMode !== 'continuous' && pendingMentionedParticipantIds.length === 0)
        break;

      continuousTurnCount++;
      if (participantCount <= 1 && continuousTurnCount >= 1)
        break;
    }

    return results.some(Boolean);
  } finally {
    const interruption = getCouncilInterruption(sharedAbortController);
    session.clearAbortController('chat-persona-multi');
    finalizeCouncilSession(session, interruption, turnTerminationMode, null, continuousTurnCount);
  }
}

export async function _handleExecute(chatExecuteMode: ChatExecuteMode, conversationId: DConversationId, executeCallerNameDebug: string, runtime?: ChatExecutionRuntime) {
  const resolvedRuntime = await resolveChatExecutionRuntime(runtime);

  const participants = getConversationParticipants(conversationId);
  const assistantParticipants = participants.filter(participant => participant.kind === 'assistant' && !!participant.personaId);
  const primaryParticipant = assistantParticipants[0] ?? null;
  const chatLLMId = primaryParticipant?.llmId ?? getChatLLMId();
  const systemPurposeId = primaryParticipant?.personaId ?? null;
  const turnTerminationMode = getConversationTurnTerminationMode(conversationId);

  // Handle missing conversation
  if (!conversationId)
    return 'err-no-conversation';

  const session = resolvedRuntime.getSession(conversationId);
  const initialHistory = session.historyViewHeadOrThrow('handle-execute-' + executeCallerNameDebug) as Readonly<DMessage[]>;

  // Handle unconfigured
  if (!chatLLMId || !chatExecuteMode)
    return !chatLLMId ? 'err-no-chatllm' : 'err-no-chatmode';

  // handle missing last user message (or fragment)
  // note that we use the initial history, as the user message could have been displaced on the edited versions
  const lastMessage = initialHistory.length >= 1 ? initialHistory.slice(-1)[0] : null;
  const firstFragment = lastMessage?.fragments[0];
  if (!lastMessage || !firstFragment)
    return 'err-no-last-message';


  // execute a command, if the last message has one
  if (lastMessage.role === 'user' && isTextContentFragment(firstFragment) && firstFragment.part.text.trimStart().startsWith('/')) {
    const { _handleExecuteCommand, RET_NO_CMD } = await import('./_handleExecuteCommand');
    const cmdRC = await _handleExecuteCommand(lastMessage.id, firstFragment, lastMessage, session, chatLLMId);
    if (cmdRC !== RET_NO_CMD) return cmdRC;
  }

  // get the system purpose (note: we don't react to it, or it would invalidate half UI components..)
  // TODO: change this massively
  if (!systemPurposeId) {
    session.messageAppendAssistantText('Issue: no Persona selected.', 'issue');
    return 'err-no-persona';
  }

  // synchronous long-duration tasks, which update the state as they go
  switch (chatExecuteMode) {
    case 'generate-content': {
      const requestedCouncilChannel = normalizeCouncilChannel(lastMessage.metadata?.councilChannel);
      const historyForRequestedChannel = getHistoryForCouncilChannel(initialHistory, requestedCouncilChannel);
      const latestUserMessage = [...historyForRequestedChannel].reverse().find(message => message.role === 'user') ?? null;
      const resumeSession = turnTerminationMode === 'consensus'
        ? session.getCouncilSession()
        : createIdleCouncilSessionState();
      if (hasStopToken(latestUserMessage)) {
        session.clearAbortController('chat-persona-stop-token');
        return true;
      }
      const assistantParticipantsForChannel = getParticipantsForCouncilChannel(assistantParticipants, requestedCouncilChannel, conversationId);
      const runnableParticipants = getRunnableParticipants(assistantParticipantsForChannel, latestUserMessage);
      const directlyMentionedParticipants = getMentionedParticipants(latestUserMessage, assistantParticipantsForChannel);
      const participantsForTurn = mergeParticipantsInRosterOrder(assistantParticipantsForChannel, runnableParticipants, directlyMentionedParticipants);

      if (!participantsForTurn.length) {
        session.messageAppendAssistantText(`No agent was triggered in ${describeCouncilChannel(requestedCouncilChannel, participants, conversationId)}. Mention an agent with @alias, or set it to speak every turn.`, 'issue');
        return false;
      }

      const effectiveTurnTerminationMode = requestedCouncilChannel.channel !== 'public-board' && turnTerminationMode === 'consensus'
        ? 'round-robin-per-human'
        : turnTerminationMode;
      const initialCouncilState = effectiveTurnTerminationMode === 'consensus' && resumeSession.canResume
        ? resumeSession.workflowState ?? (() => {
            const resumePhaseId = resumeSession.phaseId?.trim() || null;
            const leaderParticipant = getConsensusLeaderParticipant(participantsForTurn);
            if (!resumePhaseId || !leaderParticipant)
              return null;

            const reviewerParticipants = participantsForTurn.filter(participant =>
              participant.id !== leaderParticipant.id && participant.kind === 'assistant' && !!participant.personaId);
            return hydrateCouncilSessionFromTranscriptEntries({
              phaseId: resumePhaseId,
              leaderParticipantId: leaderParticipant.id,
              reviewerParticipantIds: reviewerParticipants.map(participant => participant.id),
              maxRounds: CONSENSUS_MAX_PASSES,
              entries: historyForRequestedChannel
                .filter(message => {
                  const consensus = message.metadata?.consensus;
                  return consensus?.kind === 'deliberation' && consensus.phaseId === resumePhaseId;
                })
                .map(message => ({
                  roundIndex: message.metadata?.consensus?.passIndex ?? 0,
                  participantId: message.metadata?.author?.participantId ?? '',
                  action: message.metadata?.consensus?.action === 'accept'
                    ? 'accept'
                    : message.metadata?.consensus?.action === 'reject'
                      ? 'reject'
                      : 'proposal',
                  messageId: message.id,
                  text: messageFragmentsReduceText(message.fragments).trim(),
                  reason: message.metadata?.consensus?.reason,
                })),
            });
          })()
        : null;

      if (participantsForTurn.length > 1 || effectiveTurnTerminationMode === 'continuous' || effectiveTurnTerminationMode === 'consensus')
        return effectiveTurnTerminationMode === 'consensus'
          ? await runConsensusSequence(
            session,
            conversationId,
            participantsForTurn,
            chatLLMId,
            latestUserMessage?.id ?? null,
            initialCouncilState,
            resolvedRuntime,
          )
          : await runParticipantSequence(session, conversationId, participantsForTurn, assistantParticipantsForChannel, chatLLMId, effectiveTurnTerminationMode, latestUserMessage?.id ?? null, requestedCouncilChannel, resolvedRuntime);

      const soleParticipant = participantsForTurn[0] ?? primaryParticipant;
      const soleParticipantPersonaId = soleParticipant?.personaId ?? systemPurposeId;
      const soleParticipantLlmId = soleParticipant?.llmId ?? chatLLMId;
      if (!soleParticipant || !soleParticipantPersonaId || !soleParticipantLlmId)
        return 'err-no-persona';

      const participantHistory = await preparePersonaHistory(historyForRequestedChannel, soleParticipantLlmId, soleParticipantPersonaId, participantsForTurn, soleParticipant);
      return (await resolvedRuntime.runPersona({
        assistantLlmId: soleParticipantLlmId,
        conversationId,
        systemPurposeId: soleParticipantPersonaId,
        keepAbortController: false,
        participant: soleParticipant,
        sourceHistory: participantHistory,
        createPlaceholder: true,
        messageChannel: requestedCouncilChannel,
        session,
      })).success;
    }

    case 'beam-content':
      const updatedInputHistory = session.historyViewHeadOrThrow('chat-beam-execute');
      session.beamInvoke(updatedInputHistory, [], null);
      return true;

    case 'append-user':
      return true;

    case 'generate-image':
      // verify we were called with a single DMessageTextContent
      if (!isTextContentFragment(firstFragment))
        return false;
      const imagePrompt = firstFragment.part.text;
      session.messageFragmentReplace(lastMessage.id, firstFragment.fId, createTextContentFragment(textToDrawCommand(imagePrompt)), true);

      // use additional image fragments as image inputs
      const imageInputFragments = lastMessage.fragments.slice(1)
        .filter(fragment => isContentOrAttachmentFragment(fragment) && (
          isZyncAssetImageReferencePart(fragment.part) || isImageRefPart(fragment.part)
        ));

      return await (await import('./image-generate')).runImageGenerationUpdatingState(session, imagePrompt, imageInputFragments);

    case 'react-content':
      // verify we were called with a single DMessageTextContent
      if (!isTextContentFragment(firstFragment))
        return false;
      const reactPrompt = firstFragment.part.text;
      session.messageFragmentReplace(lastMessage.id, firstFragment.fId, createTextContentFragment(`/react ${reactPrompt}`), true);
      return await (await import('./react-tangent')).runReActUpdatingState(session, reactPrompt, chatLLMId, lastMessage.id);

    default:
      console.log('Chat execute: issue running', chatExecuteMode, conversationId, lastMessage);
      return false;
  }
}
