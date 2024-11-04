import { Agent } from '~/modules/aifn/react/react';
import { useBrowseStore } from '~/modules/browse/store-module-browsing';

import type { ConversationHandler } from '~/common/chat-overlay/ConversationHandler';
import type { DLLMId } from '~/common/stores/llms/llms.types';
import { createErrorContentFragment, createTextContentFragment } from '~/common/stores/chat/chat.fragments';

// configuration
const EPHEMERAL_DELETION_DELAY = 5 * 1000;


/**
 * Synchronous ReAct chat function - TODO: event loop, auto-ui, cleanups, etc.
 */
export async function runReActUpdatingState(cHandler: ConversationHandler, question: string | undefined, assistantLlmId: DLLMId, contextRef: string) {
  if (!question) {
    cHandler.messageAppendAssistantText('Issue: no question provided.', 'issue');
    return false;
  }

  // create an assistant placeholder message - to be filled when we're done
  const assistantModelLabel = 'react-' + assistantLlmId; //.slice(4, 7); // HACK: this is used to change the Avatar animation
  const { assistantMessageId, placeholderFragmentId } = cHandler.messageAppendAssistantPlaceholder(
    '...',
    { generator: { mgt: 'named', name: assistantModelLabel } },
  );
  const { enableReactTool: enableBrowse } = useBrowseStore.getState();

  // Abort controller for the ReAct loop
  const abortController = new AbortController();
  cHandler.setAbortController(abortController, 'react-tangent');

  // Ephemeral: the space of Status and Logs, auto-plugged to the UI
  const hEphemeral = cHandler.createEphemeralHandler(`Reason+Act`, 'Initializing ReAct..');
  let ephemeralText = '';
  const logToEphemeral = (text: string) => {
    console.log(text);
    ephemeralText += (text.length > 300 ? text.slice(0, 300) + '...' : text) + '\n';
    hEphemeral.updateText(ephemeralText);
  };
  const showStateInEphemeral = (state: object) => hEphemeral.updateState(state);

  try {

    // react loop
    const agent = new Agent(contextRef, abortController.signal);
    const reactResult = await agent.reAct(question, assistantLlmId, 5, enableBrowse, logToEphemeral, showStateInEphemeral);

    cHandler.messageFragmentReplace(assistantMessageId, placeholderFragmentId, createTextContentFragment(reactResult), true);

    hEphemeral.markAsDone();

    return true;
  } catch (error: any) {
    console.error('ReAct error', error);

    logToEphemeral(ephemeralText + `\n${error || 'unknown'}`);

    const reactError = `Issue: ReAct couldn't answer your question. ${error?.message || error?.toString() || 'Unknown error'}`;
    cHandler.messageFragmentReplace(assistantMessageId, placeholderFragmentId, createErrorContentFragment(reactError), true);

    return false;
  } finally {
    // FIXME: Massive race condition here
    cHandler.clearAbortController('react-tangent');
  }
}