import { Agent } from '~/modules/aifn/react/react';
import { DLLMId } from '~/modules/llms/llm.types';

import { createDEphemeral, DMessage, useChatStore } from '~/common/state/store-chats';

import { createAssistantTypingMessage } from './editors';


/**
 * Synchronous ReAct chat function - TODO: event loop, auto-ui, cleanups, etc.
 */
export async function runReActUpdatingState(conversationId: string, question: string, assistantLlmId: DLLMId) {

  const { appendEphemeral, updateEphemeralText, updateEphemeralState, deleteEphemeral, editMessage } = useChatStore.getState();

  // create a blank and 'typing' message for the assistant - to be filled when we're done
  const assistantModelLabel = 'react-' + assistantLlmId.slice(4, 7); // HACK: this is used to change the Avatar animation
  const assistantMessageId = createAssistantTypingMessage(conversationId, assistantModelLabel, undefined, '...');
  const updateAssistantMessage = (update: Partial<DMessage>) =>
    editMessage(conversationId, assistantMessageId, update, false);


  // create an ephemeral space
  const ephemeral = createDEphemeral(`Reason+Act`, 'Initializing ReAct..');
  appendEphemeral(conversationId, ephemeral);

  let ephemeralText = '';
  const logToEphemeral = (text: string) => {
    console.log(text);
    ephemeralText += (text.length > 300 ? text.slice(0, 300) + '...' : text) + '\n';
    updateEphemeralText(conversationId, ephemeral.id, ephemeralText);
  };

  try {

    // react loop
    const agent = new Agent();
    const reactResult = await agent.reAct(question, assistantLlmId, 5,
      logToEphemeral,
      (state: object) => updateEphemeralState(conversationId, ephemeral.id, state),
    );

    setTimeout(() => deleteEphemeral(conversationId, ephemeral.id), 2 * 1000);
    updateAssistantMessage({ text: reactResult, typing: false });

  } catch (error: any) {
    console.error(error);
    logToEphemeral(ephemeralText + `\nIssue: ${error || 'unknown'}`);
    updateAssistantMessage({ text: 'Issue: ReAct did not produce an answer.', typing: false });
  }
}