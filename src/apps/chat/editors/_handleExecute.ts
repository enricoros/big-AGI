import * as z from 'zod/v4';

import type { DLLMId } from '~/common/stores/llms/llms.types';
import { getChatLLMId } from '~/common/stores/llms/store-llms';

import type { SystemPurposeId } from '../../../data';

import { agiCustomId, agiUuid } from '~/common/util/idUtils';

import type { DConversationId, DConversationParticipant, DConversationTurnTerminationMode } from '~/common/stores/chat/chat.conversation';
import { createDMessageTextContent } from '~/common/stores/chat/chat.message';
import type { DMessage } from '~/common/stores/chat/chat.message';
import { messageFragmentsReduceText } from '~/common/stores/chat/chat.message';
import { duplicateDMessage } from '~/common/stores/chat/chat.message';
import { splitSystemMessageFromHistory } from '~/common/stores/chat/chat.conversation';
import { ConversationHandler } from '~/common/chat-overlay/ConversationHandler';
import { ConversationsManager } from '~/common/chat-overlay/ConversationsManager';
import { createTextContentFragment, isContentFragment, isContentOrAttachmentFragment, isImageRefPart, isTextContentFragment, isZyncAssetImageReferencePart } from '~/common/stores/chat/chat.fragments';
import { aixChatGenerateContent_DMessage_orThrow, aixCreateChatGenerateContext } from '~/modules/aix/client/aix.client';
import { aixFunctionCallTool } from '~/modules/aix/client/aix.client.fromSimpleFunction';
import { aixCGR_ChatSequence_FromDMessagesOrThrow, aixCGR_SystemMessage_FromDMessageOrThrow } from '~/modules/aix/client/aix.client.chatGenerateRequest';
import type { AixAPIChatGenerate_Request } from '~/modules/aix/server/api/aix.wiretypes';
import { getConversationParticipants, getConversationTurnTerminationMode } from '~/common/stores/chat/store-chats';

import type { ChatExecuteMode } from '../execute-mode/execute-mode.types';
import { textToDrawCommand } from '../commands/CommandsDraw';

import { _handleExecuteCommand, RET_NO_CMD } from './_handleExecuteCommand';
import { runImageGenerationUpdatingState } from './image-generate';
import { runPersonaOnConversationHead } from './chat-persona';
import {
  getContinuousParticipants,
  getMentionedParticipants,
  getParticipantsRemainingThisTurn,
  getRunnableParticipants,
  hasStopToken,
  mergeParticipantsInRosterOrder,
} from './_handleExecute.multiAgent';
import { runReActUpdatingState } from './react-tangent';

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

function preparePersonaHistory(sourceHistory: Readonly<DMessage[]>, assistantLlmId: DLLMId, purposeId: SystemPurposeId, participants: DConversationParticipant[], activeParticipant: DConversationParticipant): DMessage[] {
  const participantHistory = [...sourceHistory];
  ConversationHandler.inlineUpdatePurposeInHistory(participantHistory, assistantLlmId, purposeId, activeParticipant.customPrompt);

  const coordinationMessage = buildMultiAgentCoordinationMessage(participants, activeParticipant);
  const systemMessage = participantHistory.find(message => message.role === 'system') ?? null;
  const systemTextFragment = systemMessage?.fragments.find(isTextContentFragment) ?? null;
  const coordinationTextFragment = coordinationMessage.fragments.find(isTextContentFragment) ?? null;

  if (systemMessage && systemTextFragment && coordinationTextFragment) {
    systemTextFragment.part.text = `${systemTextFragment.part.text.trim()}\n\n${coordinationTextFragment.part.text}`;
  } else {
    participantHistory.unshift(coordinationMessage);
  }

  ConversationHandler.inlineUpdateAutoPromptCaching(participantHistory);
  return participantHistory;
}


