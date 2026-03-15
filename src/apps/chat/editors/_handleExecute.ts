import type { DLLMId } from '~/common/stores/llms/llms.types';
import { getChatLLMId } from '~/common/stores/llms/store-llms';

import type { SystemPurposeId } from '../../../data';

import type { DConversationId, DConversationParticipant } from '~/common/stores/chat/chat.conversation';
import { createDMessageTextContent } from '~/common/stores/chat/chat.message';
import type { DMessage } from '~/common/stores/chat/chat.message';
import { ConversationHandler } from '~/common/chat-overlay/ConversationHandler';
import { ConversationsManager } from '~/common/chat-overlay/ConversationsManager';
import { createTextContentFragment, isContentOrAttachmentFragment, isImageRefPart, isTextContentFragment, isZyncAssetImageReferencePart } from '~/common/stores/chat/chat.fragments';
import { getConversationParticipants } from '~/common/stores/chat/store-chats';

import type { ChatExecuteMode } from '../execute-mode/execute-mode.types';
import { textToDrawCommand } from '../commands/CommandsDraw';

import { _handleExecuteCommand, RET_NO_CMD } from './_handleExecuteCommand';
import { runImageGenerationUpdatingState } from './image-generate';
import { runPersonaOnConversationHead } from './chat-persona';
import { runReActUpdatingState } from './react-tangent';


function wasParticipantMentioned(message: DMessage | null, participant: DConversationParticipant): boolean {
  const participantName = participant.name?.trim();
  if (!message || message.role !== 'user' || !participantName)
    return false;

  const escapedName = participantName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const mentionRegex = new RegExp(`(^|[^\\w])@${escapedName}(?=$|[^\\w])`, 'i');
  return message.fragments.some(fragment => isTextContentFragment(fragment) && mentionRegex.test(fragment.part.text));
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

function preparePersonaHistory(sourceHistory: Readonly<DMessage[]>, assistantLlmId: DLLMId, purposeId: SystemPurposeId, participants: DConversationParticipant[], activeParticipant: DConversationParticipant): DMessage[] {
  const participantHistory = [...sourceHistory];
  participantHistory.unshift(buildMultiAgentCoordinationMessage(participants, activeParticipant));
  ConversationHandler.inlineUpdatePurposeInHistory(participantHistory, assistantLlmId, purposeId, activeParticipant.customPrompt);
  ConversationHandler.inlineUpdateAutoPromptCaching(participantHistory);
  return participantHistory;
}

export async function _handleExecute(chatExecuteMode: ChatExecuteMode, conversationId: DConversationId, executeCallerNameDebug: string) {

  const participants = getConversationParticipants(conversationId);
  const assistantParticipants = participants.filter(participant => participant.kind === 'assistant' && !!participant.personaId);
  const primaryParticipant = assistantParticipants[0] ?? null;
  const chatLLMId = primaryParticipant?.llmId ?? getChatLLMId();
  const systemPurposeId = primaryParticipant?.personaId ?? null;

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
      const runnableParticipants = assistantParticipants.filter(participant => {
        if (!participant.personaId)
          return false;
        return participant.speakWhen !== 'when-mentioned' || wasParticipantMentioned(latestUserMessage, participant);
      });

      if (!runnableParticipants.length) {
        cHandler.messageAppendAssistantText('No agent was triggered for this turn. Mention an agent with @alias, or set it to speak every turn.', 'issue');
        return false;
      }

      if (runnableParticipants.length > 1) {
        const sharedAbortController = new AbortController();
        cHandler.setAbortController(sharedAbortController, 'chat-persona-multi');
        try {
          const results = [] as boolean[];

          for (const participant of runnableParticipants) {
            const participantPersonaId = participant.personaId;
            const participantLlmId = participant.llmId ?? chatLLMId;
            if (!participantPersonaId || !participantLlmId)
              continue;

            const sourceHistory = cHandler.historyViewHeadOrThrow(`chat-persona-multi-${participant.id}`) as Readonly<DMessage[]>;
            const participantHistory = preparePersonaHistory(sourceHistory, participantLlmId, participantPersonaId, runnableParticipants, participant);
            results.push(await runPersonaOnConversationHead(participantLlmId, conversationId, participantPersonaId, true, sharedAbortController, participant, participantHistory));
          }
          return results.some(Boolean);
        } finally {
          cHandler.clearAbortController('chat-persona-multi');
        }
      }

      const soleParticipant = runnableParticipants[0] ?? primaryParticipant;
      const soleParticipantPersonaId = soleParticipant?.personaId ?? systemPurposeId;
      const soleParticipantLlmId = soleParticipant?.llmId ?? chatLLMId;
      if (!soleParticipant || !soleParticipantPersonaId || !soleParticipantLlmId)
        return 'err-no-persona';

      const participantHistory = preparePersonaHistory(initialHistory, soleParticipantLlmId, soleParticipantPersonaId, runnableParticipants, soleParticipant);
      return await runPersonaOnConversationHead(soleParticipantLlmId, conversationId, soleParticipantPersonaId, false, undefined, soleParticipant, participantHistory);
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
