import type { StateCreator } from 'zustand/vanilla';

import type { DMetaReferenceItem } from '~/common/stores/chat/chat.message';


/// Chat Overlay Store: per-chat overlay state ///

/**
 * Content parts held for the next message OUTSIDE the attachment pipeline - added by
 * input enhancers (e.g. a pasted video URL), rendered as chips, harvested at send.
 *
 * DELIBERATELY a structural subset of chat.fragments' DMessageHostedResourcePart (url arm),
 * so this store carries no dependency on the chat parts vocabulary. Assignability is enforced
 * at the send seam: the Composer harvests these via createHostedResourceContentFragment(part.resource),
 * which type-errors if the shapes ever drift. Widen (or re-alias to the real union) when an
 * enhancer needs to carry a non-URL part.
 */
export type DComposerPendingPart = {
  pt: 'hosted_resource',
  resource: {
    via: 'url',
    url: string,                                // canonical identity: normalized YouTube watch URL or direct https media URL
    mediaKind: 'video',                         // future: 'audio'
    mimeType?: string,                          // set for direct media URLs (e.g. 'video/mp4'); absent for YouTube
    // FUTURE (no producer yet; kept FLAT so plain {...spread} recreates the resource):
    // clipStartSec?: number,
    // clipEndSec?: number,
    // fps?: number,
  },
};

interface ComposerOverlayState {

  // list of all the references that the composer is holding to, before sending them out in the next message
  inReferenceTo: DMetaReferenceItem[];

  // content parts held for the next message (same lifecycle as inReferenceTo: chip -> send -> clear)
  pendingParts: DComposerPendingPart[];

}

export interface ComposerOverlayStore extends ComposerOverlayState {

  addInReferenceTo: (item: DMetaReferenceItem) => void;
  removeInReferenceTo: (item: DMetaReferenceItem) => void;
  clearInReferenceTo: () => void;

  addPendingPart: (part: DComposerPendingPart) => void;
  removePendingPart: (part: DComposerPendingPart) => void;
  clearPendingParts: () => void;

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
  pendingParts: [],

  // actions
  addInReferenceTo: (item) => _set(state => ({
    inReferenceTo: [...state.inReferenceTo, item],
  })),

  removeInReferenceTo: (item) => _set(state => ({
    inReferenceTo: state.inReferenceTo.filter((i) => i !== item),
  })),

  clearInReferenceTo: () => _set({ inReferenceTo: [] }),

  addPendingPart: (part) => _set(state => {
    // dedupe by URL (re-pasting the same link is a no-op)
    if (state.pendingParts.some(p => p.resource.url === part.resource.url))
      return state;
    return { pendingParts: [...state.pendingParts, part] };
  }),

  removePendingPart: (part) => _set(state => ({
    pendingParts: state.pendingParts.filter((p) => p !== part),
  })),

  clearPendingParts: () => _set({ pendingParts: [] }),

});
