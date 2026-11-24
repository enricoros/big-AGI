/**
 * Trade of conversations.
 *
 * Store-free: the calls into the chat store are passed in, as they differ where chats are stored differently.
 *
 * A conversation is a linear list of messages, matched by id. The side that has every message of the
 * other, and more, is the successor. Two sides that each have messages the other lacks are two
 * continuations: a conflict, never merged into one list.
 */

import type { Immutable } from '~/common/types/immutable.types';
import { conversationTitle, type DConversation, type DConversationId, duplicateDConversation } from '~/common/stores/chat/chat.conversation';
import { messageFragmentsReduceText } from '~/common/stores/chat/chat.message';

import type { TradeAdapter, TradeContent, TradeItem, TradeOp, TradeRejected, TradeRelated } from '../trade.types';
import { tradeRelateByContent } from '../trade.plan';


// the per-chat and all-chats JSON files, without and with a schema tag: they carry no archive flag and no symbol
const SCHEMAS_OLDER_FILES = ['rest-chat.v1', 'vnd.agi.stored-chat'];

// conversations as a chat store keeps them, in the versions and builds that exist
const SCHEMAS_STORED = ['app-chats.v4', 'app-chats.v5', 'agi.chat'];

// what a device rewrites on its own, and what only means something on the device that wrote it.
// 'fId': a fragment is its content; the messages of the oldest files have none, and get new ones at every read
const IGNORE_KEYS: ReadonlySet<string> = new Set(['created', 'updated', 'tokenCount', 'liveFileId', 'pendingIncomplete', 'fId']);


export interface TradeChatsConverters {
  /** A conversation from the JSON of any version, or null. */
  fromJson: (json: unknown) => DConversation | null;
  /** Adds the conversation, or replaces the one with its id. */
  import: (conversation: DConversation) => DConversationId;
}

export interface TradeChatsStore extends TradeChatsConverters {
  /** The schema of the conversations this store keeps: what an export of them is labeled. */
  schema: string;
  /** The conversations the app saves: no incognito, no empty ones. */
  list: () => Immutable<DConversation[]>;
  /** Resolves once what was imported is on disk. */
  saved: () => Promise<void>;
}


/**
 * The adapter over a chat store that is a list of conversations.
 */
export function tradeChatsAdapter(store: TradeChatsStore): TradeAdapter {
  const { copy, ...rules } = tradeChatsContent(store);
  return {
    type: 'chat',
    label: 'conversation',
    labelPlural: 'conversations',
    schema: store.schema,
    ...rules,

    localItems: async () => ({ items: store.list().map(_toItem) }),

    apply: async (ops) => {
      const failed: TradeRejected[] = [];
      const current: TradeOp[] = [];

      // the version the preview showed is the one that was decided on: a chat that moved since, such as
      // one with a reply still arriving, is not replaced
      const now = new Map(store.list().map(conversation => [conversation.id, conversation]));
      for (const op of ops) {
        const conversation = now.get(op.item.id);
        const replaces = op.resolution === 'accept-incoming' || op.resolution === 'merge';
        if (replaces && op.local && !(conversation && _isSame(rules, _toItem(conversation), op.local)))
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


/**
 * What is known of conversations wherever they are stored: reading their files, relating two versions,
 * showing one, and making a copy of one through the store's import.
 */
export function tradeChatsContent(converters: TradeChatsConverters): TradeContent {
  return {

    readSection: (section, local) => {
      const items: TradeItem[] = [];
      const rejected: TradeRejected[] = [];
      const isOlderFile = SCHEMAS_OLDER_FILES.includes(section.schema);
      for (const item of section.items) {
        // a file is untrusted input: a damaged conversation is one rejected row
        const fileData = (item.data ?? {}) as Partial<Record<keyof DConversation, unknown>>;
        const title = [fileData.userTitle, fileData.autoTitle].find((text): text is string => typeof text === 'string' && !!text);
        if (!isOlderFile && !SCHEMAS_STORED.includes(section.schema)) {
          rejected.push({ id: item.id, title, reason: 'A kind of conversation this version cannot read' });
          continue;
        }
        let conversation: DConversation | null = null;
        try {
          if (fileData.id === item.id)
            conversation = converters.fromJson(fileData);
        } catch {
          // rejected below
        }
        if (!conversation) {
          rejected.push({ id: item.id, title, reason: 'Not a conversation' });
          continue;
        }
        if (typeof conversation.userTitle !== 'string') delete conversation.userTitle;
        if (typeof conversation.autoTitle !== 'string') delete conversation.autoTitle;

        // the archive flag and the symbol: from the file, and where an older file cannot carry them, from this device
        const localData = isOlderFile ? local.get(conversation.id)?.data as Partial<DConversation> | undefined : undefined;
        const isArchived = 'isArchived' in fileData ? fileData.isArchived : localData?.isArchived;
        const userSymbol = 'userSymbol' in fileData ? fileData.userSymbol : localData?.userSymbol;
        if (typeof isArchived === 'boolean') conversation.isArchived = isArchived; else delete conversation.isArchived;
        if (typeof userSymbol === 'string') conversation.userSymbol = userSymbol; else delete conversation.userSymbol;

        items.push(_toItem(conversation));
      }
      return { items, rejected };
    },

    relate: (incoming, local) => {
      const related = tradeRelateByContent(incoming.data, local.data, IGNORE_KEYS);
      return related.relation === 'mergeable' ? _relateMergeable(incoming.data as DConversation, local.data as DConversation, related.merged as object) : related;
    },

    describe: (item) => {
      const conversation = item.data as DConversation;
      return { title: conversationTitle(conversation, 'Untitled'), detail: `${conversation.messages.length} ${conversation.messages.length === 1 ? 'message' : 'messages'}` };
    },

    compareText: (item) => {
      const conversation = item.data as DConversation;
      return [conversationTitle(conversation, 'Untitled'), ...conversation.messages.map(message => `${message.role}:\n${messageFragmentsReduceText(message.fragments)}`)].join('\n\n');
    },

    copy: (item) => {
      converters.import(duplicateDConversation(item.data as DConversation, undefined, false));
    },

  };
}


function _toItem(conversation: Immutable<DConversation>): TradeItem {
  // without what only lives in memory
  const data: Record<string, unknown> = { ...conversation };
  delete data._abortController;
  delete data._isIncognito;
  return { id: conversation.id, data };
}

function _isSame(content: Pick<TradeContent, 'relate'>, now: TradeItem, previewed: TradeItem): boolean {
  try {
    return content.relate(now, previewed).relation === 'same';
  } catch {
    return false;
  }
}

function _relateMergeable(incoming: DConversation, local: DConversation, merged: object): TradeRelated {
  const incomingIds = new Set(incoming.messages.map(message => message.id));
  const localMessages = new Map(local.messages.map(message => [message.id, message]));
  const incomingHasOwn = incoming.messages.some(message => !localMessages.has(message.id));
  const localHasOwn = local.messages.some(message => !incomingIds.has(message.id));
  if (incomingHasOwn && localHasOwn)
    return { relation: 'conflict' };

  // the longer list in its own order, with this device's copy of each message it already has
  const messages = incomingHasOwn ? incoming.messages.map(message => localMessages.get(message.id) ?? message) : local.messages;
  return { relation: 'mergeable', merged: { ...local, ...merged, messages } };
}
