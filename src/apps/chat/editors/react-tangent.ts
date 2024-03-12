import { Agent } from '~/modules/aifn/react/react';
import { DLLMId } from '~/modules/llms/store-llms';
import { useBrowseStore } from '~/modules/browse/store-module-browsing';

import { ConversationsManager } from '~/common/chats/ConversationsManager';

const EPHEMERAL_DELETION_DELAY = 5 * 1000;


/**
 * Synchronous ReAct chat function - TODO: event loop, auto-ui, cleanups, etc.
 */
export async function runReActUpdatingState(conversationId: string, question: string, assistantLlmId: DLLMId) {
  const cHandler = ConversationsManager.getHandler(conversationId);

  // create a blank and 'typing' message for the assistant - to be filled when we're done
  const assistantModelLabel = 'react-' + assistantLlmId.slice(4, 7); // HACK: this is used to change the Avatar animation
  const assistantMessageId = cHandler.messageAppendAssistant('...', assistantModelLabel, undefined);
  const { enableReactTool: enableBrowse } = useBrowseStore.getState();

  // create an ephemeral space
  const eHandler = cHandler.createEphemeral(`Reason+Act`, 'Initializing ReAct..');
  let ephemeralText = '';
  const logToEphemeral = (text: string) => {
    console.log(text);
    ephemeralText += (text.length > 300 ? text.slice(0, 300) + '...' : text) + '\n';
    eHandler.updateText(ephemeralText);
  };
  const showStateInEphemeral = (state: object) => eHandler.updateState(state);

  try {

    // react loop
    const agent = new Agent();
    const reactResult = await agent.reAct(question, assistantLlmId, 5, enableBrowse, logToEphemeral, showStateInEphemeral);

    cHandler.messageEdit(assistantMessageId, { text: reactResult, typing: false }, false);
    setTimeout(() => eHandler.delete(), EPHEMERAL_DELETION_DELAY);

  } catch (error: any) {
    console.error(error);
    logToEphemeral(ephemeralText + `\nIssue: ${error || 'unknown'}`);
    cHandler.messageEdit(assistantMessageId, { text: 'Issue: ReAct did not produce an answer.', typing: false }, false);
  }
}