import { StoreApi, useStore } from 'zustand';
import { createStore, StateCreator } from 'zustand/vanilla';


/// Composer Slice: per-chat composer overlay state ///

interface ComposerOverlayState {

  // if set, this is the 'reply to' mode text
  replyToText: string | null;

}

const initComposerOverlayStateSlice = (): ComposerOverlayState => ({

  replyToText: null,

});

interface ComposerOverlayStore extends ComposerOverlayState {

  setReplyToText: (text: string | null) => void;

}

const createComposerOverlayStoreSlice: StateCreator<ComposerOverlayStore, [], [], ComposerOverlayStore> = (_set, _get) => ({

  // init state
  ...initComposerOverlayStateSlice(),

  // actions
  setReplyToText: (text: string | null) => _set({ replyToText: text }),

});


/// Chat Overlay Store: per-chat overlay state ///
// Note: at this time there are numerous overlay stores, including beam (vanilla), ephemerals (EventTarget), and this one.

export type OverlayStore = ComposerOverlayStore;

export type OverlayStoreApi = Readonly<StoreApi<OverlayStore>>;

export const createChatOverlayVanillaStore = () => createStore<OverlayStore>()((...a) => ({

  ...createComposerOverlayStoreSlice(...a),

}));


const fallbackOverlayStore = createChatOverlayVanillaStore();

export const useChatOverlayStore = <T, >(vanillaStore: OverlayStoreApi | null, selector: (store: OverlayStore) => T): T =>
  useStore(vanillaStore || fallbackOverlayStore, selector);
