import assert from 'node:assert/strict';
import test from 'node:test';

import { useFolderStore } from '~/common/stores/folders/store-chat-folders';

import { createDConversation } from './chat.conversation';
import { CHAT_ARCHIVE_RETENTION_MS, getArchiveDaysUntilPermanentDelete, normalizeArchivedConversations, useChatStore } from './store-chats';


test('normalizeArchivedConversations timestamps newly archived chats and expires chats older than four weeks', () => {
  const now = 1_750_000_000_000;
  const recentArchived = createDConversation('Developer');
  recentArchived.isArchived = true;

  const expiredArchived = createDConversation('Developer');
  expiredArchived.isArchived = true;
  expiredArchived.archivedAt = now - CHAT_ARCHIVE_RETENTION_MS - 1;

  const result = normalizeArchivedConversations({
    conversations: [recentArchived, expiredArchived],
    now,
  });

  assert.equal(result.conversations.length, 1);
  assert.equal(result.conversations[0]?.id, recentArchived.id);
  assert.equal(result.conversations[0]?.archivedAt, now);
  assert.deepStrictEqual(result.expiredConversationIds, [expiredArchived.id]);
});

test('setArchived records and clears archivedAt metadata', () => {
  const conversation = createDConversation('Developer');
  useChatStore.setState({ conversations: [conversation] });

  useChatStore.getState().setArchived(conversation.id, true);
  const archivedConversation = useChatStore.getState().conversations[0];
  assert.equal(archivedConversation?.isArchived, true);
  assert.equal(typeof archivedConversation?.archivedAt, 'number');

  useChatStore.getState().setArchived(conversation.id, false);
  const restoredConversation = useChatStore.getState().conversations[0];
  assert.equal(restoredConversation?.isArchived, false);
  assert.equal(restoredConversation?.archivedAt, undefined);
});

test('purgeExpiredArchivedConversations removes expired archived chats from folders', () => {
  const now = Date.now();
  const expiredArchived = createDConversation('Developer');
  expiredArchived.isArchived = true;
  expiredArchived.archivedAt = now - CHAT_ARCHIVE_RETENTION_MS - 1;

  const activeConversation = createDConversation('Developer');

  useFolderStore.setState({
    folders: [{
      id: 'folder-1',
      title: 'Archive bucket',
      conversationIds: [expiredArchived.id, activeConversation.id],
    }],
    enableFolders: true,
  });
  useChatStore.setState({
    conversations: [expiredArchived, activeConversation],
  });

  const purgedIds = useChatStore.getState().purgeExpiredArchivedConversations();

  assert.deepStrictEqual(purgedIds, [expiredArchived.id]);
  assert.deepStrictEqual(useChatStore.getState().conversations.map(conversation => conversation.id), [activeConversation.id]);
  assert.deepStrictEqual(useFolderStore.getState().folders[0]?.conversationIds, [activeConversation.id]);
});

test('getArchiveDaysUntilPermanentDelete rounds up partial days and clamps expired chats to zero', () => {
  const archivedAt = 1_750_000_000_000;
  const nearExpiry = archivedAt + CHAT_ARCHIVE_RETENTION_MS - (12 * 60 * 60 * 1000);
  const expired = archivedAt + CHAT_ARCHIVE_RETENTION_MS + 1;

  assert.equal(getArchiveDaysUntilPermanentDelete(archivedAt, archivedAt), 28);
  assert.equal(getArchiveDaysUntilPermanentDelete(archivedAt, nearExpiry), 1);
  assert.equal(getArchiveDaysUntilPermanentDelete(archivedAt, expired), 0);
  assert.equal(getArchiveDaysUntilPermanentDelete(undefined, archivedAt), null);
});
