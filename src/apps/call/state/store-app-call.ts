import { create } from 'zustand';
import { persist } from 'zustand/middleware';


// Call settings

interface AppCallStore {

  // end-of-turn: silence after the last recognized words before the sentence is sent (Web Speech has no such knob - this is our timer)
  sendAfterMs: number;
  setSendAfterMs: (sendAfterMs: number) => void;
  // 'global' follows the chat Mic Timeout (Settings > Voice); sendAfterMs is kept for switching back to 'custom'
  sendAfterMode: 'global' | 'custom';
  setSendAfterMode: (sendAfterMode: 'global' | 'custom') => void;

  grayUI: boolean;
  toggleGrayUI: () => void;

  showConversations: boolean;
  toggleShowConversations: () => void;

  showSupport: boolean;
  toggleShowSupport: () => void;

}

export const useAppCallStore = create<AppCallStore>()(persist(
  (_set, _get) => ({

    sendAfterMs: 2000,
    setSendAfterMs: (sendAfterMs: number) => _set({ sendAfterMs }),
    sendAfterMode: 'custom',
    setSendAfterMode: (sendAfterMode) => _set({ sendAfterMode }),

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
