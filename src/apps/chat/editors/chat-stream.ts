import { DLLMId } from '~/modules/llms/store-llms';
import { SystemPurposeId } from '../../../data';
import { autoSuggestions } from '~/modules/aifn/autosuggestions/autoSuggestions';
import { autoTitle } from '~/modules/aifn/autotitle/autoTitle';
import { speakText } from '~/modules/elevenlabs/elevenlabs.client';
import { streamChat } from '~/modules/llms/transports/streamChat';

import { DMessage, useChatStore } from '~/common/state/store-chats';

import { ChatAutoSpeakType, getChatAutoAI } from '../store-app-chat';
import { createAssistantTypingMessage, updatePurposeInHistory } from './editors';


/**
 * The main "chat" function. TODO: this is here so we can soon move it to the data model.
 */
export async function runAssistantUpdatingState(conversationId: string, history: DMessage[], assistantLlmId: DLLMId, systemPurpose: SystemPurposeId) {

  // ai follow-up operations (fire/forget)
  const { autoSpeak, autoSuggestDiagrams, autoSuggestQuestions, autoTitleChat } = getChatAutoAI();

  // update the system message from the active Purpose, if not manually edited
  history = updatePurposeInHistory(conversationId, history, assistantLlmId, systemPurpose);

  // create a blank and 'typing' message for the assistant
  const assistantMessageId = createAssistantTypingMessage(conversationId, assistantLlmId, history[0].purposeId, '...');

  // when an abort controller is set, the UI switches to the "stop" mode
  const controller = new AbortController();
  const { startTyping, editMessage } = useChatStore.getState();
  startTyping(conversationId, controller);

  // stream the assistant's messages
  await streamAssistantMessage(
    assistantLlmId, history,
    autoSpeak,
    (updatedMessage) => editMessage(conversationId, assistantMessageId, updatedMessage, false),
    controller.signal,
  );

  // clear to send, again
  startTyping(conversationId, null);

  if (autoTitleChat)
    autoTitle(conversationId);

  if (autoSuggestDiagrams || autoSuggestQuestions)
    autoSuggestions(conversationId, assistantMessageId, autoSuggestDiagrams, autoSuggestQuestions);
}


async function streamAssistantMessage(
  llmId: DLLMId, history: DMessage[],
  autoSpeak: ChatAutoSpeakType,
  editMessage: (updatedMessage: Partial<DMessage>) => void,
  abortSignal: AbortSignal,
) {

  // speak once
  let spokenText = '';
  let spokenLine = false;

  const messages = history.map(({ role, text }) => ({ role, content: text }));

  try {
    await streamChat(llmId, messages, abortSignal,
      (updatedMessage: Partial<DMessage>) => {
        // update the message in the store (and thus schedule a re-render)
        editMessage(updatedMessage);

        // 📢 TTS: first-line
        if (updatedMessage?.text) {
          spokenText = updatedMessage.text;
          if (autoSpeak === 'firstLine' && !spokenLine) {
            let cutPoint = spokenText.lastIndexOf('\n');
            if (cutPoint < 0)
              cutPoint = spokenText.lastIndexOf('. ');
            if (cutPoint > 100 && cutPoint < 400) {
              spokenLine = true;
              const firstParagraph = spokenText.substring(0, cutPoint);

              // fire/forget: we don't want to stall this loop
              void speakText(firstParagraph);
            }
          }
        }
      },
    );
  } catch (error: any) {
    if (error?.name !== 'AbortError') {
      console.error('Fetch request error:', error);
      // TODO: show an error to the UI?
    }
  }

  // 📢 TTS: all
  if ((autoSpeak === 'all' || autoSpeak === 'firstLine') && spokenText && !spokenLine && !abortSignal.aborted)
    void speakText(spokenText);

  // finally, stop the typing animation
  editMessage({ typing: false });
}