import { Agent } from '@/common/llm-util/react';
import { ChatModelId, SystemPurposeId } from '../../../data';
import { createEphemeral, DMessage, useChatStore } from '@/common/state/store-chats';

import { createAssistantTypingMessage, updatePurposeInHistory } from './agi-immediate';


/**
 * Synchronous ReAct chat function - TODO: event loop, auto-ui, cleanups, etc.
 */
export const runReActUpdatingState = async (conversationId: string, history: DMessage[], assistantModelId: ChatModelId, systemPurposeId: SystemPurposeId) => {

  const { appendEphemeral, updateEphemeralText, deleteEphemeral, editMessage } = useChatStore.getState();

  // get the text from the last message in history
  const lastMessageText = history[history.length - 1].text;

  // update the system message from the active Purpose, if not manually edited
  history = updatePurposeInHistory(conversationId, history, systemPurposeId);

  // create a blank and 'typing' message for the assistant - to be filled when we're done
  const assistantMessageId = createAssistantTypingMessage(conversationId, history, assistantModelId);
  const updateAssistantMessage = (update: Partial<DMessage>) =>
    editMessage(conversationId, assistantMessageId, update, false);


  // create an ephemeral space
  const ephemeral = createEphemeral(`ReAct · ${lastMessageText}`, 'Initializing ReAct..');
  appendEphemeral(conversationId, ephemeral);

  let ephemeralText: string = '';
  const logToEphemeral = (text: string) => {
    console.log(text);
    ephemeralText += text + '\n';
    updateEphemeralText(conversationId, ephemeral.id, ephemeralText);
  };

  try {

    // react loop
    const agent = new Agent();
    let reactResult = await agent.reAct(lastMessageText, assistantModelId, 5, logToEphemeral);

    setTimeout(() => deleteEphemeral(conversationId, ephemeral.id), 60 * 1000);
    updateAssistantMessage({ text: reactResult, typing: false });

  } catch (error: any) {
    console.error(error);
    logToEphemeral(ephemeralText + `\nIssue: ${error || 'unknown'}`);
    updateAssistantMessage({ text: 'Issue: ReAct did nor produce an answer.', typing: false });
  }
};
