import { create } from 'zustand';
import { shallow } from 'zustand/shallow';

interface AppChatState {

  showTextDiff: boolean;
  setShowTextDiff: (showTextDiff: boolean) => void;

}

const useAppChatStore = create<AppChatState>()(
  (set) => ({

    showTextDiff: false,
    setShowTextDiff: (showTextDiff: boolean) => set({ showTextDiff }),

  }),
);

export const useChatMessageShowDiff = (): [boolean, (showDiff: boolean) => void] =>
  useAppChatStore(state => [state.showTextDiff, state.setShowTextDiff], shallow);
