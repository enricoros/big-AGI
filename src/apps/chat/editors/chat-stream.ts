import { DLLMId } from '~/modules/llms/llm.types';
import { SystemPurposeId } from '../../../data';
import { autoTitle } from '~/modules/aifn/autotitle/autoTitle';
import { speakText } from '~/modules/elevenlabs/elevenlabs.client';
import { streamChat } from '~/modules/llms/llm.client';
import { useElevenlabsStore } from '~/modules/elevenlabs/store-elevenlabs';

import { DMessage, useChatStore } from '~/common/state/store-chats';

import { createAssistantTypingMessage, updatePurposeInHistory } from './editors';


/**
 * The main "chat" function. TODO: this is here so we can soon move it to the data model.
 */
export async function runAssistantUpdatingState(conversationId: string, history: DMessage[], assistantLlmId: DLLMId, systemPurpose: SystemPurposeId, _autoTitle: boolean, _autoSuggestions: boolean) {

  // update the system message from the active Purpose, if not manually edited
  history = updatePurposeInHistory(conversationId, history, systemPurpose);

  // create a blank and 'typing' message for the assistant
  const assistantMessageId = createAssistantTypingMessage(conversationId, assistantLlmId, history[0].purposeId, '...');

  // when an abort controller is set, the UI switches to the "stop" mode
  const controller = new AbortController();
  const { startTyping, editMessage } = useChatStore.getState();
  startTyping(conversationId, controller);

  // stream the assistant's messages
  await streamAssistantMessage(assistantLlmId, history, controller.signal, (updatedMessage) =>
    editMessage(conversationId, assistantMessageId, updatedMessage, false));

  // clear to send, again
  startTyping(conversationId, null);

  // update text, if needed
  if (_autoTitle)
    await autoTitle(conversationId);
}


async function streamAssistantMessage(
  llmId: DLLMId, history: DMessage[],
  abortSignal: AbortSignal,
  editMessage: (updatedMessage: Partial<DMessage>) => void,
) {

  // 📢 TTS: speak the first line, if configured
  const speakFirstLine = useElevenlabsStore.getState().elevenLabsAutoSpeak === 'firstLine';
  let firstLineSpoken = false;

  try {
    const messages = history.map(({ role, text }) => ({ role, content: text }));
    await streamChat(llmId, messages, abortSignal, (updatedMessage: Partial<DMessage>) => {
      // update the message in the store (and thus schedule a re-render)
      editMessage(updatedMessage);

      // 📢 TTS
      if (updatedMessage?.text && speakFirstLine && !firstLineSpoken) {
        let cutPoint = updatedMessage.text.lastIndexOf('\n');
        if (cutPoint < 0)
          cutPoint = updatedMessage.text.lastIndexOf('. ');
        if (cutPoint > 100 && cutPoint < 400) {
          firstLineSpoken = true;
          const firstParagraph = updatedMessage.text.substring(0, cutPoint);
          speakText(firstParagraph).then(() => false /* fire and forget, we don't want to stall this loop */);
        }
      }
    });
  } catch (error: any) {
    if (error?.name !== 'AbortError') {
      console.error('Fetch request error:', error);
      // TODO: show an error to the UI?
    }
  }

  // finally, stop the typing animation
  editMessage({ typing: false });
}