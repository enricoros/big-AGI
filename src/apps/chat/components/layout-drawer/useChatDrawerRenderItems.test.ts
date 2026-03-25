import assert from 'node:assert/strict';
import test from 'node:test';

import type { DFolder } from '~/common/stores/folders/store-chat-folders';

import { filterConversationsByFolderSelection, shouldShowConversationInAllChats } from './useChatDrawerRenderItems';


const folders: DFolder[] = [
  {
    id: 'folder-visible',
    title: 'Visible',
    conversationIds: ['chat-visible', 'chat-shared'],
    visibleInAllChats: true,
  },
  {
    id: 'folder-hidden',
    title: 'Hidden',
    conversationIds: ['chat-hidden', 'chat-shared-hidden'],
    visibleInAllChats: false,
  },
];

test('shouldShowConversationInAllChats keeps unfoldered chats and visible-folder chats', () => {
  assert.equal(shouldShowConversationInAllChats('chat-unfoldered', folders), true);
  assert.equal(shouldShowConversationInAllChats('chat-visible', folders), true);
});

test('shouldShowConversationInAllChats hides chats that only belong to hidden folders', () => {
  assert.equal(shouldShowConversationInAllChats('chat-hidden', folders), false);
  assert.equal(shouldShowConversationInAllChats('chat-shared-hidden', folders), false);
});

test('filterConversationsByFolderSelection bypasses All Chats visibility when a specific folder is active', () => {
  const conversations = [
    { id: 'chat-visible' as const },
    { id: 'chat-hidden' as const },
    { id: 'chat-unfoldered' as const },
  ];

  assert.deepEqual(
    filterConversationsByFolderSelection(conversations, null, folders).map(conversation => conversation.id),
    ['chat-visible', 'chat-unfoldered'],
  );

  assert.deepEqual(
    filterConversationsByFolderSelection(conversations, folders[1], folders).map(conversation => conversation.id),
    ['chat-hidden'],
  );
});