function getConsensusParticipantsRemaining(_messages: Readonly<DMessage[]>, _latestUserMessageId: string | null, runnableParticipants: DConversationParticipant[]): DConversationParticipant[] {
  return runnableParticipants;
}
const CONSENSUS_AIX_CONTEXT_NAME = 'conversation';
const CONSENSUS_AGREE_TOOL_NAME = 'agree';
const CONSENSUS_DONT_AGREE_TOOL_NAME = 'dont_agree';
const CONSENSUS_MAX_PASSES = 12;
const CONSENSUS_TRANSCRIPT_PREFIX = '[Consensus deliberation]';
const consensusActionInputSchema = z.object({
  response: z.string().min(1).describe('The exact final response that should be shown to the user when agreement is reached.'),
  rationale: z.string().optional().describe('Optional short explanation of why you agree or what still needs to change.'),
});

type ConsensusToolAction = 'agree' | 'dont_agree';

type ConsensusAgreement = {
  participant: DConversationParticipant;
  action: ConsensusToolAction;
  response: string;
  rationale: string;
  deliberationText: string;
};

function getConsensusTextSignature(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
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

function getConsensusWorkingHistory(messages: Readonly<DMessage[]>, phaseId: string): DMessage[] {
  return messages
    .filter(message => !isConsensusDeliberationMessage(message) || message.metadata?.consensus?.phaseId === phaseId)
    .map(message => duplicateDMessage(message, false));
}

function stripConsensusTranscriptPrefix(text: string): string {
  return text.replace(/^\[Consensus deliberation\]\s*/i, '').trim();
}

function getConsensusResponsePrompt(activeParticipant: DConversationParticipant): DMessage {
  const instruction = [
    'Consensus mode is active.',
    'You are in a shared deliberation room with the other agents.',
    'You may talk to every other agent through normal assistant messages in the visible deliberation transcript.',
    'Use @mentions when you want to address a specific agent, and use @all when speaking to everyone.',
    `Every deliberation turn must end with exactly one tool call: either ${CONSENSUS_AGREE_TOOL_NAME} or ${CONSENSUS_DONT_AGREE_TOOL_NAME}.`,
    `Call ${CONSENSUS_AGREE_TOOL_NAME} only when you agree with the exact final user-facing response.`,
    `Call ${CONSENSUS_DONT_AGREE_TOOL_NAME} when you think the final response still needs changes before it can be shown to the user.`,
    'Put the exact proposed final response in the tool response field every time.',
    'Before the tool call, write a concise deliberation message for the other agents describing your position or requested edits.',
    'Do not output the final user-facing answer directly to the user. The visible text is only deliberation among agents.',
    `Prefix your deliberation text with ${CONSENSUS_TRANSCRIPT_PREFIX} so it can be shown in the deliberation panel.`,
    `Current agent: ${activeParticipant.name}.`,
  ].join('\n');

  const message = createDMessageTextContent('system', instruction);
  message.updated = message.created;
  return message;
}

function prepareConsensusHistory(sourceHistory: Readonly<DMessage[]>, assistantLlmId: DLLMId, purposeId: SystemPurposeId, participants: DConversationParticipant[], activeParticipant: DConversationParticipant): DMessage[] {
  const participantHistory = preparePersonaHistory(sourceHistory, assistantLlmId, purposeId, participants, activeParticipant);
  const consensusMessage = getConsensusResponsePrompt(activeParticipant);
  const systemMessage = participantHistory.find(message => message.role === 'system') ?? null;
  const systemTextFragment = systemMessage?.fragments.find(isTextContentFragment) ?? null;
  const consensusTextFragment = consensusMessage.fragments.find(isTextContentFragment) ?? null;

  if (systemMessage && systemTextFragment && consensusTextFragment)
    systemTextFragment.part.text = `${systemTextFragment.part.text.trim()}\n\n${consensusTextFragment.part.text}`;
  else
    participantHistory.unshift(consensusMessage);

  return participantHistory;
}

function getAssistantMessageForParticipantSinceLatestUser(messages: Readonly<DMessage[]>, latestUserMessageId: string | null, participantId: string): DMessage | null {
  return [...getAssistantMessagesSinceLatestUser(messages, latestUserMessageId)]
    .reverse()
    .find(message => message.metadata?.author?.participantId === participantId) ?? null;
}

function getConsensusToolInvocation(fragments: DMessage['fragments'], debugLabel: string): { action: ConsensusToolAction; argsObject: object } {
  let invocation: { name: string; args: string } | null = null;
  let invocationCount = 0;

  for (const fragment of fragments) {
    if (!isContentFragment(fragment) || fragment.part.pt !== 'tool_invocation' || fragment.part.invocation.type !== 'function_call')
      continue;

    if (fragment.part.invocation.name !== CONSENSUS_AGREE_TOOL_NAME && fragment.part.invocation.name !== CONSENSUS_DONT_AGREE_TOOL_NAME)
      continue;

    invocationCount++;
    invocation = {
      name: fragment.part.invocation.name,
      args: fragment.part.invocation.args,
    };
  }

  if (!invocation || invocationCount !== 1)
    throw new Error(`AIX: Expected exactly one consensus tool invocation (${debugLabel}).`);

  if (!invocation.args)
    throw new Error(`AIX: Missing consensus function arguments (${debugLabel}).`);

  return {
    action: invocation.name === CONSENSUS_AGREE_TOOL_NAME ? 'agree' : 'dont_agree',
    argsObject: JSON.parse(invocation.args),
  };
}

async function getConsensusAgreement(
  llmId: DLLMId,
  conversationId: DConversationId,
  participantHistory: Readonly<DMessage[]>,
  abortSignal: AbortSignal,
  phaseId: string,
  passIndex: number,
  participant: DConversationParticipant,
): Promise<ConsensusAgreement> {
  const { chatSystemInstruction, chatHistory } = splitSystemMessageFromHistory(participantHistory);
  const aixChatGenerate: AixAPIChatGenerate_Request = {
    systemMessage: await aixCGR_SystemMessage_FromDMessageOrThrow(chatSystemInstruction),
    chatSequence: await aixCGR_ChatSequence_FromDMessagesOrThrow(chatHistory),
    tools: [
      aixFunctionCallTool({
        name: CONSENSUS_AGREE_TOOL_NAME,
        description: 'Use this when you agree on the exact final response that should be shown to the user.',
        inputSchema: consensusActionInputSchema,
      }),
      aixFunctionCallTool({
        name: CONSENSUS_DONT_AGREE_TOOL_NAME,
        description: 'Use this when you do not yet agree on the final response and want deliberation to continue.',
        inputSchema: consensusActionInputSchema,
      }),
    ],
    toolsPolicy: { type: 'any' },
  };

  const { fragments } = await aixChatGenerateContent_DMessage_orThrow(
    llmId,
    aixChatGenerate,
    aixCreateChatGenerateContext(CONSENSUS_AIX_CONTEXT_NAME, `${conversationId}::consensus::${phaseId}::${participant.id}::${passIndex}`),
    false,
    {
      abortSignal,
      llmOptionsOverride: { llmTemperature: 0 },
    },
  );

  const { action, argsObject } = getConsensusToolInvocation(fragments, `consensus-${conversationId}-${llmId}-${participant.id}-${passIndex}`);
  const { response, rationale } = consensusActionInputSchema.parse(argsObject);
  const deliberationText = fragments
    .filter(isTextContentFragment)
    .map(fragment => stripConsensusTranscriptPrefix(fragment.part.text))
    .join('\n\n')
    .trim();

  return {
    participant,
    action,
    response: response.trim(),
    rationale: rationale?.trim() || '',
    deliberationText,
  };
}

function createConsensusDeliberationMessage(
  participant: DConversationParticipant,
  participantLlmId: DLLMId,
  phaseId: string,
  passIndex: number,
  action: ConsensusToolAction,
  deliberationText: string,
  response: string,
): DMessage {
  const visibleText = deliberationText.trim() || `${action === 'agree' ? 'agree' : 'dont_agree'}: ${response}`;
  const message = createDMessageTextContent('assistant', visibleText);
  message.metadata = {
    ...message.metadata,
    author: {
      participantId: participant.id,
      participantName: participant.name,
      personaId: participant.personaId,
      llmId: participant.llmId ?? participantLlmId,
    },
    consensus: {
      kind: 'deliberation',
      phaseId,
      passIndex,
      action,
      agreedResponse: response,
    },
  };
  message.updated = message.created;
  return message;
}

function didParticipantsReachConsensus(agreements: Readonly<ConsensusAgreement[]>, participants: DConversationParticipant[]): boolean {
  if (!participants.length || agreements.length !== participants.length)
    return false;

  if (agreements.some(agreement => agreement.action !== 'agree'))
    return false;

  const signatures = agreements.map(agreement => getConsensusTextSignature(agreement.response)).filter(Boolean);
  return signatures.length === participants.length && new Set(signatures).size === 1;
}

function appendConsensusResult(cHandler: ConversationHandler, agreedResponse: string, participants: DConversationParticipant[], phaseId: string, passIndex: number): void {
  const finalMessage = createDMessageTextContent('assistant', agreedResponse);
  finalMessage.metadata = {
    ...finalMessage.metadata,
    author: {
      participantId: participants.map(participant => participant.id).join('|'),
      participantName: 'Consensus',
      personaId: null,
      llmId: null,
    },
    consensus: {
      kind: 'result',
      phaseId,
      passIndex,
      action: 'agree',
      agreedResponse,
    },
  };
  cHandler.messageAppend(finalMessage);
}

async function runConsensusSequence(
  cHandler: ConversationHandler,
  conversationId: DConversationId,
  participantsInOrder: DConversationParticipant[],
  defaultChatLlmId: DLLMId,
  latestUserMessageId: string | null,
): Promise<boolean> {
  if (!participantsInOrder.length)
    return false;

  const phaseId = `consensus-${agiCustomId(12)}`;
  const sharedAbortController = new AbortController();
  cHandler.setAbortController(sharedAbortController, 'chat-persona-consensus');

  try {
    const results: boolean[] = [];

    for (let passIndex = 0; passIndex < CONSENSUS_MAX_PASSES && !sharedAbortController.signal.aborted; passIndex++) {
      const currentConversationHistory = cHandler.historyViewHeadOrThrow(`chat-persona-consensus-pass-${passIndex}`) as Readonly<DMessage[]>;
      const latestUserMessage = [...currentConversationHistory].reverse().find(message => message.role === 'user') ?? null;
      if (hasStopToken(latestUserMessage)) {
        sharedAbortController.abort('@stop');
        break;
      }

      const participantsForPass = getConsensusParticipantsRemaining(currentConversationHistory, latestUserMessageId, participantsInOrder);
      if (!participantsForPass.length)
        break;

      const agreements: ConsensusAgreement[] = [];
      let madeProgressThisPass = false;

      for (const participant of participantsForPass) {
        if (sharedAbortController.signal.aborted)
          break;

        const participantPersonaId = participant.personaId;
        const participantLlmId = participant.llmId ?? defaultChatLlmId;
        if (!participantPersonaId || !participantLlmId)
          continue;

        const sourceHistory = getConsensusWorkingHistory(cHandler.historyViewHeadOrThrow(`chat-persona-consensus-source-${participant.id}-${passIndex}`), phaseId);
        const participantHistory = prepareConsensusHistory(sourceHistory, participantLlmId, participantPersonaId, participantsInOrder, participant);

        try {
          const agreement = await getConsensusAgreement(
            participantLlmId,
            conversationId,
            participantHistory,
            sharedAbortController.signal,
            phaseId,
            passIndex,
            participant,
          );
          agreements.push(agreement);
          results.push(true);
          madeProgressThisPass = true;

          const deliberationMessage = createConsensusDeliberationMessage(
            participant,
            participantLlmId,
            phaseId,
            passIndex,
            agreement.action,
            agreement.deliberationText,
            agreement.response,
          );
          cHandler.messageAppend(deliberationMessage);
        } catch {
          results.push(false);
        }
      }

      if (didParticipantsReachConsensus(agreements, participantsForPass)) {
        const agreedResponse = agreements[0]?.response ?? null;
        if (agreedResponse)
          appendConsensusResult(cHandler, agreedResponse, participantsForPass, phaseId, passIndex);
        return results.length >= participantsForPass.length && agreements.length === participantsForPass.length && results.every(Boolean);
      }

      if (!madeProgressThisPass)
        break;
    }

    return false;
  } finally {
    cHandler.clearAbortController('chat-persona-consensus');
  }
}

async function runParticipantSequence(
  cHandler: ConversationHandler,
  conversationId: DConversationId,
  participantsInOrder: DConversationParticipant[],
  allAssistantParticipants: DConversationParticipant[],
  defaultChatLlmId: DLLMId,
  turnTerminationMode: DConversationTurnTerminationMode,
  latestUserMessageId: string | null,
): Promise<boolean> {
  if (!participantsInOrder.length)
    return false;

  const sharedAbortController = new AbortController();
  cHandler.setAbortController(sharedAbortController, 'chat-persona-multi');

  try {
    const results: boolean[] = [];
    const participantCount = participantsInOrder.length;
    let continuousTurnCount = 0;
    let pendingMentionedParticipantIds: string[] = [];
    let allowRoundRobinMentionContinuation = false;

    while (!sharedAbortController.signal.aborted) {
      const historyForTurn = cHandler.historyViewHeadOrThrow(`chat-persona-multi-${continuousTurnCount}`) as Readonly<DMessage[]>;
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

        const sourceHistory = cHandler.historyViewHeadOrThrow(`chat-persona-multi-${participant.id}-${continuousTurnCount}`) as Readonly<DMessage[]>;
        const participantHistory = preparePersonaHistory(sourceHistory, participantLlmId, participantPersonaId, participantsInOrder, participant);
        const result = await runPersonaOnConversationHead(participantLlmId, conversationId, participantPersonaId, true, sharedAbortController, participant, participantHistory);
        results.push(result.success);
        madeProgressThisPass = madeProgressThisPass || result.success;

        if (sharedAbortController.signal.aborted)
          break;

        const updatedHistory = cHandler.historyViewHeadOrThrow(`chat-persona-multi-after-${participant.id}-${continuousTurnCount}`) as Readonly<DMessage[]>;
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
        const trailingParticipantIds = new Set(trailingParticipants.map(trailingParticipant => trailingParticipant.id));
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
    cHandler.clearAbortController('chat-persona-multi');
  }
}

export async function _handleExecute(chatExecuteMode: ChatExecuteMode, conversationId: DConversationId, executeCallerNameDebug: string) {

  const participants = getConversationParticipants(conversationId);
  const assistantParticipants = participants.filter(participant => participant.kind === 'assistant' && !!participant.personaId);
  const primaryParticipant = assistantParticipants[0] ?? null;
  const chatLLMId = primaryParticipant?.llmId ?? getChatLLMId();
  const systemPurposeId = primaryParticipant?.personaId ?? null;
  const turnTerminationMode = getConversationTurnTerminationMode(conversationId);

  // Handle missing conversation
  if (!conversationId)
    return 'err-no-conversation';

  const cHandler = ConversationsManager.getHandler(conversationId);
  const initialHistory = cHandler.historyViewHeadOrThrow('handle-execute-' + executeCallerNameDebug) as Readonly<DMessage[]>;

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
  if (lastMessage.role === 'user') {
    const cmdRC = await _handleExecuteCommand(lastMessage.id, firstFragment, lastMessage, cHandler, chatLLMId);
    if (cmdRC !== RET_NO_CMD) return cmdRC;
  }

  // get the system purpose (note: we don't react to it, or it would invalidate half UI components..)
  // TODO: change this massively
  if (!systemPurposeId) {
    cHandler.messageAppendAssistantText('Issue: no Persona selected.', 'issue');
    return 'err-no-persona';
  }

  // synchronous long-duration tasks, which update the state as they go
  switch (chatExecuteMode) {
    case 'generate-content': {
      const latestUserMessage = [...initialHistory].reverse().find(message => message.role === 'user') ?? null;
      if (hasStopToken(latestUserMessage)) {
        cHandler.clearAbortController('chat-persona-stop-token');
        return true;
      }
      const runnableParticipants = getRunnableParticipants(assistantParticipants, latestUserMessage);
      const directlyMentionedParticipants = getMentionedParticipants(latestUserMessage, assistantParticipants);
      const participantsForTurn = mergeParticipantsInRosterOrder(assistantParticipants, runnableParticipants, directlyMentionedParticipants);

      if (!participantsForTurn.length) {
        cHandler.messageAppendAssistantText('No agent was triggered for this turn. Mention an agent with @alias, or set it to speak every turn.', 'issue');
        return false;
      }

      if (participantsForTurn.length > 1 || turnTerminationMode === 'continuous' || turnTerminationMode === 'consensus')
        return turnTerminationMode === 'consensus'
          ? await runConsensusSequence(cHandler, conversationId, participantsForTurn, chatLLMId, latestUserMessage?.id ?? null)
          : await runParticipantSequence(cHandler, conversationId, participantsForTurn, assistantParticipants, chatLLMId, turnTerminationMode, latestUserMessage?.id ?? null);

      const soleParticipant = participantsForTurn[0] ?? primaryParticipant;
      const soleParticipantPersonaId = soleParticipant?.personaId ?? systemPurposeId;
      const soleParticipantLlmId = soleParticipant?.llmId ?? chatLLMId;
      if (!soleParticipant || !soleParticipantPersonaId || !soleParticipantLlmId)
        return 'err-no-persona';

      const participantHistory = preparePersonaHistory(initialHistory, soleParticipantLlmId, soleParticipantPersonaId, participantsForTurn, soleParticipant);
      return (await runPersonaOnConversationHead(soleParticipantLlmId, conversationId, soleParticipantPersonaId, false, undefined, soleParticipant, participantHistory)).success;
    }

    case 'beam-content':
      const updatedInputHistory = cHandler.historyViewHeadOrThrow('chat-beam-execute');
      cHandler.beamInvoke(updatedInputHistory, [], null);
      return true;

    case 'append-user':
      return true;

    case 'generate-image':
      // verify we were called with a single DMessageTextContent
      if (!isTextContentFragment(firstFragment))
        return false;
      const imagePrompt = firstFragment.part.text;
      cHandler.messageFragmentReplace(lastMessage.id, firstFragment.fId, createTextContentFragment(textToDrawCommand(imagePrompt)), true);

      // use additional image fragments as image inputs
      const imageInputFragments = lastMessage.fragments.slice(1)
        .filter(fragment => isContentOrAttachmentFragment(fragment) && (
          isZyncAssetImageReferencePart(fragment.part) || isImageRefPart(fragment.part)
        ));

      return await runImageGenerationUpdatingState(cHandler, imagePrompt, imageInputFragments);

    case 'react-content':
      // verify we were called with a single DMessageTextContent
      if (!isTextContentFragment(firstFragment))
        return false;
      const reactPrompt = firstFragment.part.text;
      cHandler.messageFragmentReplace(lastMessage.id, firstFragment.fId, createTextContentFragment(`/react ${reactPrompt}`), true);
      return await runReActUpdatingState(cHandler, reactPrompt, chatLLMId, lastMessage.id);

    default:
      console.log('Chat execute: issue running', chatExecuteMode, conversationId, lastMessage);
      return false;
  }
}
