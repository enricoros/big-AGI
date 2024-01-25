import { create } from 'zustand';
import { persist } from 'zustand/middleware';


// Call settings

interface AppCallStore {

  grayUI: boolean;
  toggleGrayUI: () => void;

  showConversations: boolean;
  toggleShowConversations: () => void;

  showSupport: boolean;
  toggleShowSupport: () => void;

}

export const useAppCallStore = create<AppCallStore>()(persist(
  (_set, _get) => ({

    grayUI: false,
    toggleGrayUI: () => _set(state => ({ grayUI: !state.grayUI })),

    showConversations: true,
    toggleShowConversations: () => _set(state => ({ showConversations: !state.showConversations })),

    showSupport: true,
    toggleShowSupport: () => _set(state => ({ showSupport: !state.showSupport })),

  }), {
    name: 'app-app-call',
  },
));
