import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TradeStore {

  // ID assigned by the server upon first PUT
  linkStorageOwnerId: string | undefined;
  setLinkStorageOwnerId: (linkStorageOwnerId: string) => void;

}

const useTradeStore = create<TradeStore>()(
  persist(
    (set) => ({

      linkStorageOwnerId: undefined,
      setLinkStorageOwnerId: (linkStorageOwnerId: string) => set({ linkStorageOwnerId }),

    }),
    {
      name: 'app-export',
    },
  ),
);

export function useLinkStorageOwnerId() {
  return {
    linkStorageOwnerId: useTradeStore(state => state.linkStorageOwnerId),
    setLinkStorageOwnerId: useTradeStore.getState().setLinkStorageOwnerId,
  };
}