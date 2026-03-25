import { useChatStore } from '~/common/stores/chat/store-chats';

import { panesManagerActions } from '../../apps/chat/components/panes/store-panes-manager';
import { createPerfSeedConversation, resolvePerfSeedFromSearch } from './perfSeeds';
import { isBrowserPerfEnabled } from './perfRegistry';


export const perfSeedBackupStorageKey = 'big-agi:perf-seed-backup-v1';

type PerfSeedBackupPayload = {
  conversations: ReturnType<typeof useChatStore.getState>['conversations'];
};

function readPerfSeedBackup(): PerfSeedBackupPayload | null {
  if (typeof window === 'undefined')
    return null;

  try {
    const rawBackup = window.localStorage.getItem(perfSeedBackupStorageKey);
    if (!rawBackup)
      return null;

    const parsedBackup = JSON.parse(rawBackup) as PerfSeedBackupPayload | null;
    if (!parsedBackup?.conversations?.length)
      return null;
    return parsedBackup;
  } catch {
    return null;
  }
}

function writePerfSeedBackup(payload: PerfSeedBackupPayload): void {
  if (typeof window === 'undefined')
    return;

  try {
    window.localStorage.setItem(perfSeedBackupStorageKey, JSON.stringify(payload));
  } catch {
    // ignore storage failures in perf-only path
  }
}

function clearPerfSeedBackup(): void {
  if (typeof window === 'undefined')
    return;

  try {
    window.localStorage.removeItem(perfSeedBackupStorageKey);
  } catch {
    // ignore storage failures in perf-only path
  }
}

function cloneConversationsForPerfBackup(conversations: ReturnType<typeof useChatStore.getState>['conversations']) {
  return structuredClone(conversations.map(conversation => ({
    ...conversation,
    _abortController: null,
  })));
}

function replaceConversationsForPerf(conversations: ReturnType<typeof useChatStore.getState>['conversations']): void {
  useChatStore.setState({
    conversations: cloneConversationsForPerfBackup(conversations),
  });
  panesManagerActions()._onConversationsChanged(conversations.map(conversation => conversation.id));
}

export function syncPerfSeedFromWindowLocation(search: string): void {
  const perfSeedId = resolvePerfSeedFromSearch(search, isBrowserPerfEnabled());
  if (!perfSeedId) {
    const backup = readPerfSeedBackup();
    if (backup) {
      replaceConversationsForPerf(backup.conversations);
      clearPerfSeedBackup();
    }
    return;
  }

  const currentConversations = useChatStore.getState().conversations;
  const backup = readPerfSeedBackup();
  if (!backup)
    writePerfSeedBackup({ conversations: cloneConversationsForPerfBackup(currentConversations) });

  const seededConversation = createPerfSeedConversation(perfSeedId);
  replaceConversationsForPerf([seededConversation]);
  window.__BIG_AGI_PERF__?.reset();
}
