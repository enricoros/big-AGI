import { Agent } from '@/common/llm-util/react';
import { ChatModelId } from '../../../data';
import { createEphemeral, DMessage, useChatStore } from '@/common/state/store-chats';

import { createAssistantTypingMessage } from './agi-immediate';


/**
 * Synchronous ReAct chat function - TODO: event loop, auto-ui, cleanups, etc.
 */
export const runReActUpdatingState = async (conversationId: string, question: string, assistantModelId: ChatModelId) => {

  const { appendEphemeral, updateEphemeralText, deleteEphemeral, editMessage } = useChatStore.getState();

  // create a blank and 'typing' message for the assistant - to be filled when we're done
  const assistantModelStr = 'react-' + assistantModelId.slice(4, 7); // HACK: this is used to change the Avatar animation
  const assistantMessageId = createAssistantTypingMessage(conversationId, assistantModelStr as ChatModelId, undefined, '...');
  const updateAssistantMessage = (update: Partial<DMessage>) =>
    editMessage(conversationId, assistantMessageId, update, false);


  // create an ephemeral space
  const ephemeral = createEphemeral(`ReAct Development Tools`, 'Initializing ReAct..');
  appendEphemeral(conversationId, ephemeral);

  let ephemeralText: string = '';
  const logToEphemeral = (text: string) => {
    console.log(text);
    ephemeralText += (text.length > 300 ? text.slice(0, 300) + '...' : text) + '\n';
    updateEphemeralText(conversationId, ephemeral.id, ephemeralText);
  };

  try {

    // react loop
    const agent = new Agent();
    let reactResult = await agent.reAct(question, assistantModelId, 5, logToEphemeral);

    setTimeout(() => deleteEphemeral(conversationId, ephemeral.id), 2 * 1000);
    updateAssistantMessage({ text: reactResult, typing: false });

  } catch (error: any) {
    console.error(error);
    logToEphemeral(ephemeralText + `\nIssue: ${error || 'unknown'}`);
    updateAssistantMessage({ text: 'Issue: ReAct did nor produce an answer.', typing: false });
  }
};
