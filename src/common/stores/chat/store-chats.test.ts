/// <reference types="node" />

// Unit tests for per-conversation model binding: getConversationChatLLMId's resolution order
// (chat pin > 'primaryChat' domain default) and silent degradation of a broken pin.
//
// Runs entirely against the real Zustand stores (useChatStore, useModelsStore) - no mocks -
// per this repo's test philosophy: assert real behavior, not a stubbed string.
//
// Run: `npm test` or `NODE_ENV=development npx tsx --test src/common/stores/chat/store-chats.test.ts`

import { describe, test } from 'node:test';
import { deepStrictEqual as eq, ok } from 'node:assert';

import { createDConversation } from './chat.conversation';
import { getConversationChatLLMId, useChatStore } from './store-chats';
import { useModelsStore } from '~/common/stores/llms/store-llms';
import type { DLLM } from '~/common/stores/llms/llms.types';


function _fakeLLM(id: string): DLLM {
  return {
    id,
    label: id,
    created: 0,
    updated: 0,
    description: '',
    tags: [],
    contextWindow: 8192,
    maxCompletionTokens: null,
    trainingDataCutoff: undefined,
    interfaces: [],
    parameterSpecs: [],
    benchmark: undefined,
    pricing: undefined,
    isLegacy: false,
    hidden: false,
    sId: 'test-service',
    vId: 'openai',
  } as unknown as DLLM;
}

/** Install two fake LLMs and pin 'llm-default' as the 'primaryChat' domain assignment. */
function _seedLlmUniverse() {
  useModelsStore.setState({
    llms: [_fakeLLM('llm-default'), _fakeLLM('llm-pinned')],
    modelAssignments: { primaryChat: { domainId: 'primaryChat', modelId: 'llm-default' } },
  } as any);
}

function _addConversation(userLlmId?: string) {
  const c = createDConversation();
  if (userLlmId) c.userLlmId = userLlmId;
  useChatStore.setState(state => ({ conversations: [c, ...state.conversations] }));
  return c.id;
}


describe('getConversationChatLLMId - per-conversation model binding', () => {

  test('unpinned conversation resolves to the primaryChat domain default', () => {
    _seedLlmUniverse();
    const conversationId = _addConversation(/* no pin */);

    eq(getConversationChatLLMId(conversationId), 'llm-default');
  });

  test('pinned conversation resolves to the pin, not the domain default', () => {
    _seedLlmUniverse();
    const conversationId = _addConversation('llm-pinned');

    eq(getConversationChatLLMId(conversationId), 'llm-pinned');
  });

  test('broken pin (model no longer exists) silently degrades to the domain default', () => {
    _seedLlmUniverse();
    const conversationId = _addConversation('llm-deleted-service');

    // never throws, never surfaces the broken id - falls back exactly like a broken domain assignment
    eq(getConversationChatLLMId(conversationId), 'llm-default');
  });

  test('null conversationId resolves to the domain default (no conversation context)', () => {
    _seedLlmUniverse();

    eq(getConversationChatLLMId(null), 'llm-default');
  });

  test('unknown conversationId resolves to the domain default (defensive)', () => {
    _seedLlmUniverse();

    eq(getConversationChatLLMId('does-not-exist'), 'llm-default');
  });

  test('setUserLlmId(id) pins, and setUserLlmId(null) reverts to following the default', () => {
    _seedLlmUniverse();
    const conversationId = _addConversation(/* no pin */);
    eq(getConversationChatLLMId(conversationId), 'llm-default');

    useChatStore.getState().setUserLlmId(conversationId, 'llm-pinned');
    eq(getConversationChatLLMId(conversationId), 'llm-pinned');
    ok(!!useChatStore.getState().conversations.find(c => c.id === conversationId)?.userLlmId, 'pin is persisted on the conversation');

    useChatStore.getState().setUserLlmId(conversationId, null);
    eq(getConversationChatLLMId(conversationId), 'llm-default');
    ok(!useChatStore.getState().conversations.find(c => c.id === conversationId)?.userLlmId, 'unpin clears the field entirely (undefined, not null/empty string)');
  });

});
