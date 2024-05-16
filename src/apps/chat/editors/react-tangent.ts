import { Agent } from '~/modules/aifn/react/react';
import { DLLMId } from '~/modules/llms/store-llms';
import { useBrowseStore } from '~/modules/browse/store-module-browsing';

import type { ConversationHandler } from '~/common/chats/ConversationHandler';

import { STREAM_TEXT_INDICATOR } from './chat-stream';

const EPHEMERAL_DELETION_DELAY = 5 * 1000;


/**
 * Synchronous ReAct chat function - TODO: event loop, auto-ui, cleanups, etc.
 */
export async function runReActUpdatingState(cHandler: ConversationHandler, question: string | undefined, assistantLlmId: DLLMId) {
  if (!question) {
    cHandler.messageAppendAssistant('Issue: no question provided.', undefined, 'issue', false);
    return false;
  }

  // create a blank and 'typing' message for the assistant - to be filled when we're done
  const assistantModelLabel = 'react-' + assistantLlmId; //.slice(4, 7); // HACK: this is used to change the Avatar animation
  const assistantMessageId = cHandler.messageAppendAssistant(STREAM_TEXT_INDICATOR, undefined, assistantModelLabel, true);
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

    return true;
  } catch (error: any) {
    console.error(error);
    logToEphemeral(ephemeralText + `\nIssue: ${error || 'unknown'}`);
    cHandler.messageEdit(assistantMessageId, { text: 'Issue: ReAct did not produce an answer.', typing: false }, false);
    return false;
  }
}