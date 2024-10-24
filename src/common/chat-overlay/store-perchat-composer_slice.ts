import type { StateCreator } from 'zustand/vanilla';

import type { DMetaReferenceItem } from '~/common/stores/chat/chat.message';


/// Chat Overlay Store: per-chat overlay state ///

interface ComposerOverlayState {

  // list of all the references that the composer is holding to, before sending them out in the next message
  inReferenceTo: DMetaReferenceItem[];

}

export interface ComposerOverlayStore extends ComposerOverlayState {

  addInReferenceTo: (item: DMetaReferenceItem) => void;
  removeInReferenceTo: (item: DMetaReferenceItem) => void;
  clearInReferenceTo: () => void;

}


/**
 * NOTE: the Composer state is managed primarily by the component, however there's some state that's:
 *  - associated with the chat (e.g. in-reference-to text)
 *  - persisted across chats
 *
 * This slice manages the in-reference-to text state, but there's also a sister slice that manages the attachment drafts.
 */
export const createComposerOverlayStoreSlice: StateCreator<ComposerOverlayStore, [], [], ComposerOverlayStore> = (_set, _get) => ({

  // init state
  inReferenceTo: [],

  // actions
  addInReferenceTo: (item) => _set(state => ({
    inReferenceTo: [...state.inReferenceTo, item],
  })),

  removeInReferenceTo: (item) => _set(state => ({
    inReferenceTo: state.inReferenceTo.filter((i) => i !== item),
  })),

  clearInReferenceTo: () => _set({ inReferenceTo: [] }),

});
