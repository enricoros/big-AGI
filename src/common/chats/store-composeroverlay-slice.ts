import type { StateCreator } from 'zustand/vanilla';


/// Chat Overlay Store: per-chat overlay state ///

interface ComposerOverlayState {

  // if set, this is the 'reply to' mode text
  replyToText: string | null;

}

export interface ComposerOverlayStore extends ComposerOverlayState {

  setReplyToText: (text: string | null) => void;

}

/**
 * NOTE: the Composer state is managed primarily by the component, however there's some state that's:
 *  - associated with the chat (e.g. reply-to text)
 *  - persisted across chats
 *
 * This slice manages the reply-to text state, but there's also a sister slice that manages the attachment drafts.
 */
export const createComposerOverlayStoreSlice: StateCreator<ComposerOverlayStore, [], [], ComposerOverlayStore> = (_set, _get) => ({

  // init state
  replyToText: null,

  // actions
  setReplyToText: (text: string | null) => _set({ replyToText: text }),

});