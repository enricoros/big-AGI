import { create } from 'zustand';


interface GlobalDragState {

  // is something dragged over the window
  isWindowDragActive: boolean;

  // for potential filtering
  dragHasFiles: boolean;

}

export const useGlobalDragStore = create<GlobalDragState>((_set) => ({

  // initial state

  isWindowDragActive: false,
  dragHasFiles: false,

}));
