import { aixChatGenerateContent_DMessage_FromConversation, AixChatGenerateContent_DMessageGuts } from '~/modules/aix/client/aix.client';
import { autoChatFollowUps } from '~/modules/aifn/auto-chat-follow-ups/autoChatFollowUps';
import { autoConversationTitle } from '~/modules/aifn/autotitle/autoTitle';

import { DConversationId, DConversationParticipant, splitSystemMessageFromHistory } from '~/common/stores/chat/chat.conversation';
import type { SystemPurposeId } from '../../../data';
import type { DLLMId } from '~/common/stores/llms/llms.types';
import { isTextContentFragment } from '~/common/stores/chat/chat.fragments';
import { AudioGenerator } from '~/common/util/audio/AudioGenerator';
import { ConversationsManager } from '~/common/chat-overlay/ConversationsManager';
import type { DMessage } from '~/common/stores/chat/chat.message';
import { MESSAGE_FLAG_NOTIFY_COMPLETE, messageWasInterruptedAtStart } from '~/common/stores/chat/chat.message';
import { getLabsHighPerformance } from '~/common/stores/store-ux-labs';

import { PersonaChatMessageSpeak } from './persona/PersonaChatMessageSpeak';
import { getChatAutoAI, getChatThinkingPolicy, getIsNotificationEnabledForModel } from '../store-app-chat';
import { getInstantAppChatPanesCount } from '../components/panes/store-panes-manager';


// configuration
export const CHATGENERATE_RESPONSE_PLACEHOLDER = '...'; // 💫 ..., 🖊️ ...


export interface PersonaProcessorInterface {
  handleMessage(accumulatedMessage: AixChatGenerateContent_DMessageGuts, messageComplete: boolean): void;
}


export interface PersonaRunResult {
  success: boolean;
  finalMessage: AixChatGenerateContent_DMessageGuts;
}

/**
 * The main "chat" function.
 * @returns `true` if the operation was successful, `false` otherwise.
 */
