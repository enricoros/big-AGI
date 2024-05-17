import { Agent } from '~/modules/aifn/react/react';
import { DLLMId } from '~/modules/llms/store-llms';
import { useBrowseStore } from '~/modules/browse/store-module-browsing';

import type { ConversationHandler } from '~/common/chats/ConversationHandler';
import { createTextPart } from '~/common/stores/chat/chat.message';

// configuration
const EPHEMERAL_DELETION_DELAY = 5 * 1000;


/**
 * Synchronous ReAct chat function - TODO: event loop, auto-ui, cleanups, etc.
 */
export async function runReActUpdatingState(cHandler: ConversationHandler, question: string | undefined, assistantLlmId: DLLMId) {
  if (!question) {
    cHandler.messageAppendAssistant('Issue: no question provided.', 'issue');
    return false;
  }

  // create an assistant placeholder message - to be filled when we're done
  const assistantModelLabel = 'react-' + assistantLlmId; //.slice(4, 7); // HACK: this is used to change the Avatar animation
  const assistantMessageId = cHandler.messageAppendAssistantPlaceholder(
    '...',
    { originLLM: assistantModelLabel },
  );
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

    cHandler.messageEdit(assistantMessageId, {
      content: [createTextPart(reactResult)],
      pendingIncomplete: undefined, pendingPlaceholderText: undefined,
    }, false);

    setTimeout(() => eHandler.delete(), EPHEMERAL_DELETION_DELAY);

    return true;
  } catch (error: any) {
    console.error(error);
    logToEphemeral(ephemeralText + `\nIssue: ${error || 'unknown'}`);
    cHandler.messageEdit(assistantMessageId, {
      content: [createTextPart('Issue: ReAct did not produce an answer.')],
      pendingIncomplete: undefined, pendingPlaceholderText: undefined,
    }, false);
    return false;
  }
}