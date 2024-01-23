import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';


export interface SharedChatLinkItem {
  chatTitle?: string;
  objectId: string;
  createdAt: string;
  expiresAt: string | null;
  deletionKey: string;
}

interface LinkStore {

  // exported items
  chatLinkItems: SharedChatLinkItem[];
  chatLinkItemAdd: (chatTitle: string | undefined, objectId: string, createdAt: Date, expiresAt: Date | null, deletionKey: string) => void;
  chatLinkItemRemove: (objectId: string) => void;
  chatLinkItemChangeDeletionKey: (objectId: string, deletionKey: string) => void;

  // ID assigned by the server upon first PUT
  linkStorageOwnerId: string | undefined;
  setLinkStorageOwnerId: (linkStorageOwnerId: string) => void;

}

const useLinkStore = create<LinkStore>()(
  persist(
    (set) => ({

      chatLinkItems: [],
      chatLinkItemAdd: (chatTitle: string | undefined, objectId: string, createdAt: Date, expiresAt: Date | null, deletionKey: string) => set(state => ({
        chatLinkItems: [...state.chatLinkItems, { chatTitle, objectId, createdAt: createdAt.toISOString(), expiresAt: expiresAt?.toISOString() ?? null, deletionKey }],
      })),
      chatLinkItemRemove: (objectId: string) => set(state => ({
        chatLinkItems: state.chatLinkItems.filter(item => item.objectId !== objectId),
      })),
      chatLinkItemChangeDeletionKey: (objectId: string, deletionKey: string) => set(state => ({
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
export const useSharedChatLinkItems = () => useLinkStore(state => state.chatLinkItems, shallow);

// by ChatLinkExport/ChatLinkDetails
export const rememberChatLinkItem = useLinkStore.getState().chatLinkItemAdd;
export const updateChatLinkDeletionKey = useLinkStore.getState().chatLinkItemChangeDeletionKey;
export const forgetChatLinkItem = useLinkStore.getState().chatLinkItemRemove;
export const useLinkStorageOwnerId = () => useLinkStore(state => ({
  linkStorageOwnerId: state.linkStorageOwnerId,
  setLinkStorageOwnerId: state.setLinkStorageOwnerId,
}), shallow);

// by Nav
export function hasNoChatLinkItems() {
  return !useLinkStore.getState().chatLinkItems.length;
}
