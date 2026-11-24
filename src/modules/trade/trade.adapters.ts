/**
 * Trade adapters of this build: each kind of data that can be exported and imported, bound to the store
 * this build keeps it in.
 */

import type { Immutable } from '~/common/types/immutable.types';
import { DataAtRestV1 } from '~/common/stores/chat/chats.converters';
import { idbFlushWrites } from '~/common/util/idbUtils';
import type { DConversation } from '~/common/stores/chat/chat.conversation';
import { useChatStore } from '~/common/stores/chat/store-chats';

import type { TradeAdapter, TradeItem, TradeOp, TradeRejected } from './trade.types';
import { tradeChatItem, tradeChatsContent, type TradeChatsConverters } from './adapters/trade.chats';
import { tradeFoldersAdapter } from './adapters/trade.folders';
import { tradeLegacyServicesAdapter } from './adapters/trade.services';
import { tradeSettingsAdapters } from './adapters/trade.settings';


/**
 * The kinds of data this build can export and import.
 *
 * A function, not a constant: it reads the stores, so it is called when a trade dialog opens, never
 * while the app loads. A build that stores its data differently returns its own.
 */
export function tradeAdapters(): TradeAdapter[] {
  return [
    {
      ..._tradeChatsAdapter({
        schema: 'app-chats.v4',
        // what the store persists: no incognito, no empty conversations
        list: () => useChatStore.getState().conversations.filter(c => !c._isIncognito && (c.messages?.length || c.userTitle || c.autoTitle)),
        fromJson: (json) => DataAtRestV1.recreateConversation(json as DataAtRestV1.RestChatJsonV1),
        import: (conversation) => useChatStore.getState().importConversation(conversation, false),
        saved: idbFlushWrites,
      }),
      // the chats load from disk after the app starts: an export before that would be an empty one
      // (no 'persist' where the browser has no IndexedDB: the chats then live in memory only)
      ...(useChatStore.persist?.hasHydrated() === false && { unavailable: 'Conversations are still loading' }),
    },
    tradeFoldersAdapter(),
    ...tradeSettingsAdapters(),
    tradeLegacyServicesAdapter(),
  ];
}


/** What the adapter of conversations needs of a chat store that is a list, besides its converters. */
interface _TradeChatsStore extends TradeChatsConverters {
  /** The schema of the conversations this store keeps: what an export of them is labeled. */
  schema: string;
  /** The conversations the app saves: no incognito, no empty ones. */
  list: () => Immutable<DConversation[]>;
  /** Resolves once what was imported is on disk. */
  saved: () => Promise<void>;
}

/**
 * The adapter of conversations over a chat store that is a list: the rules of conversations
 * (adapters/trade.chats.ts), and every write to this store but the copy.
 */
function _tradeChatsAdapter(store: _TradeChatsStore): TradeAdapter {
  const { copy, ...rules } = tradeChatsContent(store);
  const isSame = (now: TradeItem, previewed: TradeItem): boolean => {
    try {
      return rules.relate(now, previewed).relation === 'same';
    } catch {
      return false;
    }
  };
  return {
    type: 'chat',
    label: 'conversation',
    labelPlural: 'conversations',
    schema: store.schema,
    ...rules,

    localItems: async () => ({ items: store.list().map(tradeChatItem) }),

    apply: async (ops) => {
      const failed: TradeRejected[] = [];
      const current: TradeOp[] = [];

      // the version the preview showed is the one that was decided on: a chat that moved since, such as
      // one with a reply still arriving, is not replaced
      const now = new Map(store.list().map(conversation => [conversation.id, conversation]));
      for (const op of ops) {
        const conversation = now.get(op.item.id);
        const replaces = op.resolution === 'accept-incoming' || op.resolution === 'merge';
        if (replaces && op.local && !(conversation && isSame(tradeChatItem(conversation), op.local)))
          failed.push({ id: op.item.id, reason: 'Changed on this device since the preview: review it again' });
        else
          current.push(op);
      }

      // last to first: the store puts each import on top, so the file's order is the order shown
      for (const op of current.reverse()) {
        try {
          // the store changes what it is given: never hand it the object the preview still shows
          if (op.resolution === 'add' || op.resolution === 'accept-incoming')
            store.import(structuredClone(op.item.data) as DConversation);
          else if (op.resolution === 'merge')
            store.import(structuredClone(op.merged) as DConversation);
          else if (op.resolution === 'keep-both')
            copy(op.item);
        } catch (error: any) {
          failed.push({ id: op.item.id, reason: error?.message || 'Could not be imported' });
        }
      }
      await store.saved();
      return { failed };
    },
  };
}
