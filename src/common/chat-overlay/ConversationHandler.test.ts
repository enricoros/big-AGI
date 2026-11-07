/// <reference types="node" />

// Run: `NODE_ENV=development npx tsx --test src/common/chat-overlay/ConversationHandler.test.ts`

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createDMessageTextContent } from '~/common/stores/chat/chat.message';
import { getConversation, useChatStore } from '~/common/stores/chat/store-chats';

import { ConversationsManager } from './ConversationsManager';


describe('ConversationHandler abort controller', () => {

  it('a run ending after a Retry replaced it leaves the new run stoppable', () => {
    const conversationId = useChatStore.getState().prependNewConversation(undefined, false);
    const cHandler = ConversationsManager.getHandler(conversationId);
    cHandler.messageAppend(createDMessageTextContent('user', 'question'));

    // run A streams into its assistant message
    const runA = new AbortController();
    const { assistantMessageId } = cHandler.messageAppendAssistantPlaceholder('...');
    cHandler.setAbortController(runA, 'test');

    // Retry while A streams: the truncation aborts A, then run B starts
    cHandler.historyTruncateTo(assistantMessageId, -1);
    const runB = new AbortController();
    cHandler.setAbortController(runB, 'test');
    assert.equal(runA.signal.aborted, true);

    // A's teardown lands after B started: B keeps its controller (the Stop button)
    cHandler.clearAbortController(runA, 'test');
    assert.equal(getConversation(conversationId)?._abortController, runB);

    // B's own teardown clears it
    cHandler.clearAbortController(runB, 'test');
    assert.equal(getConversation(conversationId)?._abortController, null);
  });

});
