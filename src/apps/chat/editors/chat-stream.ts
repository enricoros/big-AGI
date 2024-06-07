import type { DLLMId } from '~/modules/llms/store-llms';
import type { StreamingClientUpdate } from '~/modules/llms/vendors/unifiedStreamingClient';
import { autoSuggestions } from '~/modules/aifn/autosuggestions/autoSuggestions';
import { conversationAutoTitle } from '~/modules/aifn/autotitle/autoTitle';
import { llmStreamingChatGenerate, VChatContextRef, VChatMessageIn, VChatStreamContextName } from '~/modules/llms/llm.client';
import { speakText } from '~/modules/elevenlabs/elevenlabs.client';

import type { DMessage } from '~/common/state/store-chats';
import { ConversationsManager } from '~/common/chats/ConversationsManager';

import { ChatAutoSpeakType, getChatAutoAI } from '../store-app-chat';


export const STREAM_TEXT_INDICATOR = '...';


/**
 * The main "chat" function. TODO: this is here so we can soon move it to the data model.
 */
export async function runAssistantUpdatingState(conversationId: string, history: DMessage[], assistantLlmId: DLLMId, parallelViewCount: number) {
  const cHandler = ConversationsManager.getHandler(conversationId);

  // ai follow-up operations (fire/forget)
  const { autoSpeak, autoSuggestDiagrams, autoSuggestQuestions, autoTitleChat } = getChatAutoAI();

  // create a blank and 'typing' message for the assistant
  const assistantMessageId = cHandler.messageAppendAssistant(STREAM_TEXT_INDICATOR, history[0].purposeId, assistantLlmId, true);

  // when an abort controller is set, the UI switches to the "stop" mode
  const abortController = new AbortController();
  cHandler.setAbortController(abortController);

  // stream the assistant's messages
  const messageStatus = await streamAssistantMessage(
    assistantLlmId,
    history.map((m): VChatMessageIn => ({ role: m.role, content: m.text })),
    'conversation',
    conversationId,
    parallelViewCount,
    autoSpeak,
    (update) => cHandler.messageEdit(assistantMessageId, update, false),
    abortController.signal,
  );

  // clear to send, again
  // FIXME: race condition?
  cHandler.setAbortController(null);

  if (autoTitleChat) {
    // fire/forget, this will only set the title if it's not already set
    void conversationAutoTitle(conversationId, false);
  }

  if (autoSuggestDiagrams || autoSuggestQuestions)
    autoSuggestions(conversationId, assistantMessageId, autoSuggestDiagrams, autoSuggestQuestions);

  return messageStatus.outcome === 'success';
}

type StreamMessageOutcome = 'success' | 'aborted' | 'errored';
type StreamMessageStatus = { outcome: StreamMessageOutcome, errorMessage?: string };

export async function streamAssistantMessage(
  llmId: DLLMId,
  messagesHistory: VChatMessageIn[],
  contextName: VChatStreamContextName,
  contextRef: VChatContextRef,
  throttleUnits: number, // 0: disable, 1: default throttle (12Hz), 2+ reduce the message frequency with the square root
  autoSpeak: ChatAutoSpeakType,
  editMessage: (update: Partial<DMessage>) => void,
  abortSignal: AbortSignal,
): Promise<StreamMessageStatus> {

  const returnStatus: StreamMessageStatus = {
    outcome: 'success',
    errorMessage: undefined,
  };

  // speak once
  let spokenLine = false;

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

  const incrementalAnswer: Partial<DMessage> = { text: '' };

  try {
    await llmStreamingChatGenerate(llmId, messagesHistory, contextName, contextRef, null, null, abortSignal, (update: StreamingClientUpdate) => {
      const textSoFar = update.textSoFar;

      // grow the incremental message
      if (update.originLLM) incrementalAnswer.originLLM = update.originLLM;
      if (textSoFar) incrementalAnswer.text = textSoFar;
      if (update.typing !== undefined) incrementalAnswer.typing = update.typing;

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
    });
  } catch (error: any) {
    if (error?.name !== 'AbortError') {
      console.error('Fetch request error:', error);
      const errorText = ` [Issue: ${error.message || (typeof error === 'string' ? error : 'Chat stopped.')}]`;
      incrementalAnswer.text = (incrementalAnswer.text || '') + errorText;
      returnStatus.outcome = 'errored';
      returnStatus.errorMessage = error.message;
    } else
      returnStatus.outcome = 'aborted';
  }

  // Optimized:
  // 1 - stop the typing animation
  // 2 - ensure the last content is flushed out
  editMessage({ ...incrementalAnswer, typing: false });

  // 📢 TTS: all
  if ((autoSpeak === 'all' || autoSpeak === 'firstLine') && incrementalAnswer.text && !spokenLine && !abortSignal.aborted)
    void speakText(incrementalAnswer.text);

  return returnStatus;
}