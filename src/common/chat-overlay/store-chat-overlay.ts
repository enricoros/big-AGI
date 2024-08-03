import { StoreApi, useStore } from 'zustand';
import { createStore as createVanillaStore } from 'zustand/vanilla';

import { AttachmentDraftsStoreApi, AttachmentsDraftsStore, createAttachmentDraftsStoreSlice } from '~/common/attachment-drafts/store-attachment-drafts-slice';
import { ComposerOverlayStore, createComposerOverlayStoreSlice } from './store-composeroverlay-slice';


// Note: at this time there are numerous overlay stores, including beam (vanilla), ephemerals (EventTarget), and this one.

type PerChatOverlayStore = ComposerOverlayStore & AttachmentsDraftsStore;

export const createPerChatVanillaStore = () => createVanillaStore<PerChatOverlayStore>()((...a) => ({

  ...createAttachmentDraftsStoreSlice(...a),
  ...createComposerOverlayStoreSlice(...a),

}));


const fallbackStoreApi = createPerChatVanillaStore();

export const useChatOverlayStore = <T, >(vanillaStore: Readonly<StoreApi<PerChatOverlayStore>> | null, selector: (store: PerChatOverlayStore) => T): T =>
  useStore(vanillaStore || fallbackStoreApi, selector);

export const useChatAttachmentsStore = <T, >(vanillaStore: Readonly<AttachmentDraftsStoreApi> | null, selector: (store: AttachmentsDraftsStore) => T): T =>
  useStore(vanillaStore || fallbackStoreApi, selector);
