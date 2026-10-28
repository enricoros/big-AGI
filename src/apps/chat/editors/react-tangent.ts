import { Agent } from '~/modules/aifn/react/react';
import { useBrowseStore } from '~/modules/browse/store-module-browsing';

import type { ConversationHandler } from '~/common/chat-overlay/ConversationHandler';
import type { DLLMId } from '~/common/stores/llms/llms.types';
import type { DMessage } from '~/common/stores/chat/chat.message';
import { createErrorContentFragment, createTextContentFragment, isTextContentFragment } from '~/common/stores/chat/chat.fragments';

// configuration
const EPHEMERAL_DELETION_DELAY = 5 * 1000;

// ReAct chat-history context
const REACT_HISTORY_TURNS = 6;   // last N user/assistant messages
const REACT_HISTORY_CHARS = 600; // per-message cap

/**
 * Builds a compact transcript of the recent conversation so /react can
 * resolve follow-ups ("what about the second one?"). Addresses the upstream
 * `TODO: to initialize with previous chat messages to provide context` in react.ts.
 */
function buildHistoryContext(cHandler: ConversationHandler): string {
  let messages: Readonly<DMessage[]>;
  try {
    messages = cHandler.historyViewHeadOrThrow('react-context');
  } catch {
    return '';
  }
  const lines: string[] = [];
  for (const m of messages) {
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    const text = m.fragments.filter(isTextContentFragment).map(f => f.part.text).join('\n').trim();
    if (!text || text === '...') continue; // skip the assistant placeholder just appended
    if (m.role === 'user' && text.startsWith('/react')) continue; // the current question arrives separately
    lines.push(`${m.role === 'user' ? 'User' : 'Assistant'}: ${text.slice(0, REACT_HISTORY_CHARS)}`);
  }
  return lines.slice(-REACT_HISTORY_TURNS).join('\n');
}


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
    // prepend the recent conversation so follow-up questions resolve
    const historyContext = buildHistoryContext(cHandler);
    const contextualQuestion = historyContext
      ? `For context, here is the recent conversation:\n\n${historyContext}\n\nQuestion (if it references earlier topics, use the context above to interpret it): ${question}`
      : question;

    const agent = new Agent(contextRef, abortController.signal);
    const reactResult = await agent.reAct(contextualQuestion, assistantLlmId, 5, enableBrowse, logToEphemeral, showStateInEphemeral);

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