export async function runPersonaOnConversationHead(
  assistantLlmId: DLLMId,
  conversationId: DConversationId,
  systemPurposeId: SystemPurposeId,
  keepAbortController: boolean = false,
  sharedAbortController?: AbortController,
  participant?: DConversationParticipant,
  sourceHistory?: Readonly<DMessage[]>,
  createPlaceholder: boolean = true,
): Promise<PersonaRunResult> {

  const cHandler = ConversationsManager.getHandler(conversationId);

  const _history = sourceHistory ?? cHandler.historyViewHeadOrThrow('runPersonaOnConversationHead') as Readonly<DMessage[]>;
  if (_history.length === 0)
    return {
      success: false,
      finalMessage: {
        fragments: [],
        generator: { mgt: 'named', name: assistantLlmId },
        pendingIncomplete: false,
      },
    };

  // split pre dynamic-personas
  let { chatSystemInstruction, chatHistory } = splitSystemMessageFromHistory(_history);

  // assistant response placeholder
  const isNotifyEnabled = getIsNotificationEnabledForModel(assistantLlmId);
  const { assistantMessageId } = createPlaceholder
    ? cHandler.messageAppendAssistantPlaceholder(
      CHATGENERATE_RESPONSE_PLACEHOLDER,
      {
        purposeId: systemPurposeId,
        generator: { mgt: 'named', name: assistantLlmId },
        metadata: {
          author: {
            participantId: participant?.id || `${systemPurposeId}::${assistantLlmId}`,
            participantName: participant?.name || systemPurposeId,
            personaId: participant?.personaId ?? systemPurposeId,
            llmId: participant?.llmId ?? assistantLlmId,
          },
        },
        ...(isNotifyEnabled ? { userFlags: [MESSAGE_FLAG_NOTIFY_COMPLETE] } : {}),
      },
    )
    : { assistantMessageId: null as string | null };

  const parallelViewCount = getLabsHighPerformance() ? 0 : getInstantAppChatPanesCount();

  // ai follow-up operations (fire/forget)
  const { autoSpeak, autoSuggestDiagrams, autoSuggestHTMLUI, autoSuggestQuestions, autoTitleChat } = getChatAutoAI();

  // AutoSpeak
  const autoSpeaker: PersonaProcessorInterface | null = autoSpeak !== 'off' ? new PersonaChatMessageSpeak(autoSpeak) : null;

  // when an abort controller is set, the UI switches to the "stop" mode
  const abortController = sharedAbortController ?? new AbortController();
  if (!keepAbortController)
    cHandler.setAbortController(abortController, 'chat-persona');

  // stream the assistant's messages directly to the state store
  const messageStatus = await aixChatGenerateContent_DMessage_FromConversation(
    assistantLlmId,
    chatSystemInstruction,
    chatHistory,
    'conversation',
    conversationId,
    { abortSignal: abortController.signal, throttleParallelThreads: parallelViewCount },
    (messageOverwrite: AixChatGenerateContent_DMessageGuts, messageComplete: boolean) => {

      // Note: there was an abort check here, but it removed the last packet, which contained the cause and final text.
      // if (abortController.signal.aborted)
      //   console.warn('runPersonaOnConversationHead: Aborted', { conversationId, assistantLlmId, messageOverwrite });

      // deep copy the object to avoid partial updates
      let deepCopy = structuredClone(messageOverwrite);

      const firstTextFragment = deepCopy.fragments?.find(isTextContentFragment);
      if (participant?.name && firstTextFragment?.part.text.startsWith('[')) {
        const escapedName = participant.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const visibleSpeakerPrefix = new RegExp(`^\\[${escapedName}(?:\\s·[^\\]]+)?\\]\\s*\\n?`, 'i');
        firstTextFragment.part.text = firstTextFragment.part.text.replace(visibleSpeakerPrefix, '');
      }

      // [Cosmetic Logic] if the content hasn't come yet, don't replace the fragments to still show the placeholder
      if (!messageComplete && deepCopy.pendingIncomplete && deepCopy.fragments?.length === 0)
        delete (deepCopy as any).fragments;

      // update the message
      if (assistantMessageId)
        cHandler.messageEdit(assistantMessageId, deepCopy, messageComplete, false);

      // if requested, speak the message
      autoSpeaker?.handleMessage(messageOverwrite, messageComplete);

      // if (messageComplete)
      //   AudioGenerator.basicAstralChimes({ volume: 0.4 }, 0, 2, 250);
    },
  );

  // final message update (needed only in case of error)
  const lastDeepCopy = structuredClone(messageStatus.lastDMessage);
  if (messageStatus.outcome === 'errored' && assistantMessageId)
    cHandler.messageEdit(assistantMessageId, lastDeepCopy, true, false);

  // special case: if the last message was aborted and had no content, delete it
  if (messageWasInterruptedAtStart(lastDeepCopy)) {
    if (assistantMessageId)
      cHandler.messagesDelete([assistantMessageId]);
    // NOTE: ok to exit here, as the abort was already done
    return {
      success: false,
      finalMessage: lastDeepCopy,
    };
  }

  // notify when complete, if set
  if (assistantMessageId && cHandler.messageHasUserFlag(assistantMessageId, MESSAGE_FLAG_NOTIFY_COMPLETE)) {
    cHandler.messageSetUserFlag(assistantMessageId, MESSAGE_FLAG_NOTIFY_COMPLETE, false, false);
    AudioGenerator.chatNotifyResponse();
  }

  // check if aborted
  const hasBeenAborted = abortController.signal.aborted;

  // clear to send, again
  // FIXME: race condition? (for sure!)
  if (!keepAbortController)
    cHandler.clearAbortController('chat-persona');

  if (autoTitleChat) {
    // fire/forget, this will only set the title if it's not already set
    void autoConversationTitle(conversationId, false);
  }

  if (!hasBeenAborted && assistantMessageId && (autoSuggestDiagrams || autoSuggestHTMLUI || autoSuggestQuestions))
    void autoChatFollowUps(conversationId, assistantMessageId, autoSuggestDiagrams, autoSuggestHTMLUI, autoSuggestQuestions);

  const chatThinkingPolicy = getChatThinkingPolicy();
  if (chatThinkingPolicy === 'last-only')
    cHandler.historyStripThinking(1);
  else if (chatThinkingPolicy === 'discard-all')
    cHandler.historyStripThinking(0);

  // return true if this succeeded
  return {
    success: messageStatus.outcome === 'success',
    finalMessage: lastDeepCopy,
  };
}
