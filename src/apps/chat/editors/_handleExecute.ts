import * as z from 'zod/v4';

import type { DLLMId } from '~/common/stores/llms/llms.types';
import type { DModelParameterValues } from '~/common/stores/llms/llms.parameters';
import { DModelParameterRegistry, findModelReasoningEffortParamSpec, MODEL_REASONING_EFFORT_PARAM_IDS } from '~/common/stores/llms/llms.parameters';
import { findLLMOrThrow, getChatLLMId } from '~/common/stores/llms/store-llms';
import { getChatAutoAI } from '../store-app-chat';

import type { SystemPurposeId } from '../../../data';
import { SystemPurposes } from '../../../data';

import { agiCustomId, agiUuid } from '~/common/util/idUtils';

import { DEFAULT_COUNCIL_MAX_ROUNDS, resolveCouncilMaxRounds } from '~/common/stores/chat/chat.conversation';
import type { DConversationId, DConversationParticipant, DPersistedCouncilSession, DConversationTurnTerminationMode } from '~/common/stores/chat/chat.conversation';
import { createDMessageEmpty, createDMessageTextContent, MESSAGE_FLAG_VND_ANT_CACHE_AUTO, MESSAGE_FLAG_VND_ANT_CACHE_USER, messageHasUserFlag, messageSetUserFlag } from '~/common/stores/chat/chat.message';
import type { DMessage, DMessageCouncilChannel } from '~/common/stores/chat/chat.message';
import { messageFragmentsReduceText } from '~/common/stores/chat/chat.message';
import { duplicateDMessage } from '~/common/stores/chat/chat.message';
import { createIdleCouncilSessionState } from '~/common/chat-overlay/store-perchat-composer_slice';
import { createTextContentFragment, isContentOrAttachmentFragment, isImageRefPart, isTextContentFragment, isToolInvocationPart, isToolResponseFunctionCallPart, isVoidThinkingFragment, isZyncAssetImageReferencePart } from '~/common/stores/chat/chat.fragments';
import { getConversationCouncilMaxRounds, getConversationCouncilOpLog, getConversationParticipants, getConversationTurnTerminationMode } from '~/common/stores/chat/store-chats';
import { findParticipantMentionMatchIndex } from '~/common/util/dMessageUtils';
import { aixFunctionCallTool } from '~/modules/aix/client/aix.client.fromSimpleFunction';

import type { ChatExecuteMode } from '../execute-mode/execute-mode.types';
import { textToDrawCommand } from '../commands/CommandsDraw';

import {
  applyCouncilReviewBallots,
  appendCouncilAgentTurnEvent,
  classifyCouncilReviewBallotFragments,
  COUNCIL_REVIEW_ANALYSIS_MISSING_REASON,
  COUNCIL_REVIEW_FAILED_REASON,
  COUNCIL_REVIEW_VERDICT_MISSING_REASON,
  deriveCouncilReviewerFallbackReason,
  COUNCIL_INTERRUPTION_REASON_INVALID_PROPOSAL,
  COUNCIL_INVALID_PROPOSAL_TEXT,
  classifyCouncilTextFragments,
  COUNCIL_TRANSCRIPT_PREFIX,
  createCouncilSessionState,
  doesCouncilRoundNeedLeaderProposal,
  evaluateCouncilPass,
  extractCouncilProposalText,
  getCouncilResumePassIndex,
  hydrateCouncilSessionFromTranscriptEntries,
  recordCouncilAgentMessageSnapshot,
  recordCouncilProposal,
  recordCouncilReviewerTurn,
  recordCouncilReviewerVote,
} from './_handleExecute.council';
import type { CouncilProtocolAction, CouncilBallotRecord, CouncilSessionState } from './_handleExecute.council';
import { appendCouncilOps, createCouncilOp } from './_handleExecute.council.log';
import type { CouncilOp } from './_handleExecute.council.log';
import { reduceCouncilOps, replayCouncilOpLog } from './_handleExecute.council.reducer';
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

