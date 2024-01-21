import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';


// Call settings

interface AppCallStore {
  grayUI: boolean;
  toggleGrayUI: () => void;
}

const useAppCallStore = create<AppCallStore>()(persist(
  (_set, _get) => ({

    grayUI: false,
    toggleGrayUI: () => _set(state => ({ grayUI: !state.grayUI })),

  }), {
    name: 'app-app-call',
  },
));


export const useCallToggleGrayUI = () =>
  useAppCallStore(state => ({
    callGrayUI: state.grayUI,
    callToggleGrayUI: () => state.toggleGrayUI(),
  }), shallow);
