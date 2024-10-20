import type { StateCreator } from 'zustand/vanilla';


/// Chat Overlay Store: per-chat overlay state ///

interface VariformOverlayState {

  variformValues: Record<string, string>;

}

export interface VariformOverlayStore extends VariformOverlayState {

  setVariformValue: (key: string, value: string) => void;
  clearVariformValue: (key: string) => void;

}


export const createVariformOverlayStoreSlice: StateCreator<VariformOverlayStore, [], [], VariformOverlayStore> = (_set, _get) => ({

  // init state
  variformValues: {},

  // actions
  setVariformValue: (key, value) => _set(state => ({
    variformValues: { ...state.variformValues, [key]: value },
  })),
  clearVariformValue: (key) => _set(state => {
    const { [key]: _, ...rest } = state.variformValues;
    return { variformValues: rest };
  }),

});
