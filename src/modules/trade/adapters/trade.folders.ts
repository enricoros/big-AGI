/**
 * Trade adapter for chat folders.
 *
 * A folder is a title, a color and a list of conversation ids. Membership merges as a union;
 * a title or color that differs on the two sides is a conflict.
 */

import { agiUuid } from '~/common/util/idUtils';
import { type DFolder, useFolderStore } from '~/common/stores/folders/store-chat-folders';

import type { TradeAdapter, TradeItem, TradeRejected } from '../trade.types';
import { tradeRelateByContent } from '../trade.plan';


const SCHEMA_FOLDER = 'app-folders';
const NO_KEYS: ReadonlySet<string> = new Set();


export function tradeFoldersAdapter(): TradeAdapter {
  return {
    type: 'folder',
    label: 'folder',
    labelPlural: 'folders',
    schema: SCHEMA_FOLDER,

    localItems: async () => ({ items: useFolderStore.getState().folders.map(folder => ({ id: folder.id, data: folder })) }),

    readSection: (section) => {
      const items: TradeItem[] = [];
      const rejected: TradeRejected[] = [];
      for (const item of section.items) {
        const folder = item.data as Partial<DFolder> | null;
        if (section.schema !== SCHEMA_FOLDER || !folder || folder.id !== item.id || typeof folder.title !== 'string' || !Array.isArray(folder.conversationIds))
          rejected.push({ id: item.id, reason: 'Not a folder' });
        else
          items.push({ id: item.id, data: { id: folder.id, title: folder.title, conversationIds: folder.conversationIds, ...(folder.color && { color: folder.color }) } satisfies DFolder });
      }
      return { items, rejected };
    },

    relate: (incoming, local) => tradeRelateByContent(incoming.data, local.data, NO_KEYS),

    describe: (item) => {
      const folder = item.data as DFolder;
      return { title: folder.title, detail: `${folder.conversationIds.length} ${folder.conversationIds.length === 1 ? 'conversation' : 'conversations'}` };
    },

    apply: async (ops) => {
      const folders: DFolder[] = [];
      for (const op of ops) {
        if (op.resolution === 'add' || op.resolution === 'accept-incoming')
          folders.push(op.item.data as DFolder);
        else if (op.resolution === 'merge')
          folders.push(op.merged as DFolder);
        else if (op.resolution === 'keep-both')
          folders.push({ ...(op.item.data as DFolder), id: agiUuid('chat-folders-item') });
      }
      // folders that arrive are shown: the store replaces by id, and turns the folders view on
      if (folders.length)
        useFolderStore.getState().importFoldersAppend(folders, true);
      return { failed: [] };
    },
  };
}
