import type { DLLMId } from '~/modules/llms/store-llms';
import { VChatContextRef, VChatMessageIn, VChatStreamContextName } from '~/modules/llms/llm.client';

import { ConversationsManager } from '~/common/chats/ConversationsManager';
import { DMessage, messageSingleTextOrThrow } from '~/common/stores/chat/chat.message';
import { getUXLabsHighPerformance } from '~/common/state/store-ux-labs';
import { getInstantAppChatPanesCount } from '../components/panes/usePanesManager';


/**
 * The main "chat" function.
 */
export async function runPersonaUpdatingState(
  conversationId: string,
  assistantLlmId: DLLMId,
) {

  const cHandler = ConversationsManager.getHandler(conversationId);
  const history = cHandler.historyView('runPersonaUpdatingState') as Readonly<DMessage[]>;

  const parallelViewCount = getUXLabsHighPerformance() ? 0 : getInstantAppChatPanesCount();

  // ai follow-up operations (fire/forget)
  // const { autoSpeak, autoSuggestDiagrams, autoSuggestHTMLUI, autoSuggestQuestions, autoTitleChat } = getChatAutoAI();

  // assistant placeholder
  const { assistantMessageId } = cHandler.messageAppendAssistantPlaceholder(
    '...',
    { originLLM: assistantLlmId, purposeId: history[0].purposeId },
  );

  // when an abort controller is set, the UI switches to the "stop" mode
  const abortController = new AbortController();
  cHandler.setAbortController(abortController);

  // stream the assistant's messages directly to the state store
  const overwriteMessageParts = (incrementalMessage: Partial<StreamMessageUpdate>, messageComplete: boolean) => {
    cHandler.messageEdit(assistantMessageId, incrementalMessage, messageComplete, false);
  };
  let instructions: VChatMessageIn[];
  try {
    instructions = history.map((m): VChatMessageIn => ({ role: m.role, content: messageSingleTextOrThrow(m) /* BIG FIXME */ }));
  } catch (error) {
    console.error('runAssistantUpdatingState: error:', error, history);
    throw error;
  }
  const messageStatus = await streamPersonaMessage(
    assistantLlmId,
    instructions,
    'conversation',
    conversationId,
    parallelViewCount,
    // autoSpeak,
    overwriteMessageParts,
    abortController.signal,
  );

  // clear to send, again
  // FIXME: race condition? (for sure!)
  cHandler.setAbortController(null);

  // fire/forget, this will only set the title if it's not already set
  // if (autoTitleChat) {
  // void autoConversationTitle(conversationId, false);
  // }

  // if (autoSuggestDiagrams || autoSuggestHTMLUI || autoSuggestQuestions)
  //   autoSuggestions(conversationId, assistantMessageId, autoSuggestDiagrams, autoSuggestHTMLUI, autoSuggestQuestions);

  return messageStatus.outcome === 'success';
}


type StreamMessageOutcome = 'success' | 'aborted' | 'errored';
type StreamMessageStatus = { outcome: StreamMessageOutcome, errorMessage?: string };
type StreamMessageUpdate = Pick<DMessage, 'fragments' | 'originLLM' | 'pendingIncomplete'>;

export async function streamPersonaMessage(
  llmId: DLLMId,
  messagesHistory: VChatMessageIn[],
  contextName: VChatStreamContextName,
  contextRef: VChatContextRef,
  throttleUnits: number, // 0: disable, 1: default throttle (12Hz), 2+ reduce the message frequency with the square root
  onMessageUpdated: (incrementalMessage: Partial<StreamMessageUpdate>, messageComplete: boolean) => void,
  abortSignal: AbortSignal,
): Promise<StreamMessageStatus> {

  const returnStatus: StreamMessageStatus = {
    outcome: 'success',
    errorMessage: undefined,
  };

  // speak once
  // let spokenLine = false;

  // Throttling setup
  let lastCallTime = 0;
  let throttleDelay = 1000 / 12; // 12 messages per second works well for 60Hz displays (single chat, and 24 in 4 chats, see the square root below)
  if (throttleUnits > 1)
    throttleDelay = Math.round(throttleDelay * Math.sqrt(throttleUnits));

  function throttledEditMessage(updatedMessage: Partial<StreamMessageUpdate>) {
    const now = Date.now();
    if (throttleUnits === 0 || now - lastCallTime >= throttleDelay) {
      onMessageUpdated(updatedMessage, false);
      lastCallTime = now;
    }
  }

  // TODO: should clean this up once we have multi-fragment streaming/recombination
  const incrementalAnswer: StreamMessageUpdate = {
    fragments: [],
  };

  console.log('PERSONA HERE');

  // try {
  //   await llmStreamingChatGenerate(llmId, messagesHistory, contextName, contextRef, null, null, abortSignal, (update: StreamingClientUpdate) => {
  //     const textSoFar = update.textSoFar;
  //
  //     // grow the incremental message
  //     if (textSoFar) incrementalAnswer.fragments = messageFragmentsReplaceLastContentText(incrementalAnswer.fragments, textSoFar);
  //     if (update.originLLM) incrementalAnswer.originLLM = update.originLLM;
  //     if (update.typing !== undefined)
  //       incrementalAnswer.pendingIncomplete = update.typing ? true : undefined;
  //
  //     // Update the data store, with optional max-frequency throttling (e.g. OpenAI is downsamped 50 -> 12Hz)
  //     // This can be toggled from the settings
  //     throttledEditMessage(incrementalAnswer);
  //
  //     // 📢 TTS: first-line
  //     // if (textSoFar && autoSpeak === 'firstLine' && !spokenLine) {
  //     //   let cutPoint = textSoFar.lastIndexOf('\n');
  //     //   if (cutPoint < 0)
  //     //     cutPoint = textSoFar.lastIndexOf('. ');
  //     //   if (cutPoint > 100 && cutPoint < 400) {
  //     //     spokenLine = true;
  //     //     const firstParagraph = textSoFar.substring(0, cutPoint);
  //     //     // fire/forget: we don't want to stall this loop
  //     //     void speakText(firstParagraph);
  //     //   }
  //     // }
  //   });
  // } catch (error: any) {
  //   if (error?.name !== 'AbortError') {
  //     console.error('Fetch request error:', error);
  //     const errorText = ` [Issue: ${error.message || (typeof error === 'string' ? error : 'Chat stopped.')}]`;
  //     incrementalAnswer.fragments = messageFragmentsReplaceLastContentText(incrementalAnswer.fragments, errorText, true);
  //     returnStatus.outcome = 'errored';
  //     returnStatus.errorMessage = error.message;
  //   } else
  //     returnStatus.outcome = 'aborted';
  // }

  // Ensure the last content is flushed out, and mark as complete
  onMessageUpdated({ ...incrementalAnswer, pendingIncomplete: undefined }, true);

  // 📢 TTS: all
  // if ((autoSpeak === 'all' || autoSpeak === 'firstLine') && !spokenLine && !abortSignal.aborted) {
  //   const incrementalText = messageFragmentsReduceText(incrementalAnswer.fragments);
  //   if (incrementalText.length > 0)
  //     void speakText(incrementalText);
  // }

  return returnStatus;
}