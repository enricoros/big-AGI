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

interface TradeStore {

  // ID assigned by the server upon first PUT
  linkStorageOwnerId: string | undefined;
  setLinkStorageOwnerId: (linkStorageOwnerId: string) => void;

  // exported items
  chatLinkItems: ChatLinkItem[];
  addChatLinkItem: (chatTitle: string | undefined, objectId: string, createdAt: Date, expiresAt: Date | null, deletionKey: string) => void;
  removeChatLinkItem: (objectId: string) => void;

}

const useTradeStore = create<TradeStore>()(
  persist(
    (set) => ({

      linkStorageOwnerId: undefined,
      setLinkStorageOwnerId: (linkStorageOwnerId: string) => set({ linkStorageOwnerId }),

      chatLinkItems: [],
      addChatLinkItem: (chatTitle: string | undefined, objectId: string, createdAt: Date, expiresAt: Date | null, deletionKey: string) => set(state => ({
        chatLinkItems: [...state.chatLinkItems, { chatTitle, objectId, createdAt: createdAt.toISOString(), expiresAt: expiresAt?.toISOString() ?? null, deletionKey }],
      })),
      removeChatLinkItem: (objectId: string) => set(state => ({
        chatLinkItems: state.chatLinkItems.filter(item => item.objectId !== objectId),
      })),

    }),
    {
      name: 'app-trade',
    },
  ),
);

export const useLinkStorageOwnerId = () => ({
  linkStorageOwnerId: useTradeStore(state => state.linkStorageOwnerId),
  setLinkStorageOwnerId: useTradeStore.getState().setLinkStorageOwnerId,
});


export const useChatLinkItems = () => useTradeStore(state => state.chatLinkItems, shallow);
export const useHasChatLinkItems = () => useTradeStore(state => state.chatLinkItems.length > 0);
export const addChatLinkItem = useTradeStore.getState().addChatLinkItem;
export const removeChatLinkItem = useTradeStore.getState().removeChatLinkItem;