function findMentionMatchIndex(messageText: string, mention: string): number | null {
  return findParticipantMentionMatchIndex(messageText, mention);
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

function getMultiAgentCoordinationInstructionLines(
  participants: DConversationParticipant[],
  activeParticipant: DConversationParticipant,
  options?: {
    includeExitLoopInstruction?: boolean;
  },
): string[] {
  const assistantLines = participants
    .filter(participant => participant.kind === 'assistant' && participant.personaId)
    .map((participant, index) => {
      const speakMode = participant.speakWhen === 'when-mentioned' ? 'speaks only when @mentioned' : 'speaks every turn';
      const activeMarker = participant.id === activeParticipant.id ? ' [you are this agent]' : '';
      return `${index + 1}. ${participant.name} — ${participant.personaId}${participant.llmId ? ` — model ${participant.llmId}` : ''} — ${speakMode}${activeMarker}`;
    });

  return [
    'You are participating in a multi-agent group chat.',
    'Other assistant messages in the conversation were written by other agents in the same room, not by the user.',
    'Read the latest user request and the prior assistant replies before answering.',
    'Do not treat prior assistant replies as pasted transcript or quoted input from the user.',
    'Avoid repeating the same answer when another agent already covered it; instead continue, refine, or add a distinct contribution.',
    'Use @mentions to ask other agents to continue when the room supports mention follow-ups.',
    'You can @mention any agent by the roster names shown below, including slash aliases from their display names.',
    'Use @all to bring in every other agent, and do not @mention yourself.',
    ...(options?.includeExitLoopInstruction ? [
      'If you decide the loop should end after your reply, call the Exit_loop tool.',
      'Only call Exit_loop in the same turn where you provide the final visible reply for the user; do not call it from reasoning-only output or while handing off to another agent.',
    ] : []),
    'Current agent roster and speaking order:',
    ...assistantLines,
  ];
}

function buildMultiAgentCoordinationMessage(
  participants: DConversationParticipant[],
  activeParticipant: DConversationParticipant,
  options?: {
    includeExitLoopInstruction?: boolean;
  },
): DMessage {
  const instruction = getMultiAgentCoordinationInstructionLines(participants, activeParticipant, options).join('\n');

  const message = createDMessageTextContent('system', instruction);
  message.updated = message.created;
  return message;
}

async function preparePersonaHistory(
  sourceHistory: Readonly<DMessage[]>,
  assistantLlmId: DLLMId,
  purposeId: SystemPurposeId,
  participants: DConversationParticipant[],
  activeParticipant: DConversationParticipant,
  options?: {
    includeExitLoopInstruction?: boolean;
  },
): Promise<DMessage[]> {
  const participantHistory = [...sourceHistory];
  await inlineUpdatePurposeInHistory(participantHistory, assistantLlmId, purposeId, activeParticipant.customPrompt);

  const coordinationMessage = buildMultiAgentCoordinationMessage(participants, activeParticipant, options);
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

function getParticipantLlmUserParametersReplacement(
  assistantLlmId: DLLMId,
  participant: DConversationParticipant | undefined,
  baseUserParameters: DModelParameterValues | undefined,
): DModelParameterValues | undefined {
  const reasoningEffort = participant?.reasoningEffort;
  if (!reasoningEffort)
    return baseUserParameters;

  let llm;
  try {
    llm = findLLMOrThrow(assistantLlmId);
  } catch {
    return baseUserParameters;
  }

  const effortSpec = findModelReasoningEffortParamSpec(llm.parameterSpecs);
  if (!effortSpec)
    return baseUserParameters;

  const allowedValues = new Set((effortSpec.enumValues as readonly string[] | undefined)
    ?? DModelParameterRegistry[effortSpec.paramId].values);
  if (!allowedValues.has(reasoningEffort))
    return baseUserParameters;

  const nextUserParameters = {
    ...(baseUserParameters ?? llm.userParameters ?? {}),
  };
  for (const paramId of MODEL_REASONING_EFFORT_PARAM_IDS)
    delete nextUserParameters[paramId];
  nextUserParameters[effortSpec.paramId] = reasoningEffort;
  return nextUserParameters;
}

function withParticipantRunOptions(
  assistantLlmId: DLLMId,
  participant: DConversationParticipant | undefined,
  runOptions: PersonaRunOptions | undefined,
): PersonaRunOptions | undefined {
  const llmUserParametersReplacement = getParticipantLlmUserParametersReplacement(
    assistantLlmId,
    participant,
    runOptions?.llmUserParametersReplacement,
  );

  if (!llmUserParametersReplacement)
    return runOptions;

  return {
    ...runOptions,
    llmUserParametersReplacement,
  };
}

function getRunnableParticipants(participants: DConversationParticipant[], latestUserMessage: DMessage | null): DConversationParticipant[] {
  return participants.filter(participant => {
    if (!participant.personaId)
      return false;
    return participant.speakWhen !== 'when-mentioned' || wasParticipantMentioned(latestUserMessage, participant);
  });
}

function mergeParticipantsInRosterOrder(
  roster: DConversationParticipant[],
  primaryParticipants: DConversationParticipant[],
  extraParticipants: DConversationParticipant[],
): DConversationParticipant[] {
  const primaryIds = new Set(primaryParticipants.map(participant => participant.id));
  const extraIds = new Set(extraParticipants.map(participant => participant.id));
  return roster.filter(participant => primaryIds.has(participant.id) || extraIds.has(participant.id));
}

function getAssistantMessagesSinceLatestUser(messages: Readonly<DMessage[]>, latestUserMessageId: string | null): DMessage[] {
  if (!latestUserMessageId)
    return [];

  const latestUserIndex = messages.findIndex(message => message.id === latestUserMessageId);
  if (latestUserIndex < 0)
    return [];

  return messages.slice(latestUserIndex + 1)
    .filter(message => message.role === 'assistant' && !!message.metadata?.author?.participantId);
}

function isIncompleteAssistantMessage(message: DMessage): boolean {
  return message.role === 'assistant'
    && !!message.metadata?.author?.participantId
    && (!!message.pendingIncomplete || message.updated === null);
}

function getParticipantsRemainingThisTurn(messages: Readonly<DMessage[]>, latestUserMessageId: string | null, runnableParticipants: DConversationParticipant[]): DConversationParticipant[] {
  if (!latestUserMessageId)
    return runnableParticipants;

  const spokenParticipantIds = new Set(getAssistantMessagesSinceLatestUser(messages, latestUserMessageId)
    .filter(message => !isIncompleteAssistantMessage(message))
    .map(message => message.metadata?.author?.participantId)
    .filter((participantId): participantId is string => !!participantId));

  return runnableParticipants.filter(participant => !spokenParticipantIds.has(participant.id));
}

function getContinuousParticipants(messages: Readonly<DMessage[]>, latestUserMessageId: string | null, runnableParticipants: DConversationParticipant[]): DConversationParticipant[] {
  if (!latestUserMessageId || runnableParticipants.length <= 1)
    return runnableParticipants;

  const assistantMessagesThisTurn = getAssistantMessagesSinceLatestUser(messages, latestUserMessageId);
  const latestAssistantParticipantId = assistantMessagesThisTurn.at(-1)?.metadata?.author?.participantId ?? null;
  if (!latestAssistantParticipantId)
    return runnableParticipants;

  const latestSpeakerIndex = runnableParticipants.findIndex(participant => participant.id === latestAssistantParticipantId);
  if (latestSpeakerIndex < 0)
    return runnableParticipants;

  return [
    ...runnableParticipants.slice(latestSpeakerIndex + 1),
    ...runnableParticipants.slice(0, latestSpeakerIndex + 1),
  ];
}

function findCouncilPlaceholderMessageId(
  messages: Readonly<DMessage[]>,
  phaseId: string,
  passIndex: number,
  participantId: string,
): string | null {
  return [...messages]
    .reverse()
    .find(message => {
      const council = message.metadata?.council;
      return message.role === 'assistant'
        && !!message.pendingIncomplete
        && council?.kind === 'deliberation'
        && council.phaseId === phaseId
        && council.passIndex === passIndex
        && message.metadata?.author?.participantId === participantId;
    })?.id ?? null;
}

function getCouncilParticipantsRemaining(messages: Readonly<DMessage[]>, phaseId: string, passIndex: number, runnableParticipants: DConversationParticipant[]): DConversationParticipant[] {
  const spokenParticipantIds = new Set(messages
    .filter(message => {
      const council = message.metadata?.council;
      return message.role === 'assistant'
        && council?.kind === 'deliberation'
        && council.phaseId === phaseId
        && council.passIndex === passIndex
        && !!message.metadata?.author?.participantId;
    })
    .map(message => message.metadata?.author?.participantId)
    .filter((participantId): participantId is string => !!participantId));

  return runnableParticipants.filter(participant => !spokenParticipantIds.has(participant.id));
}

function getCouncilSpokenParticipantIdsByPass(messages: Readonly<DMessage[]>, phaseId: string): Map<number, Set<string>> {
  return messages.reduce((spokenByPass, message) => {
    const council = message.metadata?.council;
    const participantId = message.metadata?.author?.participantId;
    if (message.role !== 'assistant'
      || council?.kind !== 'deliberation'
      || council.phaseId !== phaseId
      || typeof council.passIndex !== 'number'
      || !participantId)
      return spokenByPass;

    const spokenParticipantIds = spokenByPass.get(council.passIndex) ?? new Set<string>();
    spokenParticipantIds.add(participantId);
    spokenByPass.set(council.passIndex, spokenParticipantIds);
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
    return 'the public room';

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

function getExplicitRecipientParticipants(
  participants: DConversationParticipant[],
  message: DMessage | null,
): {
  participants: DConversationParticipant[];
  hasExplicitParticipantRecipients: boolean;
} {
  const initialRecipients = message?.metadata?.initialRecipients ?? [];
  const participantRecipientIds = initialRecipients
    .filter((recipient): recipient is Extract<typeof recipient, { rt: 'participant' }> => recipient.rt === 'participant')
    .map(recipient => recipient.participantId)
    .filter(Boolean);

  if (!participantRecipientIds.length || participantRecipientIds.length !== initialRecipients.length) {
    return {
      participants,
      hasExplicitParticipantRecipients: false,
    };
  }

  const participantRecipientIdSet = new Set(participantRecipientIds);
  return {
    participants: participants.filter(participant => participantRecipientIdSet.has(participant.id)),
    hasExplicitParticipantRecipients: true,
  };
}

function getHistoryForCouncilChannel(messages: Readonly<DMessage[]>, councilChannel: DMessageCouncilChannel): DMessage[] {
  return messages
    .filter(message => message.role === 'system' || messageMatchesCouncilChannel(message, councilChannel))
    .map(message => duplicateDMessage(message, false));
}
const COUNCIL_PUBLIC_BOARD_CHANNEL: DMessageCouncilChannel = { channel: 'public-board' };
const COUNCIL_MAX_PASSES = DEFAULT_COUNCIL_MAX_ROUNDS ?? Number.POSITIVE_INFINITY;

type CouncilPassAction = {
  participant: DConversationParticipant;
  action: CouncilProtocolAction;
  messageId: string;
  response: string;
  deliberationText: string;
};

type CouncilDeliberation = {
  participant: DConversationParticipant;
  action: CouncilProtocolAction;
  deliberationText: string;
  response: string;
  assistantMessageId: string | null;
  messageFragments: DMessage['fragments'];
  messagePendingIncomplete: boolean;
};

type CouncilReviewerTurnResult = {
  ballot: ReturnType<typeof classifyCouncilReviewBallotFragments>;
  fragmentTexts: string[];
  messageFragments: DMessage['fragments'];
  messagePendingIncomplete: boolean;
};

type CouncilRunInterruption = 'paused' | 'stopped' | 'interrupted';

function isCouncilInterruptionResumable(interruption: { status: CouncilRunInterruption; reason: string } | null): boolean {
  if (!interruption)
    return false;
  if (interruption.status === 'paused' || interruption.status === 'interrupted')
    return true;
  if (interruption.status === 'stopped')
    return interruption.reason !== COUNCIL_INTERRUPTION_REASON_INVALID_PROPOSAL;
  return false;
}

const councilReviewerAcceptTool = {
  name: 'Accept',
  description: 'Accept the current leader proposal.',
  inputSchema: z.object({}),
} as const;

const councilReviewerImproveTool = {
  name: 'Improve',
  description: 'Request improvements to the current leader proposal.',
  inputSchema: z.object({
    reason: z.string().trim().min(1).optional(),
  }),
} as const;

const COUNCIL_REVIEWER_ACCEPT_LABEL = 'Accept()';
const COUNCIL_REVIEWER_IMPROVE_LABEL = 'Improve()';

function isCouncilReviewerBallotToolName(name: string | null | undefined): boolean {
  return name === councilReviewerAcceptTool.name || name === councilReviewerImproveTool.name;
}

function formatCouncilReviewerImproveText(reason: string | null | undefined): string {
  const normalizedReason = reason?.trim();
  return normalizedReason ? `${COUNCIL_REVIEWER_IMPROVE_LABEL}: ${normalizedReason}` : COUNCIL_REVIEWER_IMPROVE_LABEL;
}

const exitLoopTool = {
  name: 'Exit_loop',
  description: 'Stop the current agents loop after your reply.',
  inputSchema: z.object({}),
} as const;

function createCouncilReviewerBallotRequestTransform() {
  return (request: Parameters<NonNullable<PersonaRunOptions['requestTransform']>>[0]) => {
    const existingTools = request.tools ?? [];
    const existingToolNames = new Set(
      existingTools.flatMap(tool => tool.type === 'function_call' ? [tool.function_call.name] : []),
    );

    const reviewerBallotTools = [
      !existingToolNames.has(councilReviewerAcceptTool.name) ? aixFunctionCallTool(councilReviewerAcceptTool) : null,
      !existingToolNames.has(councilReviewerImproveTool.name) ? aixFunctionCallTool(councilReviewerImproveTool) : null,
    ].filter(tool => tool !== null);

    return {
      ...request,
      tools: [...existingTools, ...reviewerBallotTools],
    };
  };
}

function createCouncilReviewerForcedBallotRequestTransform() {
  return (request: Parameters<NonNullable<PersonaRunOptions['requestTransform']>>[0]) => ({
    ...request,
    tools: [
      aixFunctionCallTool(councilReviewerAcceptTool),
      aixFunctionCallTool(councilReviewerImproveTool),
    ],
    toolsPolicy: { type: 'any' as const },
  });
}

function createExitLoopRequestTransform() {
  return (request: Parameters<NonNullable<PersonaRunOptions['requestTransform']>>[0]) => {
    const existingTools = request.tools ?? [];
    const existingToolNames = new Set(
      existingTools.flatMap(tool => tool.type === 'function_call' ? [tool.function_call.name] : []),
    );

    const loopTools = [
      !existingToolNames.has(exitLoopTool.name) ? aixFunctionCallTool(exitLoopTool) : null,
    ].filter(tool => tool !== null);

    return {
      ...request,
      tools: [...existingTools, ...loopTools],
    };
  };
}

function hasExitLoopToolInvocation(fragments: DMessage['fragments'] | null | undefined): boolean {
  return (fragments ?? []).some(fragment =>
    fragment.ft === 'content'
    && isToolInvocationPart(fragment.part)
    && fragment.part.invocation.type === 'function_call'
    && fragment.part.invocation.name === exitLoopTool.name,
  );
}

const EXIT_LOOP_META_ONLY_TEXT_PATTERN = /\b(?:i(?:'m| am)\s+thinking\s+about|maybe(?:\s+i)?\s+(?:could|should|might)|i(?:\s+\w+){0,3}\s+need\s+to\s+make\s+sure|i(?:\s+\w+){0,3}\s+might\s+(?:consider|be)|i(?:\s+\w+){0,3}\s+could\s+mention|if\s+(?:we(?:'re| are)|i(?:'m| am))\s+(?:concluding|closing|ending)|let\s+the\s+room\s+continue|another\s+pass|final\s+answer\s+might\s+be\s+better|call\s+exit_loop|exit_loop|@mention|@\w+|finaliz(?:e|ing)\b)/iu;

function normalizeExitLoopReplyText(text: string): string {
  return text
    .replace(/[*_`#>\[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getExitLoopReplyTextUnits(text: string): string[] {
  return text
    .replace(/\r/g, '')
    .split(/\n+/)
    .flatMap(line => line.split(/(?<=[.!?])\s+/u))
    .map(normalizeExitLoopReplyText)
    .filter(Boolean);
}

function isMetaOnlyExitLoopReplyText(text: string): boolean {
  const normalized = normalizeExitLoopReplyText(text);
  return !!normalized && EXIT_LOOP_META_ONLY_TEXT_PATTERN.test(normalized);
}

function hasVisibleExitLoopReplyContent(fragments: DMessage['fragments'] | null | undefined): boolean {
  return (fragments ?? []).some(fragment =>
    isTextContentFragment(fragment)
    && getExitLoopReplyTextUnits(fragment.part.text).some(textUnit => !isMetaOnlyExitLoopReplyText(textUnit)),
  );
}

function extractCouncilReviewerBallotFromToolInvocation(
  fragments: DMessage['fragments'],
  reviewerParticipantId: string,
): ReturnType<typeof classifyCouncilReviewBallotFragments> {
  const invocationFragment = [...fragments]
    .reverse()
    .find(fragment => fragment.ft === 'content' && isToolInvocationPart(fragment.part) && fragment.part.invocation.type === 'function_call');
  const invocation = invocationFragment?.ft === 'content' && isToolInvocationPart(invocationFragment.part) && invocationFragment.part.invocation.type === 'function_call'
    ? invocationFragment.part.invocation
    : null;

  if (!invocation)
    throw new Error(COUNCIL_REVIEW_VERDICT_MISSING_REASON);

  const rawArgs = invocation.args?.trim() || '{}';
  let parsedArgs: unknown;
  try {
    parsedArgs = JSON.parse(rawArgs);
  } catch {
    throw new Error(COUNCIL_REVIEW_VERDICT_MISSING_REASON);
  }

  if (invocation.name === councilReviewerAcceptTool.name) {
    councilReviewerAcceptTool.inputSchema.parse(parsedArgs);
    return {
      reviewerParticipantId,
      decision: 'accept',
    };
  }

  if (invocation.name === councilReviewerImproveTool.name) {
    const { reason } = councilReviewerImproveTool.inputSchema.parse(parsedArgs);
    return {
      reviewerParticipantId,
      decision: 'reject',
      ...(reason ? { reason } : {}),
    };
  }

  throw new Error(COUNCIL_REVIEW_VERDICT_MISSING_REASON);
}

function getCouncilInterruption(abortController: AbortController): { status: CouncilRunInterruption; reason: string } | null {
  if (!abortController.signal.aborted)
    return null;

  const rawReason = typeof abortController.signal.reason === 'string'
    ? abortController.signal.reason.trim()
    : '';

  if (rawReason === '@pause')
    return { status: 'paused', reason: rawReason };
  if (rawReason === '@stop' || rawReason === '@exit-loop' || rawReason === 'stop' || rawReason === 'chat-stop')
    return { status: 'stopped', reason: rawReason || 'chat-stop' };
  return { status: 'interrupted', reason: rawReason || 'aborted' };
}

const COUNCIL_REVIEWER_META_INTENT_PATTERN = /\b(i(?:\s+\w+){0,2}\s+need to|i(?:\s+\w+){0,2}\s+have to|i(?:\s+\w+){0,2}\s+must|i(?:\s+\w+){0,2}\s+should|i(?:'| a)?ll|i will|i am going to|i'm going to|let me|our focus is|my focus is|it(?:'| i)?s important|important to|voy a|necesito|tengo que|debo|quiero|me enfocar[ée]|har[ée])\b/i;
const COUNCIL_REVIEWER_INVESTIGATION_PATTERN = /\b(inspect|evaluate|analy[sz]e|assess|check|verify|review|look into|look up|search|research|compare|validate|inspecting|evaluating|analy[sz]ing|checking|verifying|reviewing|searching|researching|comparing|validating|revisar|verificar|comprobar|buscar|investigar|analizar|evaluar|comparar|validar|inspeccionar|revisando|verificando|comprobando|buscando|investigando|analizando|evaluando|comparando|validando)\b/i;
const COUNCIL_REVIEWER_EXECUTED_FINDING_PATTERN = /\b(found|confirmed|verified|checked|reviewed|searched|researched|compared|validated|shows|showed|indicates|indicated|cites|contains|contained|includes|included|states|stated|demonstrates|demonstrated|he comprobado|he verificado|he revisado|he encontrado|he comparado|he validado|muestra|mostr[oó]|indica|indic[oó]|cita|cit[oó]|contiene|conten[ií]a|incluye|incluy[oó]|afirma|afirm[oó]|confirma|confirm[oó]|demuestra|demostr[oó])\b/i;

function hasCouncilReviewerNonBallotToolActivity(fragments: DMessage['fragments'] | null | undefined): boolean {
  for (const fragment of fragments ?? []) {
    if (fragment.ft !== 'content')
      continue;

    if (isToolInvocationPart(fragment.part) && fragment.part.invocation.type === 'function_call') {
      if (!isCouncilReviewerBallotToolName(fragment.part.invocation.name))
        return true;
      continue;
    }

    if (isToolResponseFunctionCallPart(fragment.part)) {
      if (!isCouncilReviewerBallotToolName(fragment.part.response.name))
        return true;
    }
  }

  return false;
}

function getCouncilReviewerAnalysisTexts(fragments: DMessage['fragments'] | null | undefined): string[] {
  return (fragments ?? [])
    .filter(isTextContentFragment)
    .map(fragment => fragment.part.text.trim())
    .filter(text => !!text && !/^accept(?:\(\))?$/i.test(text) && !/^improve(?:\(\))?(?::|\b)/i.test(text) && !/^reject(?::|\b)/i.test(text));
}

function hasCouncilReviewerHiddenReasoning(fragments: DMessage['fragments'] | null | undefined): boolean {
  return (fragments ?? []).some(isVoidThinkingFragment);
}

function assertCouncilReviewerBallotHasVisibleAnalysis(
  ballot: ReturnType<typeof extractCouncilReviewerBallotFromToolInvocation>,
  fragments: DMessage['fragments'] | null | undefined,
): void {
  if (ballot.decision !== 'accept')
    return;

  if (getCouncilReviewerAnalysisTexts(fragments).length > 0)
    return;

  if (!hasCouncilReviewerHiddenReasoning(fragments) && !hasCouncilReviewerNonBallotToolActivity(fragments))
    return;

  throw new Error(COUNCIL_REVIEW_ANALYSIS_MISSING_REASON);
}

function mergeCouncilReviewerVoteFragments(
  previousFragments: DMessage['fragments'] | null | undefined,
  nextFragments: DMessage['fragments'] | null | undefined,
): DMessage['fragments'] {
  return [
    ...structuredClone(previousFragments ?? []),
    ...structuredClone(nextFragments ?? []),
  ];
}

function isCouncilReviewerHeadingText(text: string): boolean {
  const plainText = text
    .replace(/[*_`#>\-\[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return !!plainText
    && !/[.!?:]/.test(plainText)
    && plainText.split(/\s+/).length <= 8;
}

function isCouncilReviewerMetaOnlyIntentText(text: string): boolean {
  return COUNCIL_REVIEWER_META_INTENT_PATTERN.test(text)
    && COUNCIL_REVIEWER_INVESTIGATION_PATTERN.test(text)
    && !COUNCIL_REVIEWER_EXECUTED_FINDING_PATTERN.test(text);
}

function isRetryableCouncilReviewerBallot(
  ballot: CouncilSessionState['rounds'][number]['reviewerVotes'][string]['ballot'] | null | undefined,
  messageFragments: DMessage['fragments'] | null | undefined,
  reason: string | null | undefined,
): boolean {
  if (!ballot)
    return false;

  if (ballot.decision === 'accept')
    return false;

  return reason === COUNCIL_REVIEW_FAILED_REASON
    || reason === COUNCIL_REVIEW_VERDICT_MISSING_REASON
    || reason === COUNCIL_REVIEW_ANALYSIS_MISSING_REASON;
}

function isRetryableCouncilReviewerVote(vote: CouncilSessionState['rounds'][number]['reviewerVotes'][string] | null | undefined): boolean {
  return isRetryableCouncilReviewerBallot(vote?.ballot, vote?.messageFragments, vote?.reason ?? vote?.ballot.reason ?? null);
}

function createCouncilOpLogFromSessionState(
  workflowState: CouncilSessionState,
  conversationId: DConversationId,
  latestUserMessageId: string | null,
): CouncilOp[] {
  let councilOpLog: CouncilOp[] = [
    createCouncilOp([], 'session_started', {
      leaderParticipantId: workflowState.leaderParticipantId,
      reviewerParticipantIds: [...workflowState.reviewerParticipantIds],
      maxRounds: workflowState.maxRounds,
      latestUserMessageId,
    }, {
      phaseId: workflowState.phaseId,
      conversationId,
      createdAt: workflowState.rounds[0]?.leaderProposal?.createdAt
        ?? workflowState.rounds[0]?.reviewerPlans[workflowState.reviewerParticipantIds[0] ?? '']?.createdAt
        ?? workflowState.updatedAt,
    }),
  ];

  for (const round of [...workflowState.rounds].sort((a, b) => a.roundIndex - b.roundIndex)) {
    councilOpLog = appendCouncilOps(councilOpLog, [
      createCouncilOp(councilOpLog, 'round_started', {
        roundIndex: round.roundIndex,
        leaderParticipantId: round.leaderParticipantId,
        reviewerParticipantIds: [...workflowState.reviewerParticipantIds],
        sharedRejectionReasons: [...round.sharedRejectionReasons],
      }, {
        phaseId: workflowState.phaseId,
        conversationId,
        createdAt: getCouncilRoundStartedAt(round, workflowState.updatedAt),
      }),
    ]);

    if (round.leaderProposal?.proposalText) {
      councilOpLog = appendCouncilOps(councilOpLog, [
        createCouncilOp(councilOpLog, 'leader_turn_committed', {
          roundIndex: round.roundIndex,
          participantId: round.leaderParticipantId,
          proposalId: round.leaderProposal.proposalId,
          proposalText: round.leaderProposal.proposalText,
          deliberationText: round.leaderTurn?.deliberationText ?? '',
          messageFragments: round.leaderProposal.messageFragments,
          messagePendingIncomplete: round.leaderProposal.messagePendingIncomplete,
        }, {
          phaseId: workflowState.phaseId,
          conversationId,
          createdAt: round.leaderProposal.createdAt,
        }),
      ]);
    }

    for (const reviewerParticipantId of workflowState.reviewerParticipantIds) {
      const reviewerPlan = round.reviewerPlans[reviewerParticipantId] ?? null;
      if (reviewerPlan?.planText) {
        councilOpLog = appendCouncilOps(councilOpLog, [
          createCouncilOp(councilOpLog, 'reviewer_plan_committed', {
            roundIndex: round.roundIndex,
            participantId: reviewerParticipantId,
            planText: reviewerPlan.planText,
            messageFragments: reviewerPlan.messageFragments,
            messagePendingIncomplete: reviewerPlan.messagePendingIncomplete,
          }, {
            phaseId: workflowState.phaseId,
            conversationId,
            createdAt: reviewerPlan.createdAt,
          }),
        ]);
      }

      const reviewerVote = round.reviewerVotes[reviewerParticipantId] ?? null;
      if (reviewerVote) {
        councilOpLog = appendCouncilOps(councilOpLog, [
          createCouncilOp(councilOpLog, 'reviewer_vote_committed', {
            roundIndex: round.roundIndex,
            participantId: reviewerParticipantId,
            decision: reviewerVote.ballot.decision,
            reason: reviewerVote.reason,
            fragmentTexts: reviewerVote.messageFragments
              .filter(isTextContentFragment)
              .map(fragment => fragment.part.text),
            messageFragments: reviewerVote.messageFragments,
            messagePendingIncomplete: reviewerVote.messagePendingIncomplete,
          }, {
            phaseId: workflowState.phaseId,
            conversationId,
            createdAt: reviewerVote.createdAt,
          }),
        ]);
      }
    }

    const isRoundComplete = round.phase === 'completed'
      || !!round.completedAt
      || (workflowState.status === 'accepted' && round.proposalId === workflowState.acceptedProposalId)
      || (workflowState.status === 'exhausted' && round.roundIndex === workflowState.roundIndex);
    if (isRoundComplete) {
      const rejectionReasons = round.ballots
        .filter((ballot): ballot is typeof ballot & { decision: 'reject'; reason: string } => ballot.decision === 'reject' && !!ballot.reason)
        .map(ballot => ballot.reason);
      councilOpLog = appendCouncilOps(councilOpLog, [
        createCouncilOp(councilOpLog, 'round_completed', {
          roundIndex: round.roundIndex,
          outcome: rejectionReasons.length ? 'revise' : 'accepted',
          rejectionReasons,
        }, {
          phaseId: workflowState.phaseId,
          conversationId,
          createdAt: round.completedAt ?? round.reviewerVotes[workflowState.reviewerParticipantIds[0] ?? '']?.createdAt ?? workflowState.updatedAt,
        }),
      ]);
    }
  }

  if (workflowState.status === 'accepted' && workflowState.acceptedProposalId && workflowState.finalResponse) {
    councilOpLog = appendCouncilOps(councilOpLog, [
      createCouncilOp(councilOpLog, 'session_accepted', {
        roundIndex: workflowState.roundIndex,
        proposalId: workflowState.acceptedProposalId,
        finalResponse: workflowState.finalResponse,
      }, {
        phaseId: workflowState.phaseId,
        conversationId,
        createdAt: workflowState.updatedAt,
      }),
    ]);
  } else if (workflowState.status === 'exhausted') {
    councilOpLog = appendCouncilOps(councilOpLog, [
      createCouncilOp(councilOpLog, 'session_exhausted', {
        roundIndex: workflowState.roundIndex,
      }, {
        phaseId: workflowState.phaseId,
        conversationId,
        createdAt: workflowState.updatedAt,
      }),
    ]);
  }

  return councilOpLog;
}

function getCouncilRoundStartedAt(round: CouncilSessionState['rounds'][number], fallbackCreatedAt: number): number {
  const candidateTimestamps = [
    round.leaderProposal?.createdAt ?? null,
    ...Object.values(round.reviewerPlans).map(reviewerPlan => reviewerPlan.createdAt),
    ...Object.values(round.reviewerVotes).map(reviewerVote => reviewerVote.createdAt),
    round.completedAt,
  ].filter((createdAt): createdAt is number => typeof createdAt === 'number' && Number.isFinite(createdAt));

  return candidateTimestamps.length
    ? Math.min(...candidateTimestamps)
    : fallbackCreatedAt;
}

function appendCommittedCouncilOps(params: {
  session: ChatExecutionSession;
  councilOpLog: CouncilOp[];
  nextOps: CouncilOp[];
}): { councilOpLog: CouncilOp[]; workflowState: CouncilSessionState } {
  const councilOpLog = appendCouncilOps(params.councilOpLog, params.nextOps);
  const workflowState = reduceCouncilOps(councilOpLog);
  if (!workflowState)
    throw new Error('Failed to replay council op log after commit');
  params.session.persistCouncilState(null, councilOpLog);
  return { councilOpLog, workflowState };
}

function createResumableCouncilCheckpoint(
  phaseId: string | null,
  passIndex: number | null,
  workflowState: CouncilSessionState,
): DPersistedCouncilSession {
  return {
    status: 'interrupted',
    executeMode: 'generate-content',
    mode: 'council',
    phaseId,
    passIndex: workflowState.roundIndex ?? passIndex,
    workflowState,
    canResume: true,
    interruptionReason: 'page-unload',
    updatedAt: Date.now(),
  };
}

function setCouncilSessionRunning(
  session: ChatExecutionSession,
  executeMode: ChatExecuteMode,
  mode: DConversationTurnTerminationMode,
  phaseId: string | null,
  passIndex: number | null,
  workflowState: CouncilSessionState | null = null,
  councilOpLog: CouncilOp[] | null = null,
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

  if (mode === 'council' && workflowState)
    session.persistCouncilState(createResumableCouncilCheckpoint(phaseId, passIndex, workflowState), councilOpLog);
}

function pickPreferredCouncilResumeState(args: {
  replayedState: CouncilSessionState | null;
  replayedUpdatedAt: number | null;
  persistedState: CouncilSessionState | null;
  persistedUpdatedAt: number | null;
}): CouncilSessionState | null {
  const replayedUpdatedAt = args.replayedState?.updatedAt ?? args.replayedUpdatedAt ?? 0;
  const persistedUpdatedAt = args.persistedState?.updatedAt ?? args.persistedUpdatedAt ?? 0;

  if (args.persistedState && (!args.replayedState || persistedUpdatedAt > replayedUpdatedAt))
    return args.persistedState;

  return args.replayedState ?? args.persistedState ?? null;
}

function finalizeCouncilSession(
  session: ChatExecutionSession,
  interruption: { status: CouncilRunInterruption; reason: string } | null,
  mode: DConversationTurnTerminationMode,
  phaseId: string | null,
  passIndex: number | null,
  workflowState: CouncilSessionState | null = null,
  councilOpLog: CouncilOp[] = [],
): void {
  if (interruption) {
    const canResume = isCouncilInterruptionResumable(interruption);
    const interruptedSession = {
      status: interruption.status,
      executeMode: 'generate-content' as const,
      mode,
      phaseId,
      passIndex,
      workflowState,
      canResume,
      interruptionReason: interruption.reason,
      updatedAt: Date.now(),
    };
    session.updateCouncilSession(interruptedSession);
    const persistedInterruptionSession = mode === 'council' || interruptedSession.canResume
      ? {
          status: interruptedSession.status,
          executeMode: interruptedSession.executeMode,
          mode: interruptedSession.mode,
          phaseId: interruptedSession.phaseId,
          passIndex: interruptedSession.passIndex,
          workflowState: interruptedSession.workflowState,
          canResume: interruptedSession.canResume,
          interruptionReason: interruptedSession.interruptionReason,
          updatedAt: interruptedSession.updatedAt,
        }
      : null;
    session.persistCouncilState(persistedInterruptionSession, councilOpLog);
    return;
  }

  const completedSession = {
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
  };
  session.setCouncilSession(completedSession);
  session.persistCouncilState(mode === 'council'
    ? {
        status: 'completed',
        executeMode: completedSession.executeMode,
        mode: completedSession.mode,
        phaseId: completedSession.phaseId,
        passIndex: completedSession.passIndex,
        workflowState: completedSession.workflowState,
        canResume: false,
        interruptionReason: null,
        updatedAt: completedSession.updatedAt,
      }
    : null, councilOpLog);
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
}

function getCouncilLeaderParticipant(participants: DConversationParticipant[]): DConversationParticipant | null {
  return participants.find(participant => participant.isLeader) ?? participants[0] ?? null;
}

function isCouncilDeliberationMessage(message: Pick<DMessage, 'metadata'> | null | undefined): boolean {
  return message?.metadata?.council?.kind === 'deliberation';
}

function getCouncilVisibleTranscript(messages: Readonly<DMessage[]>, phaseId: string): DMessage[] {
  return messages.filter(message => {
    const council = message.metadata?.council;
    return council?.kind === 'deliberation' && council.phaseId === phaseId;
  });
}

function getCouncilSourceHistory(messages: Readonly<DMessage[]>, phaseId: string): DMessage[] {
  return messages
    .filter(message => {
      const council = message.metadata?.council;
      if (!council)
        return true;
      return council.phaseId !== phaseId;
    })
    .map(message => duplicateDMessage(message, false));
}

function createCouncilHistoryMessage(params: {
  participant: DConversationParticipant;
  participantLlmId: DLLMId | null;
  phaseId: string;
  roundIndex: number;
  messageFragments?: DMessage['fragments'];
  fallbackText?: string | null;
  alwaysAppendFallbackText?: boolean;
  pendingIncomplete?: boolean;
  action?: 'proposal' | 'accept' | 'reject';
  reason?: string | null;
}): DMessage {
  const message = createDMessageEmpty('assistant');
  const nextFragments = (params.messageFragments ?? [])
    .filter(isTextContentFragment)
    .map(fragment => createTextContentFragment(fragment.part.text));
  const hasVisibleText = nextFragments.some(fragment => isTextContentFragment(fragment) && !!fragment.part.text.trim());
  if ((params.alwaysAppendFallbackText || !hasVisibleText) && params.fallbackText?.trim())
    nextFragments.push(createTextContentFragment(params.fallbackText.trim()));
  message.fragments = nextFragments;
  message.metadata = {
    ...message.metadata,
    author: {
      participantId: params.participant.id,
      participantName: params.participant.name,
      personaId: params.participant.personaId ?? null,
      llmId: params.participant.llmId ?? params.participantLlmId,
    },
    councilChannel: COUNCIL_PUBLIC_BOARD_CHANNEL,
    initialRecipients: [{ rt: 'public-board' }],
    council: {
      kind: 'deliberation',
      phaseId: params.phaseId,
      passIndex: params.roundIndex,
      provisional: false,
      ...(params.action ? { action: params.action } : {}),
      ...(params.action === 'proposal' && params.fallbackText?.trim() ? { agreedResponse: params.fallbackText.trim() } : {}),
      ...(params.action === 'reject' && params.reason?.trim() ? { reason: params.reason.trim() } : {}),
    },
  };
  if (params.pendingIncomplete)
    message.pendingIncomplete = true;
  message.updated = message.created;
  return message;
}

function appendPriorCouncilRoundsToHistory(
  sourceHistory: Readonly<DMessage[]>,
  councilOps: readonly CouncilOp[],
  phaseId: string,
  participants: readonly DConversationParticipant[],
  roundIndex: number,
): DMessage[] {
  const participantHistory = [...sourceHistory];
  if (roundIndex <= 0)
    return participantHistory;

  const participantsById = new Map(participants.map(participant => [participant.id, participant]));

  for (const op of councilOps) {
    if (op.phaseId !== phaseId)
      continue;

    if (op.type === 'leader_turn_committed') {
      if (op.payload.roundIndex >= roundIndex)
        continue;
      const leaderParticipant = participantsById.get(op.payload.participantId);
      if (!leaderParticipant)
        continue;
      participantHistory.push(createCouncilHistoryMessage({
        participant: leaderParticipant,
        participantLlmId: leaderParticipant.llmId ?? null,
        phaseId,
        roundIndex: op.payload.roundIndex,
        messageFragments: op.payload.messageFragments,
        fallbackText: op.payload.proposalText,
        pendingIncomplete: op.payload.messagePendingIncomplete,
        action: 'proposal',
      }));
      continue;
    }

    if (op.type === 'reviewer_plan_committed') {
      if (op.payload.roundIndex >= roundIndex)
        continue;
      const reviewerParticipant = participantsById.get(op.payload.participantId);
      if (!reviewerParticipant)
        continue;
      participantHistory.push(createCouncilHistoryMessage({
        participant: reviewerParticipant,
        participantLlmId: reviewerParticipant.llmId ?? null,
        phaseId,
        roundIndex: op.payload.roundIndex,
        messageFragments: op.payload.messageFragments,
        fallbackText: op.payload.planText,
        pendingIncomplete: op.payload.messagePendingIncomplete,
      }));
      continue;
    }

    if (op.type !== 'reviewer_vote_committed' || op.payload.roundIndex >= roundIndex)
      continue;

    const reviewerParticipant = participantsById.get(op.payload.participantId);
    if (!reviewerParticipant)
      continue;
    participantHistory.push(createCouncilHistoryMessage({
      participant: reviewerParticipant,
      participantLlmId: reviewerParticipant.llmId ?? null,
      phaseId,
      roundIndex: op.payload.roundIndex,
      messageFragments: op.payload.messageFragments,
      fallbackText: op.payload.decision === 'accept'
        ? COUNCIL_REVIEWER_ACCEPT_LABEL
        : formatCouncilReviewerImproveText(op.payload.reason),
      alwaysAppendFallbackText: true,
      pendingIncomplete: op.payload.messagePendingIncomplete,
      action: op.payload.decision,
      reason: op.payload.reason,
    }));
  }

  return participantHistory;
}

function appendCurrentRoundProposalToHistory(
  participantHistory: DMessage[],
  phaseId: string,
  workflowState: CouncilSessionState,
  participants: readonly DConversationParticipant[],
  roundIndex: number,
): DMessage[] {
  const round = workflowState.rounds[roundIndex];
  const leaderProposal = round?.leaderProposal ?? null;
  if (!leaderProposal?.proposalText)
    return participantHistory;

  const leaderParticipant = participants.find(participant => participant.id === leaderProposal.leaderParticipantId);
  if (!leaderParticipant)
    return participantHistory;

  participantHistory.push(createCouncilHistoryMessage({
    participant: leaderParticipant,
    participantLlmId: leaderParticipant.llmId ?? null,
    phaseId,
    roundIndex,
    messageFragments: leaderProposal.messageFragments,
    fallbackText: leaderProposal.proposalText,
    pendingIncomplete: leaderProposal.messagePendingIncomplete,
    action: 'proposal',
  }));
  return participantHistory;
}

function getCouncilFragmentTexts(message: Pick<DMessage, 'fragments'> | { fragments?: DMessage['fragments'] }): string[] {
  return (message.fragments ?? [])
    .filter(isTextContentFragment)
    .map(fragment => fragment.part.text);
}

function createCouncilTextStreamObserver(params: {
  participantId: string;
  role: 'leader' | 'reviewer';
  roundIndex: number;
  isLeader: boolean;
  onMessageSnapshot: (message: Pick<DMessage, 'fragments' | 'pendingIncomplete'>) => void;
  onTextSnapshot: (text: string) => void;
}): NonNullable<PersonaRunOptions['onStreamUpdate']> {
  let lastSnapshot = '';

  return (message) => {
    params.onMessageSnapshot(message);
    const visibleText = classifyCouncilTextFragments(getCouncilFragmentTexts(message), params.isLeader).deliberationText.trim();
    if (!visibleText || visibleText === lastSnapshot)
      return;

    lastSnapshot = visibleText;
    params.onTextSnapshot(visibleText);
  };
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

function getCouncilLeaderRoundInstructionLines(rejectionReasons: readonly string[], roundIndex: number): string[] {
  if (roundIndex <= 0)
    return [];

  return [
    `You are revising the council proposal for round ${roundIndex + 1}.`,
    'Previous reviewers did not accept the earlier draft. Produce a revised proposal that addresses their objections directly.',
    ...(rejectionReasons.length
      ? [
          'Shared improvement reasons to address:',
          ...rejectionReasons.map((reason, index) => `${index + 1}. ${reason}`),
        ]
      : [
          'Review the prior council transcript in this context and fix the issues raised before proposing again.',
        ]),
  ];
}

async function prepareCouncilLeaderHistory(
  sourceHistory: Readonly<DMessage[]>,
  councilOps: readonly CouncilOp[],
  workflowState: CouncilSessionState,
  assistantLlmId: DLLMId,
  purposeId: SystemPurposeId,
  participants: DConversationParticipant[],
  activeParticipant: DConversationParticipant,
  rejectionReasons: readonly string[],
  roundIndex: number,
): Promise<DMessage[]> {
  const participantHistory = appendPriorCouncilRoundsToHistory(sourceHistory, councilOps, workflowState.phaseId, participants, roundIndex);
  await inlineUpdatePurposeInHistory(participantHistory, assistantLlmId, purposeId, activeParticipant.customPrompt);
  appendCouncilInstruction(
    participantHistory,
    getMultiAgentCoordinationInstructionLines(participants, activeParticipant),
  );
  const leaderRoundInstructions = getCouncilLeaderRoundInstructionLines(rejectionReasons, roundIndex);
  if (leaderRoundInstructions.length)
    appendCouncilInstruction(participantHistory, leaderRoundInstructions);
  inlineUpdateAutoPromptCaching(participantHistory);
  return participantHistory;
}

async function prepareCouncilReviewerHistory(
  sourceHistory: Readonly<DMessage[]>,
  councilOps: readonly CouncilOp[],
  workflowState: CouncilSessionState,
  assistantLlmId: DLLMId,
  purposeId: SystemPurposeId,
  activeParticipant: DConversationParticipant,
  _leaderParticipant: DConversationParticipant,
  proposalText: string,
  participants: DConversationParticipant[],
  _rejectionReasons: readonly string[],
  roundIndex: number,
): Promise<DMessage[]> {
  const participantHistory = appendPriorCouncilRoundsToHistory(sourceHistory, councilOps, workflowState.phaseId, participants, roundIndex);
  appendCurrentRoundProposalToHistory(participantHistory, workflowState.phaseId, workflowState, participants, roundIndex);
  await inlineUpdatePurposeInHistory(participantHistory, assistantLlmId, purposeId, activeParticipant.customPrompt);
  appendCouncilInstruction(
    participantHistory,
    getMultiAgentCoordinationInstructionLines(participants, activeParticipant),
  );

  const instruction = [
    `Analyze the current Leader proposal:\n${proposalText}`,
    'Then return your verdict by calling exactly one tool:',
    `- ${COUNCIL_REVIEWER_ACCEPT_LABEL}`,
    `- ${COUNCIL_REVIEWER_IMPROVE_LABEL}`,
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

export interface MultiAgentResumePlan {
  pendingParticipantsInOrder: DConversationParticipant[];
  existingAssistantMessageId: string | null;
  existingAssistantParticipantId: string | null;
  interruptionReason: string | null;
  updatedAt: number;
  passIndex: number;
}

export function inferMultiAgentResumePlan(params: {
  messages: Readonly<DMessage[]>;
  latestUserMessage: DMessage | null;
  latestUserMessageId: string | null;
  participantsInOrder: DConversationParticipant[];
  turnTerminationMode: Exclude<DConversationTurnTerminationMode, 'council'>;
  persistedSession?: Pick<DPersistedCouncilSession, 'canResume' | 'interruptionReason' | 'updatedAt' | 'passIndex'> | null;
}): MultiAgentResumePlan | null {
  const {
    messages,
    latestUserMessage,
    latestUserMessageId,
    participantsInOrder,
    turnTerminationMode,
    persistedSession = null,
  } = params;

  const assistantMessages = getAssistantMessagesSinceLatestUser(messages, latestUserMessageId);
  const incompleteAssistantMessage = [...assistantMessages].reverse().find(isIncompleteAssistantMessage) ?? null;
  const incompleteAssistantParticipantId = incompleteAssistantMessage?.metadata?.author?.participantId ?? null;

  const initialTriggeredParticipants = mergeParticipantsInRosterOrder(
    participantsInOrder,
    getRunnableParticipants(participantsInOrder, latestUserMessage),
    getMentionedParticipants(latestUserMessage, participantsInOrder),
  );

  const completedParticipantIds = new Set(
    assistantMessages
      .filter(message => !isIncompleteAssistantMessage(message))
      .map(message => message.metadata?.author?.participantId)
      .filter((participantId): participantId is string => !!participantId),
  );

  let outstandingMentionedParticipantIds: string[] = [];
  for (const assistantMessage of assistantMessages) {
    const authorParticipantId = assistantMessage.metadata?.author?.participantId ?? null;
    if (authorParticipantId)
      outstandingMentionedParticipantIds = outstandingMentionedParticipantIds.filter(participantId => participantId !== authorParticipantId);

    const mentionedParticipantIds = getMentionedParticipants(
      assistantMessage,
      participantsInOrder,
      authorParticipantId ? new Set([authorParticipantId]) : new Set(),
    )
      .map(participant => participant.id)
      .filter(participantId => participantId !== authorParticipantId);

    if (mentionedParticipantIds.length) {
      outstandingMentionedParticipantIds = [
        ...mentionedParticipantIds,
        ...outstandingMentionedParticipantIds.filter(participantId => !mentionedParticipantIds.includes(participantId)),
      ];
    }
  }

  const orderedPendingParticipantIds: string[] = [];
  const pushPendingParticipantId = (participantId: string | null | undefined) => {
    if (!participantId || orderedPendingParticipantIds.includes(participantId))
      return;
    orderedPendingParticipantIds.push(participantId);
  };

  pushPendingParticipantId(incompleteAssistantParticipantId);
  outstandingMentionedParticipantIds.forEach(pushPendingParticipantId);

  if (turnTerminationMode === 'continuous') {
    const rotatedParticipants = assistantMessages.length
      ? getContinuousParticipants(messages, latestUserMessageId, participantsInOrder)
      : initialTriggeredParticipants.length
        ? initialTriggeredParticipants
        : participantsInOrder;
    rotatedParticipants.forEach(participant => pushPendingParticipantId(participant.id));
  } else {
    initialTriggeredParticipants
      .filter(participant => participant.id === incompleteAssistantParticipantId || !completedParticipantIds.has(participant.id))
      .forEach(participant => pushPendingParticipantId(participant.id));
  }

  const canResumeFromPersistedStart = !!persistedSession?.canResume
    && assistantMessages.length === 0
    && !!latestUserMessage
    && (persistedSession.updatedAt ?? 0) >= latestUserMessage.created;

  if (!orderedPendingParticipantIds.length && canResumeFromPersistedStart) {
    const bootstrapParticipants = turnTerminationMode === 'continuous'
      ? (initialTriggeredParticipants.length ? initialTriggeredParticipants : participantsInOrder)
      : initialTriggeredParticipants;
    bootstrapParticipants.forEach(participant => pushPendingParticipantId(participant.id));
  }

  const pendingParticipantsInOrder = orderedPendingParticipantIds
    .map(participantId => participantsInOrder.find(participant => participant.id === participantId) ?? null)
    .filter((participant): participant is DConversationParticipant => !!participant);

  if (!pendingParticipantsInOrder.length)
    return null;

  const latestAssistantMessage = assistantMessages.at(-1) ?? null;
  return {
    pendingParticipantsInOrder,
    existingAssistantMessageId: incompleteAssistantMessage?.id ?? null,
    existingAssistantParticipantId: incompleteAssistantParticipantId,
    interruptionReason: incompleteAssistantMessage ? 'page-unload' : persistedSession?.interruptionReason ?? 'recovered-from-transcript',
    updatedAt: incompleteAssistantMessage?.updated
      ?? incompleteAssistantMessage?.created
      ?? latestAssistantMessage?.updated
      ?? latestAssistantMessage?.created
      ?? persistedSession?.updatedAt
      ?? Date.now(),
    passIndex: persistedSession?.passIndex ?? Math.max(assistantMessages.length - 1, 0),
  };
}


async function runCouncilLeaderProposal(
  runtime: ChatExecutionRuntime,
  session: ChatExecutionSession,
  llmId: DLLMId,
  conversationId: DConversationId,
  participant: DConversationParticipant,
  participantHistory: Readonly<DMessage[]>,
  sharedAbortController: AbortController,
  runOptions?: PersonaRunOptions,
): Promise<CouncilDeliberation> {
  const { finalMessage, assistantMessageId } = await runtime.runPersona({
    assistantLlmId: llmId,
    conversationId,
    systemPurposeId: participant.personaId!,
    keepAbortController: true,
    sharedAbortController,
    participant,
    sourceHistory: participantHistory,
    createPlaceholder: false,
    runOptions: withParticipantRunOptions(llmId, participant, runOptions),
    session,
  });

  const result = classifyCouncilTextFragments(getCouncilFragmentTexts(finalMessage), true);
  return {
    participant,
    action: result.action,
    deliberationText: result.deliberationText,
    response: result.response || extractCouncilProposalText(getCouncilFragmentTexts(finalMessage)),
    assistantMessageId,
    messageFragments: finalMessage.fragments,
    messagePendingIncomplete: !!finalMessage.pendingIncomplete,
  };
}

async function runCouncilReviewerBallot(
  runtime: ChatExecutionRuntime,
  session: ChatExecutionSession,
  llmId: DLLMId,
  conversationId: DConversationId,
  participant: DConversationParticipant,
  participantHistory: Readonly<DMessage[]>,
  sharedAbortController: AbortController,
  runOptions?: PersonaRunOptions,
): Promise<CouncilReviewerTurnResult> {
  let { finalMessage } = await runtime.runPersona({
    assistantLlmId: llmId,
    conversationId,
    systemPurposeId: participant.personaId!,
    keepAbortController: true,
    sharedAbortController,
    participant,
    sourceHistory: participantHistory,
    createPlaceholder: false,
    runOptions: withParticipantRunOptions(llmId, participant, runOptions),
    session,
  });

  const fragmentTexts = getCouncilFragmentTexts(finalMessage);
  let ballot: ReturnType<typeof extractCouncilReviewerBallotFromToolInvocation>;
  try {
    ballot = extractCouncilReviewerBallotFromToolInvocation(finalMessage.fragments, participant.id);
    assertCouncilReviewerBallotHasVisibleAnalysis(ballot, finalMessage.fragments);
  } catch (error) {
    const explicitErrorReason = error instanceof Error && error.message.trim()
      ? error.message.trim()
      : '';
    if (explicitErrorReason === COUNCIL_REVIEW_VERDICT_MISSING_REASON && fragmentTexts.length) {
      const repairHistory = participantHistory.map(message => duplicateDMessage(message, false));
      const priorAnalysis = getCouncilReviewerAnalysisTexts(finalMessage.fragments).join('\n\n').trim();
      appendCouncilInstruction(repairHistory, [
        'Your previous review did not submit the required verdict tool call.',
        ...(priorAnalysis ? [
          `Your review analysis was:\n${priorAnalysis}`,
        ] : []),
        'Now return your verdict by calling exactly one tool and no other tool:',
        `- ${COUNCIL_REVIEWER_ACCEPT_LABEL}`,
        `- ${COUNCIL_REVIEWER_IMPROVE_LABEL}`,
        'If you request changes, include the concrete blocking reason in the Improve tool arguments.',
        'Do not repeat the full review in plain text.',
      ]);

      try {
        const repaired = await runtime.runPersona({
          assistantLlmId: llmId,
          conversationId,
          systemPurposeId: participant.personaId!,
          keepAbortController: true,
          sharedAbortController,
          participant,
          sourceHistory: repairHistory,
          createPlaceholder: false,
          runOptions: withParticipantRunOptions(llmId, participant, {
            requestTransform: createCouncilReviewerForcedBallotRequestTransform(),
          }),
          session,
        });

        finalMessage = {
          ...finalMessage,
          fragments: mergeCouncilReviewerVoteFragments(finalMessage.fragments, repaired.finalMessage.fragments),
          pendingIncomplete: !!(finalMessage.pendingIncomplete || repaired.finalMessage.pendingIncomplete),
        };
        ballot = extractCouncilReviewerBallotFromToolInvocation(finalMessage.fragments, participant.id);
        assertCouncilReviewerBallotHasVisibleAnalysis(ballot, finalMessage.fragments);
        return {
          ballot,
          fragmentTexts: getCouncilFragmentTexts(finalMessage),
          messageFragments: finalMessage.fragments,
          messagePendingIncomplete: !!finalMessage.pendingIncomplete,
        };
      } catch (repairError) {
        if (sharedAbortController.signal.aborted)
          throw repairError;
      }
    }

    const fallbackReason = deriveCouncilReviewerFallbackReason(fragmentTexts);
    ballot = {
      reviewerParticipantId: participant.id,
      decision: 'reject',
      reason: (explicitErrorReason === COUNCIL_REVIEW_VERDICT_MISSING_REASON || explicitErrorReason === COUNCIL_REVIEW_ANALYSIS_MISSING_REASON)
        ? explicitErrorReason
        : (fallbackReason && fallbackReason !== COUNCIL_REVIEW_FAILED_REASON
        ? fallbackReason
        : explicitErrorReason)
        || fallbackReason
        || 'review failed',
    };
  }

  return {
    ballot,
    fragmentTexts,
    messageFragments: finalMessage.fragments,
    messagePendingIncomplete: !!finalMessage.pendingIncomplete,
  };
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
      ? COUNCIL_REVIEWER_ACCEPT_LABEL
      : formatCouncilReviewerImproveText(reason);
  const message = createDMessageTextContent('assistant', visibleText);
  message.metadata = {
    ...message.metadata,
    author: {
      participantId: participant.id,
      participantName: participant.name,
      personaId: participant.personaId,
      llmId: participant.llmId ?? participantLlmId,
    },
    councilChannel: COUNCIL_PUBLIC_BOARD_CHANNEL,
    initialRecipients: [{ rt: 'public-board' }],
    council: {
      kind: 'deliberation',
      phaseId,
      passIndex: roundIndex,
      provisional: false,
      action,
      agreedResponse: action === 'proposal' ? text : undefined,
      leaderParticipantId,
      reason: action === 'reject' ? reason : undefined,
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
    council: {
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
    council: {
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

export async function runCouncilSequence(
  session: ChatExecutionSession,
  conversationId: DConversationId,
  participantsInOrder: DConversationParticipant[],
  defaultChatLlmId: DLLMId,
  maxRounds: number = COUNCIL_MAX_PASSES,
  latestUserMessageId: string | null,
  initialCouncilState: CouncilSessionState | null = null,
  runtime?: ChatExecutionRuntime,
): Promise<boolean> {
  void latestUserMessageId;

  if (!participantsInOrder.length)
    return false;

  const phaseId = initialCouncilState?.phaseId ?? `council-${agiCustomId(12)}`;
  const resolvedRuntime = await resolveChatExecutionRuntime(runtime);
  const sharedAbortController = resolvedRuntime.createAbortController();
  const leaderParticipant = getCouncilLeaderParticipant(participantsInOrder);
  if (!leaderParticipant)
    return false;
  const reviewerParticipants = participantsInOrder.filter(participant => participant.id !== leaderParticipant?.id && participant.kind === 'assistant' && !!participant.personaId);
  let currentCouncilOps = getConversationCouncilOpLog(conversationId)
    .filter(op => op.phaseId === phaseId);
  const replayedCurrentCouncilState = currentCouncilOps.length
    ? replayCouncilOpLog(currentCouncilOps).workflowState
    : null;
  const shouldHydrateCouncilOpsFromState = !!initialCouncilState && (
    !currentCouncilOps.length
    || !replayedCurrentCouncilState
    || replayedCurrentCouncilState.phaseId !== initialCouncilState.phaseId
    || (replayedCurrentCouncilState.updatedAt ?? 0) < initialCouncilState.updatedAt
  );
  if (shouldHydrateCouncilOpsFromState)
    currentCouncilOps = createCouncilOpLogFromSessionState(initialCouncilState, conversationId, latestUserMessageId);
  const resumedFromExistingCouncilLog = currentCouncilOps.length > 0 || !!initialCouncilState;
  if (!currentCouncilOps.length) {
    currentCouncilOps = [
      createCouncilOp([], 'session_started', {
        leaderParticipantId: leaderParticipant.id,
        reviewerParticipantIds: reviewerParticipants.map(participant => participant.id),
        maxRounds,
        latestUserMessageId,
      }, {
        phaseId,
        conversationId,
      }),
    ];
  }
  const currentCouncilReplay = replayCouncilOpLog(currentCouncilOps);
  if (resumedFromExistingCouncilLog && currentCouncilReplay.canResume) {
    const resumed = appendCommittedCouncilOps({
      session,
      councilOpLog: currentCouncilOps,
      nextOps: [
        createCouncilOp(currentCouncilOps, 'session_resumed', {
          reason: currentCouncilReplay.interruptionReason,
        }, {
          phaseId,
          conversationId,
        }),
      ],
    });
    currentCouncilOps = resumed.councilOpLog;
  } else {
    session.persistCouncilState(null, currentCouncilOps);
  }
  let currentCouncilState: CouncilSessionState = reduceCouncilOps(currentCouncilOps) ?? initialCouncilState ?? createCouncilSessionState({
    phaseId,
    leaderParticipantId: leaderParticipant.id,
    reviewerParticipantIds: reviewerParticipants.map(participant => participant.id),
    maxRounds,
  });
  const syncCouncilRuntimeMaxRounds = () => {
    const latestMaxRounds = resolveCouncilMaxRounds(getConversationCouncilMaxRounds(conversationId));
    const sessionStartedOpIndex = currentCouncilOps.findIndex(op => op.type === 'session_started' && op.phaseId === phaseId);

    if (sessionStartedOpIndex >= 0) {
      const sessionStartedOp = currentCouncilOps[sessionStartedOpIndex];
      if (sessionStartedOp?.type === 'session_started' && sessionStartedOp.payload.maxRounds !== latestMaxRounds) {
        const nextSessionStartedOp: CouncilOp<'session_started'> = {
          ...sessionStartedOp,
          payload: {
            ...sessionStartedOp.payload,
            maxRounds: latestMaxRounds,
          },
        };
        currentCouncilOps = [...currentCouncilOps];
        currentCouncilOps[sessionStartedOpIndex] = nextSessionStartedOp;
      }
    }

    if (currentCouncilState.maxRounds !== latestMaxRounds) {
      currentCouncilState = {
        ...currentCouncilState,
        maxRounds: latestMaxRounds,
        updatedAt: Date.now(),
      };
    }
  };
  syncCouncilRuntimeMaxRounds();
  let forcedCouncilInterruption: { status: CouncilRunInterruption; reason: string } | null = null;
  session.setAbortController(sharedAbortController, 'chat-persona-council');
  beginCouncilSession(session, 'council', phaseId, currentCouncilState);

  try {
    while (!sharedAbortController.signal.aborted && (currentCouncilState.status === 'drafting' || currentCouncilState.status === 'reviewing')) {
      syncCouncilRuntimeMaxRounds();
      const roundIndex = currentCouncilState.roundIndex;
      setCouncilSessionRunning(session, 'generate-content', 'council', phaseId, roundIndex, currentCouncilState, currentCouncilOps);
      const currentConversationHistory = session.historyViewHeadOrThrow(`chat-persona-council-round-${roundIndex}`) as Readonly<DMessage[]>;
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
      const sharedRejectionReasons = currentCouncilState.rounds[currentCouncilState.roundIndex]?.sharedRejectionReasons ?? [];
      let activeRound = currentCouncilState.rounds[currentCouncilState.roundIndex];
      let proposalText = activeRound?.proposalText?.trim() ?? '';
      let leaderProposalPromise: Promise<CouncilDeliberation>;
      const needsLeaderProposal = doesCouncilRoundNeedLeaderProposal(activeRound);

      if (currentCouncilState.status === 'drafting' || needsLeaderProposal) {
        const leaderHistory = await prepareCouncilLeaderHistory(
          councilSourceHistory,
          currentCouncilOps,
          currentCouncilState,
          leaderLlmId,
          leaderParticipant.personaId,
          participantsInOrder,
          leaderParticipant,
          sharedRejectionReasons,
          currentCouncilState.roundIndex,
        );
        leaderProposalPromise = runCouncilLeaderProposal(
          resolvedRuntime,
          session,
          leaderLlmId,
          conversationId,
          leaderParticipant,
          leaderHistory,
          sharedAbortController,
          {
            onStreamUpdate: createCouncilTextStreamObserver({
              participantId: leaderParticipant.id,
              role: 'leader',
              roundIndex,
              isLeader: true,
              onMessageSnapshot: (message) => {
                currentCouncilState = recordCouncilAgentMessageSnapshot(currentCouncilState, {
                  roundIndex,
                  participantId: leaderParticipant.id,
                  role: 'leader',
                  messageFragments: message.fragments,
                  messagePendingIncomplete: message.pendingIncomplete,
                });
                setCouncilSessionRunning(session, 'generate-content', 'council', phaseId, roundIndex, currentCouncilState, currentCouncilOps);
              },
              onTextSnapshot: (text) => {
                currentCouncilState = appendCouncilAgentTurnEvent(currentCouncilState, {
                  roundIndex,
                  participantId: leaderParticipant.id,
                  role: 'leader',
                  event: {
                    type: 'text-output',
                    createdAt: Date.now(),
                    text,
                  },
                });
                setCouncilSessionRunning(session, 'generate-content', 'council', phaseId, roundIndex, currentCouncilState, currentCouncilOps);
              },
            }),
          },
        );
      } else {
        leaderProposalPromise = Promise.resolve({
          participant: leaderParticipant,
          action: 'proposal',
          deliberationText: activeRound?.leaderTurn?.deliberationText ?? '',
          response: proposalText,
          assistantMessageId: null,
          messageFragments: activeRound?.leaderTurn?.messageFragments ?? [],
          messagePendingIncomplete: activeRound?.leaderTurn?.messagePendingIncomplete ?? false,
        });
      }

      const leaderTurn = await leaderProposalPromise;
      if (sharedAbortController.signal.aborted)
        break;

      if (currentCouncilState.status === 'drafting' || needsLeaderProposal) {
        proposalText = leaderTurn.response.trim();
        if (!proposalText.trim()) {
          const committedStop = appendCommittedCouncilOps({
            session,
            councilOpLog: currentCouncilOps,
            nextOps: [
              createCouncilOp(currentCouncilOps, 'session_stopped', {
                reason: COUNCIL_INTERRUPTION_REASON_INVALID_PROPOSAL,
              }, {
                phaseId,
                conversationId,
              }),
            ],
          });
          currentCouncilOps = committedStop.councilOpLog;
          currentCouncilState = committedStop.workflowState;
          forcedCouncilInterruption = {
            status: 'stopped',
            reason: COUNCIL_INTERRUPTION_REASON_INVALID_PROPOSAL,
          };
          session.messageAppend(createCouncilNotificationMessage(
            phaseId,
            roundIndex,
            `${COUNCIL_INVALID_PROPOSAL_TEXT} Council will stop.`,
          ));
          return false;
        }

        const committedProposal = appendCommittedCouncilOps({
          session,
          councilOpLog: currentCouncilOps,
          nextOps: [
            createCouncilOp(currentCouncilOps, 'leader_turn_committed', {
              roundIndex,
              participantId: leaderParticipant.id,
              proposalId: `${phaseId}-proposal-${roundIndex + 1}`,
              proposalText,
              deliberationText: leaderTurn.deliberationText,
              messageFragments: structuredClone(leaderTurn.messageFragments),
              messagePendingIncomplete: leaderTurn.messagePendingIncomplete,
            }, {
              phaseId,
              conversationId,
            }),
          ],
        });
        currentCouncilOps = committedProposal.councilOpLog;
        currentCouncilState = committedProposal.workflowState;
        setCouncilSessionRunning(session, 'generate-content', 'council', phaseId, roundIndex, currentCouncilState, currentCouncilOps);
        activeRound = currentCouncilState.rounds[currentCouncilState.roundIndex];
      }

      proposalText = currentCouncilState.rounds[currentCouncilState.roundIndex]?.proposalText?.trim() ?? proposalText;
      if (!proposalText)
        return false;

      activeRound = currentCouncilState.rounds[currentCouncilState.roundIndex];
      if (activeRound?.phase === 'reviewer-plans') {
        currentCouncilState = {
          ...currentCouncilState,
          rounds: currentCouncilState.rounds.map(round => round.roundIndex !== currentCouncilState.roundIndex
            ? round
            : {
                ...round,
                phase: 'reviewer-votes',
              }),
          updatedAt: Date.now(),
        };
        activeRound = currentCouncilState.rounds[currentCouncilState.roundIndex];
      }

      if (sharedAbortController.signal.aborted)
        break;

      activeRound = currentCouncilState.rounds[currentCouncilState.roundIndex];
      if (activeRound?.phase === 'reviewer-votes') {
        const pendingVoteReviewers = reviewerParticipants.filter(reviewer => {
          const reviewerVote = activeRound?.reviewerVotes[reviewer.id] ?? null;
          return !reviewerVote || isRetryableCouncilReviewerVote(reviewerVote);
        });
        let newBallots: CouncilBallotRecord[] = [];
        try {
          newBallots = await Promise.all(pendingVoteReviewers.map(async (reviewer) => {
            if (sharedAbortController.signal.aborted)
              throw new Error('aborted');

            const reviewerLlmId = reviewer.llmId ?? defaultChatLlmId;

            let reviewerResult: CouncilReviewerTurnResult = {
              ballot: {
                reviewerParticipantId: reviewer.id,
                decision: 'reject',
                reason: 'review failed',
              },
              fragmentTexts: [],
              messageFragments: [],
              messagePendingIncomplete: false,
            };

            if (reviewer.personaId && reviewerLlmId) {
              try {
                const reviewerHistory = await prepareCouncilReviewerHistory(
                  councilSourceHistory,
                  currentCouncilOps,
                  currentCouncilState,
                  reviewerLlmId,
                  reviewer.personaId,
                  reviewer,
                  leaderParticipant,
                  proposalText,
                  participantsInOrder,
                  sharedRejectionReasons,
                  currentCouncilState.roundIndex,
                );
                reviewerResult = await runCouncilReviewerBallot(
                  resolvedRuntime,
                  session,
                  reviewerLlmId,
                  conversationId,
                  reviewer,
                  reviewerHistory,
                  sharedAbortController,
                  {
                    requestTransform: createCouncilReviewerBallotRequestTransform(),
                    onStreamUpdate: createCouncilTextStreamObserver({
                      participantId: reviewer.id,
                      role: 'reviewer',
                      roundIndex,
                      isLeader: false,
                      onMessageSnapshot: (message) => {
                        currentCouncilState = recordCouncilAgentMessageSnapshot(currentCouncilState, {
                          roundIndex,
                          participantId: reviewer.id,
                          role: 'reviewer',
                          messageFragments: message.fragments,
                          messagePendingIncomplete: message.pendingIncomplete,
                        });
                        setCouncilSessionRunning(session, 'generate-content', 'council', phaseId, roundIndex, currentCouncilState, currentCouncilOps);
                      },
                      onTextSnapshot: (text) => {
                        currentCouncilState = appendCouncilAgentTurnEvent(currentCouncilState, {
                          roundIndex,
                          participantId: reviewer.id,
                          role: 'reviewer',
                          event: {
                            type: 'text-output',
                            createdAt: Date.now(),
                            text,
                          },
                        });
                        setCouncilSessionRunning(session, 'generate-content', 'council', phaseId, roundIndex, currentCouncilState, currentCouncilOps);
                      },
                    }),
                  },
                );
              } catch {
                if (sharedAbortController.signal.aborted)
                  throw new Error('aborted');
                const reviewerTurnSnapshot = currentCouncilState.rounds[roundIndex]?.reviewerTurns[reviewer.id] ?? null;
                const snapshotFragmentTexts = getCouncilFragmentTexts({ fragments: reviewerTurnSnapshot?.messageFragments ?? [] });
                reviewerResult = {
                  ballot: {
                    reviewerParticipantId: reviewer.id,
                    decision: 'reject',
                    reason: deriveCouncilReviewerFallbackReason(snapshotFragmentTexts),
                  },
                  fragmentTexts: snapshotFragmentTexts,
                  messageFragments: reviewerTurnSnapshot?.messageFragments ?? [],
                  messagePendingIncomplete: reviewerTurnSnapshot?.messagePendingIncomplete ?? false,
                };
              }
            }

            if (sharedAbortController.signal.aborted)
              throw new Error('aborted');

            const committedVote = appendCommittedCouncilOps({
              session,
              councilOpLog: currentCouncilOps,
              nextOps: [
                createCouncilOp(currentCouncilOps, 'reviewer_vote_committed', {
                  roundIndex,
                  participantId: reviewer.id,
                  decision: reviewerResult.ballot.decision,
                  reason: reviewerResult.ballot.decision === 'reject' ? reviewerResult.ballot.reason ?? null : null,
                  fragmentTexts: [...reviewerResult.fragmentTexts],
                  messageFragments: structuredClone(reviewerResult.messageFragments),
                  messagePendingIncomplete: reviewerResult.messagePendingIncomplete,
                }, {
                  phaseId,
                  conversationId,
                }),
              ],
            });
            currentCouncilOps = committedVote.councilOpLog;
            currentCouncilState = committedVote.workflowState;
            setCouncilSessionRunning(session, 'generate-content', 'council', phaseId, roundIndex, currentCouncilState, currentCouncilOps);

            return reviewerResult.ballot;
          }));
        } catch (error) {
          if (sharedAbortController.signal.aborted)
            break;
          throw error;
        }

        if (sharedAbortController.signal.aborted)
          break;

        const ballots = reviewerParticipants
          .map(reviewer => currentCouncilState.rounds[currentCouncilState.roundIndex]?.reviewerVotes[reviewer.id]?.ballot ?? null)
          .filter((ballot): ballot is NonNullable<typeof ballot> => !!ballot);
        void newBallots;
        syncCouncilRuntimeMaxRounds();
        const roundCompletionOps: CouncilOp[] = [
          createCouncilOp(currentCouncilOps, 'round_completed', {
            roundIndex,
            outcome: ballots.some(ballot => ballot.decision === 'reject') ? 'revise' : 'accepted',
            rejectionReasons: ballots
              .filter((ballot): ballot is typeof ballot & { decision: 'reject'; reason: string } => ballot.decision === 'reject' && !!ballot.reason)
              .map(ballot => ballot.reason),
          }, {
            phaseId,
            conversationId,
          }),
        ];
        const projectedAfterRound = reduceCouncilOps(appendCouncilOps(currentCouncilOps, roundCompletionOps));
        if (projectedAfterRound?.status === 'accepted' && projectedAfterRound.acceptedProposalId && projectedAfterRound.finalResponse) {
          roundCompletionOps.push(createCouncilOp(appendCouncilOps(currentCouncilOps, roundCompletionOps), 'session_accepted', {
            roundIndex: projectedAfterRound.roundIndex,
            proposalId: projectedAfterRound.acceptedProposalId,
            finalResponse: projectedAfterRound.finalResponse,
          }, {
            phaseId,
            conversationId,
          }));
        } else if (projectedAfterRound?.status === 'exhausted') {
          roundCompletionOps.push(createCouncilOp(appendCouncilOps(currentCouncilOps, roundCompletionOps), 'session_exhausted', {
            roundIndex: projectedAfterRound.roundIndex,
          }, {
            phaseId,
            conversationId,
          }));
        }
        const committedRound = appendCommittedCouncilOps({
          session,
          councilOpLog: currentCouncilOps,
          nextOps: roundCompletionOps,
        });
        currentCouncilOps = committedRound.councilOpLog;
        currentCouncilState = committedRound.workflowState;
      }

      if (currentCouncilState.status === 'accepted') {
        if (currentCouncilState.finalResponse)
          appendCouncilAcceptedResult(session, currentCouncilState.finalResponse, leaderParticipant, phaseId, roundIndex);
        return !sharedAbortController.signal.aborted;
      }

      if (currentCouncilState.status === 'exhausted')
        return false;
    }

    return false;
  } finally {
    const interruption = forcedCouncilInterruption ?? getCouncilInterruption(sharedAbortController);
    if (interruption && interruption !== forcedCouncilInterruption) {
      const interruptionType = interruption.status === 'paused'
        ? 'session_paused'
        : interruption.status === 'stopped'
          ? 'session_stopped'
          : null;
      if (interruptionType) {
        const interruptedCommit = appendCommittedCouncilOps({
          session,
          councilOpLog: currentCouncilOps,
          nextOps: [
            createCouncilOp(currentCouncilOps, interruptionType, {
              reason: interruption.reason,
            }, {
              phaseId,
              conversationId,
            }),
          ],
        });
        currentCouncilOps = interruptedCommit.councilOpLog;
        currentCouncilState = interruptedCommit.workflowState;
      }
    }
    session.clearAbortController('chat-persona-council');
    finalizeCouncilSession(session, interruption, 'council', phaseId, currentCouncilState.roundIndex, currentCouncilState, currentCouncilOps);
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
  resumePlan?: Pick<MultiAgentResumePlan, 'pendingParticipantsInOrder' | 'existingAssistantMessageId' | 'existingAssistantParticipantId'> | null,
): Promise<boolean> {
  if (!participantsInOrder.length)
    return false;

  const resolvedRuntime = await resolveChatExecutionRuntime(runtime);
  const sharedAbortController = resolvedRuntime.createAbortController();
  session.setAbortController(sharedAbortController, 'chat-persona-multi');
  beginCouncilSession(session, turnTerminationMode);
  const leaderParticipant = turnTerminationMode === 'continuous'
    ? getCouncilLeaderParticipant(allAssistantParticipants)
    : null;

  let continuousTurnCount = 0;
  let continuousLoopIndex = 0;

  try {
    const results: boolean[] = [];
    const participantCount = participantsInOrder.length;
    let pendingMentionedParticipantIds: string[] = [];
    let allowRoundRobinMentionContinuation = false;
    let continuousLoopSpokenParticipantIds = new Set<string>();
    let initialParticipantsForPassOverride = resumePlan?.pendingParticipantsInOrder?.length
      ? [...resumePlan.pendingParticipantsInOrder]
      : null;
    let resumeIncompleteAssistantMessageId = resumePlan?.existingAssistantMessageId ?? null;
    let resumeIncompleteAssistantParticipantId = resumePlan?.existingAssistantParticipantId ?? null;

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
      const participantsForPassBase = initialParticipantsForPassOverride?.length
        ? initialParticipantsForPassOverride
        : turnTerminationMode === 'continuous'
          ? getContinuousParticipants(historyForTurn, latestUserMessageId, participantsInOrder)
            .filter(participant => !continuousLoopSpokenParticipantIds.has(participant.id))
          : allowRoundRobinMentionContinuation
            ? participantsInOrder
            : getParticipantsRemainingThisTurn(historyForTurn, latestUserMessageId, participantsInOrder);
      initialParticipantsForPassOverride = null;

      const queuedMentionedParticipants = pendingMentionedParticipantIds
        .map(participantId => participantsForPassBase.find(participant => participant.id === participantId) ?? participantsInOrder.find(participant => participant.id === participantId) ?? allAssistantParticipants.find(participant => participant.id === participantId) ?? null)
        .filter((participant): participant is DConversationParticipant => !!participant);
      const queuedMentionedParticipantIds = new Set(queuedMentionedParticipants.map(participant => participant.id));
      const participantsForPass = [
        ...queuedMentionedParticipants,
        ...participantsForPassBase.filter(participant => !queuedMentionedParticipantIds.has(participant.id)),
      ];
      pendingMentionedParticipantIds = [];

      if (!participantsForPass.length) {
        if (turnTerminationMode === 'continuous' && participantCount > 1 && continuousLoopSpokenParticipantIds.size > 0) {
          continuousLoopIndex++;
          continuousLoopSpokenParticipantIds = new Set<string>();
          continue;
        }
        break;
      }

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
        const canLeaderExitLoop = turnTerminationMode === 'continuous'
          && leaderParticipant?.id === participant.id
          && continuousLoopIndex > 0;
        const participantHistory = await preparePersonaHistory(
          sourceHistory,
          participantLlmId,
          participantPersonaId,
          allAssistantParticipants,
          participant,
          {
            includeExitLoopInstruction: canLeaderExitLoop,
          },
        );
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
          runOptions: withParticipantRunOptions(participantLlmId, participant, {
            ...(resumeIncompleteAssistantMessageId && resumeIncompleteAssistantParticipantId === participant.id
              ? { existingAssistantMessageId: resumeIncompleteAssistantMessageId }
              : {}),
            ...(canLeaderExitLoop
              ? { requestTransform: createExitLoopRequestTransform() }
              : {}),
          }),
          session,
        });
        if (resumeIncompleteAssistantParticipantId === participant.id) {
          resumeIncompleteAssistantMessageId = null;
          resumeIncompleteAssistantParticipantId = null;
        }
        results.push(result.success);
        if (turnTerminationMode === 'continuous')
          continuousLoopSpokenParticipantIds.add(participant.id);

        madeProgressThisPass = madeProgressThisPass || result.success;

        if (canLeaderExitLoop
          && hasExitLoopToolInvocation(result.finalMessage.fragments)
          && hasVisibleExitLoopReplyContent(result.finalMessage.fragments)) {
          sharedAbortController.abort('@exit-loop');
        }

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
      const sourceHistoryForRequestedChannel = initialHistory.filter(message =>
        message.role === 'system' || messageMatchesCouncilChannel(message, requestedCouncilChannel),
      );
      const historyForRequestedChannel = sourceHistoryForRequestedChannel.map(message => duplicateDMessage(message, false));
      const latestUserMessage = [...sourceHistoryForRequestedChannel].reverse().find(message => message.role === 'user') ?? null;
      const resumeSession = turnTerminationMode === 'council'
        ? session.getCouncilSession()
        : createIdleCouncilSessionState();
      if (hasStopToken(latestUserMessage)) {
        session.clearAbortController('chat-persona-stop-token');
        return true;
      }
      const assistantParticipantsForChannel = getParticipantsForCouncilChannel(assistantParticipants, requestedCouncilChannel, conversationId);
      const targetedParticipants = getExplicitRecipientParticipants(assistantParticipantsForChannel, latestUserMessage);
      const participantsForRequestedTurn = targetedParticipants.participants;
      const runnableParticipants = getRunnableParticipants(targetedParticipants.participants, latestUserMessage);
      const directlyMentionedParticipants = getMentionedParticipants(latestUserMessage, assistantParticipantsForChannel);
      const participantsRequestedInOrder = mergeParticipantsInRosterOrder(assistantParticipantsForChannel, participantsForRequestedTurn, directlyMentionedParticipants);
      const participantsForTurn = mergeParticipantsInRosterOrder(assistantParticipantsForChannel, runnableParticipants, directlyMentionedParticipants);
      const effectiveTurnTerminationMode = (requestedCouncilChannel.channel !== 'public-board' || targetedParticipants.hasExplicitParticipantRecipients) && turnTerminationMode === 'council'
        ? 'round-robin-per-human'
        : turnTerminationMode;
      const persistedResumeSession = session.getCouncilSession().canResume ? session.getCouncilSession() : null;
      const multiAgentResumePlan = effectiveTurnTerminationMode !== 'council'
        ? inferMultiAgentResumePlan({
            messages: sourceHistoryForRequestedChannel,
            latestUserMessage,
            latestUserMessageId: latestUserMessage?.id ?? null,
            participantsInOrder: participantsRequestedInOrder,
            turnTerminationMode: effectiveTurnTerminationMode,
            persistedSession: persistedResumeSession,
          })
        : null;
      const effectiveParticipantsForTurn = multiAgentResumePlan?.pendingParticipantsInOrder.length
        ? multiAgentResumePlan.pendingParticipantsInOrder
        : participantsForTurn;

      if (!effectiveParticipantsForTurn.length) {
        session.messageAppendAssistantText(`No agent was triggered in ${describeCouncilChannel(requestedCouncilChannel, participants, conversationId)}. Mention an agent with @alias, or set it to speak every turn.`, 'issue');
        return false;
      }

      const councilMaxRounds = resolveCouncilMaxRounds(getConversationCouncilMaxRounds(conversationId));
      const councilOpLog = getConversationCouncilOpLog(conversationId);
      const councilSessionStartedOp = councilOpLog.find(op => op.type === 'session_started') ?? null;
      const councilOpReplay = effectiveTurnTerminationMode === 'council'
        && (!latestUserMessage
          || !councilSessionStartedOp
          || councilSessionStartedOp.payload.latestUserMessageId === latestUserMessage.id
          || !councilSessionStartedOp.payload.latestUserMessageId
        )
        ? replayCouncilOpLog(councilOpLog)
        : null;
      const initialCouncilState = effectiveTurnTerminationMode === 'council' && (councilOpReplay?.canResume || resumeSession.canResume)
        ? pickPreferredCouncilResumeState({
            replayedState: councilOpReplay?.canResume ? councilOpReplay.workflowState : null,
            replayedUpdatedAt: councilOpReplay?.updatedAt ?? null,
            persistedState: resumeSession.canResume ? resumeSession.workflowState ?? null : null,
            persistedUpdatedAt: resumeSession.updatedAt,
          }) ?? (() => {
            const resumePhaseId = resumeSession.phaseId?.trim() || null;
            const leaderParticipant = getCouncilLeaderParticipant(participantsForTurn);
            if (!resumePhaseId || !leaderParticipant)
              return null;

            const reviewerParticipants = participantsForTurn.filter(participant =>
              participant.id !== leaderParticipant.id && participant.kind === 'assistant' && !!participant.personaId);
            return hydrateCouncilSessionFromTranscriptEntries({
              phaseId: resumePhaseId,
              leaderParticipantId: leaderParticipant.id,
              reviewerParticipantIds: reviewerParticipants.map(participant => participant.id),
              maxRounds: councilMaxRounds,
              entries: historyForRequestedChannel
                .filter(message => {
                  const council = message.metadata?.council;
                  return council?.kind === 'deliberation' && council.phaseId === resumePhaseId;
                })
                .map(message => ({
                  roundIndex: message.metadata?.council?.passIndex ?? 0,
                  participantId: message.metadata?.author?.participantId ?? '',
                  action: message.metadata?.council?.action === 'accept'
                    ? 'accept'
                    : message.metadata?.council?.action === 'reject'
                      ? 'reject'
                      : 'proposal',
                  messageId: message.id,
                  text: messageFragmentsReduceText(message.fragments).trim(),
                  reason: message.metadata?.council?.reason,
                })),
            });
          })()
        : null;

      if (effectiveParticipantsForTurn.length > 1 || effectiveTurnTerminationMode === 'continuous' || effectiveTurnTerminationMode === 'council' || !!multiAgentResumePlan)
        return effectiveTurnTerminationMode === 'council'
          ? await runCouncilSequence(
            session,
            conversationId,
            effectiveParticipantsForTurn,
            chatLLMId,
            councilMaxRounds,
            latestUserMessage?.id ?? null,
            initialCouncilState,
            resolvedRuntime,
          )
          : await runParticipantSequence(
            session,
            conversationId,
            effectiveParticipantsForTurn,
            assistantParticipantsForChannel,
            chatLLMId,
            effectiveTurnTerminationMode,
            latestUserMessage?.id ?? null,
            requestedCouncilChannel,
            resolvedRuntime,
            multiAgentResumePlan,
          );

      const soleParticipant = effectiveParticipantsForTurn[0] ?? primaryParticipant;
      const soleParticipantPersonaId = soleParticipant?.personaId ?? systemPurposeId;
      const soleParticipantLlmId = soleParticipant?.llmId ?? chatLLMId;
      if (!soleParticipant || !soleParticipantPersonaId || !soleParticipantLlmId)
        return 'err-no-persona';

      const participantHistory = await preparePersonaHistory(
        historyForRequestedChannel,
        soleParticipantLlmId,
        soleParticipantPersonaId,
        assistantParticipantsForChannel,
        soleParticipant,
        {
          includeExitLoopInstruction: false,
        },
      );
      return (await resolvedRuntime.runPersona({
        assistantLlmId: soleParticipantLlmId,
        conversationId,
        systemPurposeId: soleParticipantPersonaId,
        keepAbortController: false,
        participant: soleParticipant,
        sourceHistory: participantHistory,
        createPlaceholder: true,
        messageChannel: requestedCouncilChannel,
        runOptions: withParticipantRunOptions(soleParticipantLlmId, soleParticipant, undefined),
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
