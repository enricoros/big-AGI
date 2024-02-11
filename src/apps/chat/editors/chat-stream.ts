import { DLLMId } from '~/modules/llms/store-llms';
import { SystemPurposeId } from '../../../data';
import { autoSuggestions } from '~/modules/aifn/autosuggestions/autoSuggestions';
import { conversationAutoTitle } from '~/modules/aifn/autotitle/autoTitle';
import { llmStreamingChatGenerate } from '~/modules/llms/llm.client';
import { speakText } from '~/modules/elevenlabs/elevenlabs.client';

import { DMessage, useChatStore } from '~/common/state/store-chats';

import { ChatAutoSpeakType, getChatAutoAI } from '../store-app-chat';
import { createAssistantTypingMessage, updatePurposeInHistory } from './editors';


/**
 * The main "chat" function. TODO: this is here so we can soon move it to the data model.
 */
export async function runAssistantUpdatingState(conversationId: string, history: DMessage[], assistantLlmId: DLLMId, systemPurpose: SystemPurposeId, parallelViewCount: number) {

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
    assistantLlmId,
    history,
    parallelViewCount,
    autoSpeak,
    (updatedMessage) => editMessage(conversationId, assistantMessageId, updatedMessage, false),
    controller.signal,
  );

  // clear to send, again
  startTyping(conversationId, null);

  if (autoTitleChat) {
    // fire/forget, this will only set the title if it's not already set
    void conversationAutoTitle(conversationId, false);
  }

  if (autoSuggestDiagrams || autoSuggestQuestions)
    autoSuggestions(conversationId, assistantMessageId, autoSuggestDiagrams, autoSuggestQuestions);
}


async function streamAssistantMessage(
  llmId: DLLMId,
  history: DMessage[],
  throttleUnits: number, // 0: disable, 1: default throttle (12Hz), 2+ reduce the message frequency with the square root
  autoSpeak: ChatAutoSpeakType,
  editMessage: (updatedMessage: Partial<DMessage>) => void,
  abortSignal: AbortSignal,
) {

  // speak once
  let spokenLine = false;

  const messages = history.map(({ role, text }) => ({ role, content: text }));

  const incrementalAnswer: Partial<DMessage> = { text: '' };

  // Throttling setup
  let lastCallTime = 0;
  let throttleDelay = 1000 / 12; // 12 messages per second works well for 60Hz displays (single chat, and 24 in 4 chats, see the square root below)
  if (throttleUnits > 1)
    throttleDelay = Math.round(throttleDelay * Math.sqrt(throttleUnits));

  function throttledEditMessage(updatedMessage: Partial<DMessage>) {
    const now = Date.now();
    if (throttleUnits === 0 || now - lastCallTime >= throttleDelay) {
      editMessage(updatedMessage);
      lastCallTime = now;
    }
  }

  try {
    await llmStreamingChatGenerate(llmId, messages, null, null, abortSignal,
      ({ originLLM, textSoFar, typing }) => {

        // grow the incremental message
        if (originLLM) incrementalAnswer.originLLM = originLLM;
        if (textSoFar) incrementalAnswer.text = textSoFar;
        if (typing !== undefined) incrementalAnswer.typing = typing;

        // Update the data store, with optional max-frequency throttling (e.g. OpenAI is downsamped 50 -> 12Hz)
        // This can be toggled from the settings
        throttledEditMessage(incrementalAnswer);

        // 📢 TTS: first-line
        if (textSoFar && autoSpeak === 'firstLine' && !spokenLine) {
          let cutPoint = textSoFar.lastIndexOf('\n');
          if (cutPoint < 0)
            cutPoint = textSoFar.lastIndexOf('. ');
          if (cutPoint > 100 && cutPoint < 400) {
            spokenLine = true;
            const firstParagraph = textSoFar.substring(0, cutPoint);
            // fire/forget: we don't want to stall this loop
            void speakText(firstParagraph);
          }
        }
      },
    );
  } catch (error: any) {
    if (error?.name !== 'AbortError') {
      console.error('Fetch request error:', error);
      const errorText = ` [Issue: ${error.message || (typeof error === 'string' ? error : 'Chat stopped.')}]`;
      incrementalAnswer.text = (incrementalAnswer.text || '') + errorText;
    }
  }

  // Optimized:
  // 1 - stop the typing animation
  // 2 - ensure the last content is flushed out
  editMessage({ ...incrementalAnswer, typing: false });

  // 📢 TTS: all
  if ((autoSpeak === 'all' || autoSpeak === 'firstLine') && incrementalAnswer.text && !spokenLine && !abortSignal.aborted)
    void speakText(incrementalAnswer.text);
}