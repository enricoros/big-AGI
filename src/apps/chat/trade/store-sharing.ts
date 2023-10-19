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

interface StoreSharing {

  // ID assigned by the server upon first PUT
  linkStorageOwnerId: string | undefined;
  setLinkStorageOwnerId: (linkStorageOwnerId: string) => void;

  // exported items
  chatLinkItems: ChatLinkItem[];
  addChatLinkItem: (chatTitle: string | undefined, objectId: string, createdAt: Date, expiresAt: Date | null, deletionKey: string) => void;
  removeChatLinkItem: (objectId: string) => void;

}

const useSharingStore = create<StoreSharing>()(
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
      name: 'app-sharing',
    },
  ),
);

export const useLinkStorageOwnerId = () => ({
  linkStorageOwnerId: useSharingStore(state => state.linkStorageOwnerId),
  setLinkStorageOwnerId: useSharingStore.getState().setLinkStorageOwnerId,
});


export const useChatLinkItems = () => useSharingStore(state => state.chatLinkItems, shallow);
export const useHasChatLinkItems = () => useSharingStore(state => state.chatLinkItems.length > 0);
export const addChatLinkItem = useSharingStore.getState().addChatLinkItem;
export const removeChatLinkItem = useSharingStore.getState().removeChatLinkItem;
