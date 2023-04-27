import { Agent } from '@/common/llm-util/react';
import { ChatModelId, SystemPurposeId } from '../../../data';
import { createEphemeral, DMessage, useChatStore } from '@/common/state/store-chats';

import { createAssistantTypingMessage, updatePurposeInHistory } from './agi-immediate';


/**
 * Synchronous ReAct chat function - TODO: event loop, auto-ui, cleanups, etc.
 */
export const runReActUpdatingState = async (conversationId: string, history: DMessage[], assistantModelId: ChatModelId, systemPurposeId: SystemPurposeId) => {

  // get the text from the last message in history
  const lastMessageText = history[history.length - 1].text;

  // update the system message from the active Purpose, if not manually edited
  history = updatePurposeInHistory(conversationId, history, systemPurposeId);

  // create an ephemeral space
  let ephemeralId: string;
  let ephemeralText: string = '';
  {
    const ephemeral = createEphemeral('ReAct', 'Initializing ReAct..');
    useChatStore.getState().appendEphemeral(conversationId, ephemeral);
    ephemeralId = ephemeral.id;
  }
  const logToEphemeral = (text: string) => {
    console.log(text);
    ephemeralText += text + '\n';
    useChatStore.getState().updateEphemeralText(conversationId, ephemeralId, ephemeralText);
  };

  // create a blank and 'typing' message for the assistant - to be filled when we're done
  const assistantMessageId = createAssistantTypingMessage(conversationId, history, assistantModelId);
  const updateAssistantMessage = (update: Partial<DMessage>) =>
    useChatStore.getState().editMessage(conversationId, assistantMessageId, update, false);

  let reactResult: string = '';
  try {


    // react loop

    logToEphemeral(`question: ${lastMessageText}`);
    const agent = new Agent();
    reactResult = await agent.reAct(lastMessageText, assistantModelId, 5, logToEphemeral);
    logToEphemeral('```');
    logToEphemeral(`final result: ${reactResult}`);


  } catch (error: any) {
    console.error(error);
    logToEphemeral(ephemeralText + `\nIssue: ${error || 'unknown'}`);
  }

  // finalize content, and stop the typing animation
  updateAssistantMessage({ text: reactResult, typing: false });
};
