import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';


interface ChatLinkItem {
  chatTitle?: string;
  objectId: string;
  createdAt: string;
  expiresAt: string | null;
  deletionKey: string;
}

interface ModuleTradeStore {

  // exported items
  chatLinkItems: ChatLinkItem[];
  rememberChatLinkItem: (chatTitle: string | undefined, objectId: string, createdAt: Date, expiresAt: Date | null, deletionKey: string) => void;
  forgetChatLinkItem: (objectId: string) => void;
  updateChatLinkDeletionKey: (objectId: string, deletionKey: string) => void;

  // ID assigned by the server upon first PUT
  linkStorageOwnerId: string | undefined;
  setLinkStorageOwnerId: (linkStorageOwnerId: string) => void;

}

const useTradeStore = create<ModuleTradeStore>()(
  persist(
    (set) => ({

      chatLinkItems: [],
      rememberChatLinkItem: (chatTitle: string | undefined, objectId: string, createdAt: Date, expiresAt: Date | null, deletionKey: string) => set(state => ({
        chatLinkItems: [...state.chatLinkItems, { chatTitle, objectId, createdAt: createdAt.toISOString(), expiresAt: expiresAt?.toISOString() ?? null, deletionKey }],
      })),
      forgetChatLinkItem: (objectId: string) => set(state => ({
        chatLinkItems: state.chatLinkItems.filter(item => item.objectId !== objectId),
      })),
      updateChatLinkDeletionKey: (objectId: string, deletionKey: string) => set(state => ({
        chatLinkItems: state.chatLinkItems.map(item => item.objectId === objectId ? { ...item, deletionKey } : item),
      })),

      linkStorageOwnerId: undefined,
      setLinkStorageOwnerId: (linkStorageOwnerId: string) => set({ linkStorageOwnerId }),

    }),
    {
      name: 'app-sharing',
    },
  ),
);


// by AppChatLink
export const useChatLinkItems = () => useTradeStore(state => state.chatLinkItems, shallow);
export const useHasChatLinkItems = () => useTradeStore(state => state.chatLinkItems.length > 0);

// by ChatLinkExport
export const useLinkStorageOwnerId = () =>
  useTradeStore(state => ({
    linkStorageOwnerId: state.linkStorageOwnerId,
    setLinkStorageOwnerId: state.setLinkStorageOwnerId,
  }), shallow);
export const rememberChatLinkItem = useTradeStore.getState().rememberChatLinkItem;
export const forgetChatLinkItem = useTradeStore.getState().forgetChatLinkItem;
export const updateChatLinkDeletionKey = useTradeStore.getState().updateChatLinkDeletionKey;
export const hasNoChatLinkItems = () => !useTradeStore.getState().chatLinkItems.length;
