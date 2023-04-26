import { Agent } from '@/common/llm-util/react';
import { ChatModelId, SystemPurposeId } from '../../../data';
import { DMessage, useChatStore } from '@/common/state/store-chats';

import { createAssistantTypingMessage, updatePurposeInHistory } from './agi-immediate';


/**
 * Synchronous ReAct chat function - TODO: event loop, auto-ui, cleanups, etc.
 */
export const runReActUpdatingState = async (conversationId: string, history: DMessage[], assistantModelId: ChatModelId, systemPurposeId: SystemPurposeId) => {

  // update the system message from the active Purpose, if not manually edited
  history = updatePurposeInHistory(conversationId, history, systemPurposeId);

  // create a blank and 'typing' message for the assistant
  const assistantMessageId = createAssistantTypingMessage(conversationId, history, assistantModelId);


  // logging function: anything logged gets appended to the 'assistant' message

  const updateAssistantMessage = (update: Partial<DMessage>) =>
    useChatStore.getState().editMessage(conversationId, assistantMessageId, update, false);

  let logText =
    'Entering ReAct mode:\n' +
    '```react-output.md\n';

  const log = (text: string) => {
    console.log(text);
    logText += text + '\n';
    updateAssistantMessage({ text: logText });
  };


  // get the text from the last message in history
  const lastMessageText = history[history.length - 1].text;

  try {


    // react loop

    log(`question: ${lastMessageText}`);
    const agent = new Agent();
    const result = await agent.reAct(lastMessageText, assistantModelId, 5, log);
    log('```');
    log(`final result: ${result}`);


  } catch (error: any) {
    console.error(error);
    updateAssistantMessage({ text: logText + `Issue: ${error || 'unknown'}` });
  }

  // stop the typing animation
  updateAssistantMessage({ typing: false });
};
