import { create } from 'zustand';
import { persist } from 'zustand/middleware';


interface ChatLinkItem {
  chatTitle?: string;
  objectId: string;
  createdAt: Date;
  expiresAt: Date | null;
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
        chatLinkItems: [...state.chatLinkItems, { chatTitle, objectId, createdAt, expiresAt, deletionKey }],
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

export function useLinkStorageOwnerId() {
  return {
    linkStorageOwnerId: useTradeStore(state => state.linkStorageOwnerId),
    setLinkStorageOwnerId: useTradeStore.getState().setLinkStorageOwnerId,
  };
}

export const addChatLinkItem = useTradeStore.getState().addChatLinkItem;
export const removeChatLinkItem = useTradeStore.getState().removeChatLinkItem;