import { AixChatGenerateContent_DMessage, aixChatGenerateContent_DMessage_FromConversation } from '~/modules/aix/client/aix.client';
import { autoChatFollowUps } from '~/modules/aifn/auto-chat-follow-ups/autoChatFollowUps';
import { autoConversationTitle } from '~/modules/aifn/autotitle/autoTitle';

import { DConversationId, splitSystemMessageFromHistory } from '~/common/stores/chat/chat.conversation';
import type { DLLMId } from '~/common/stores/llms/llms.types';
import { AudioGenerator } from '~/common/util/audio/AudioGenerator';
import { ConversationsManager } from '~/common/chat-overlay/ConversationsManager';
import { DMessage, MESSAGE_FLAG_NOTIFY_COMPLETE, messageWasInterruptedAtStart } from '~/common/stores/chat/chat.message';
import { getUXLabsHighPerformance } from '~/common/state/store-ux-labs';

import { PersonaChatMessageSpeak } from './persona/PersonaChatMessageSpeak';
import { getChatAutoAI, getIsNotificationEnabledForModel } from '../store-app-chat';
import { getInstantAppChatPanesCount } from '../components/panes/usePanesManager';


// configuration
export const CHATGENERATE_RESPONSE_PLACEHOLDER = '...'; // 💫 ..., 🖊️ ...


export interface PersonaProcessorInterface {
  handleMessage(accumulatedMessage: AixChatGenerateContent_DMessage, messageComplete: boolean): void;
}


/**
 * The main "chat" function.
 * @returns `true` if the operation was successful, `false` otherwise.
 */
export async function runPersonaOnConversationHead(
  assistantLlmId: DLLMId,
  conversationId: DConversationId,
): Promise<boolean> {

  const cHandler = ConversationsManager.getHandler(conversationId);

  const _history = cHandler.historyViewHeadOrThrow('runPersonaOnConversationHead') as Readonly<DMessage[]>;
  if (_history.length === 0)
    return false;

  // split pre dynamic-personas
  let { chatSystemInstruction, chatHistory } = splitSystemMessageFromHistory(_history);

  // assistant response placeholder
  const isNotifyEnabled = getIsNotificationEnabledForModel(assistantLlmId);
  const { assistantMessageId } = cHandler.messageAppendAssistantPlaceholder(
    CHATGENERATE_RESPONSE_PLACEHOLDER,
    {
      purposeId: chatSystemInstruction?.purposeId,
      generator: { mgt: 'named', name: assistantLlmId },
      ...(isNotifyEnabled ? { userFlags: [MESSAGE_FLAG_NOTIFY_COMPLETE] } : {}),
    },
  );

  const parallelViewCount = getUXLabsHighPerformance() ? 0 : getInstantAppChatPanesCount();

  // ai follow-up operations (fire/forget)
  const { autoSpeak, autoSuggestDiagrams, autoSuggestHTMLUI, autoSuggestQuestions, autoTitleChat } = getChatAutoAI();

  // AutoSpeak
  const autoSpeaker: PersonaProcessorInterface | null = autoSpeak !== 'off' ? new PersonaChatMessageSpeak(autoSpeak) : null;

  // when an abort controller is set, the UI switches to the "stop" mode
  const abortController = new AbortController();
  cHandler.setAbortController(abortController, 'chat-persona');

  // stream the assistant's messages directly to the state store
  const messageStatus = await aixChatGenerateContent_DMessage_FromConversation(
    assistantLlmId,
    chatSystemInstruction,
    chatHistory,
    'conversation',
    conversationId,
    { abortSignal: abortController.signal, throttleParallelThreads: parallelViewCount },
    (messageOverwrite: AixChatGenerateContent_DMessage, messageComplete: boolean) => {

      // Note: there was an abort check here, but it removed the last packet, which contained the cause and final text.
      // if (abortController.signal.aborted)
      //   console.warn('runPersonaOnConversationHead: Aborted', { conversationId, assistantLlmId, messageOverwrite });

      // deep copy the object to avoid partial updates
      let deepCopy = structuredClone(messageOverwrite);

      // [Cosmetic Logic] if the content hasn't come yet, don't replace the fragments to still show the placeholder
      if (!messageComplete && deepCopy.pendingIncomplete && deepCopy.fragments?.length === 0)
        delete (deepCopy as any).fragments;

      // update the message
      cHandler.messageEdit(assistantMessageId, deepCopy, messageComplete, false);

      // if requested, speak the message
      autoSpeaker?.handleMessage(messageOverwrite, messageComplete);

      // if (messageComplete)
      //   AudioGenerator.basicAstralChimes({ volume: 0.4 }, 0, 2, 250);
    },
  );

  // final message update (needed only in case of error)
  const lastDeepCopy = structuredClone(messageStatus.lastDMessage);
  if (messageStatus.outcome === 'errored')
    cHandler.messageEdit(assistantMessageId, lastDeepCopy, true, false);

  // special case: if the last message was aborted and had no content, delete it
  if (messageWasInterruptedAtStart(lastDeepCopy)) {
    cHandler.messagesDelete([assistantMessageId]);
    // NOTE: ok to exit here, as the abort was already done
    return false;
  }

  // notify when complete, if set
  if (cHandler.messageHasUserFlag(assistantMessageId, MESSAGE_FLAG_NOTIFY_COMPLETE)) {
    cHandler.messageSetUserFlag(assistantMessageId, MESSAGE_FLAG_NOTIFY_COMPLETE, false, false);
    AudioGenerator.chatNotifyResponse();
  }

  // check if aborted
  const hasBeenAborted = abortController.signal.aborted;

  // clear to send, again
  // FIXME: race condition? (for sure!)
  cHandler.clearAbortController('chat-persona');

  if (autoTitleChat) {
    // fire/forget, this will only set the title if it's not already set
    void autoConversationTitle(conversationId, false);
  }

  if (!hasBeenAborted && (autoSuggestDiagrams || autoSuggestHTMLUI || autoSuggestQuestions))
    void autoChatFollowUps(conversationId, assistantMessageId, autoSuggestDiagrams, autoSuggestHTMLUI, autoSuggestQuestions);

  // return true if this succeeded
  return messageStatus.outcome === 'success';
}
