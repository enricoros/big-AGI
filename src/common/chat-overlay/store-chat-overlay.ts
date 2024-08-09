import { StoreApi, useStore } from 'zustand';
import { createStore as createVanillaStore } from 'zustand/vanilla';

import { AttachmentsDraftsStore, createAttachmentDraftsStoreSlice } from '~/common/attachment-drafts/store-attachment-drafts-slice';
import { ComposerOverlayStore, createComposerOverlayStoreSlice } from './store-composeroverlay-slice';
import { createEphemeralsOverlayStoreSlice, EphemeralsOverlayStore } from './store-ephemeralsoverlay-slice';


/* Per-chat overlay store, combining all the slices.
 * No need to merge all the slices into one object, as the store is a function.
 *
 * This is for now, but if performance is an issue, we can split it back into independent
 * vanilla stores, and just instantiate many of them per each ConversationHandler.
 */
type PerChatOverlayStore = AttachmentsDraftsStore & ComposerOverlayStore & EphemeralsOverlayStore;

/* Note: at this time there is another overlay stores, beam (vanilla).
 * - EphemeralsStore was based on EventTarget and subscription/unsubscription to it (inside useEffect),
 *   using `eventUtils` but it's been ported now.
 */
export const createPerChatVanillaStore = (): StoreApi<PerChatOverlayStore> => createVanillaStore<PerChatOverlayStore>()((...a) => ({

  ...createAttachmentDraftsStoreSlice(...a),
  ...createComposerOverlayStoreSlice(...a),
  ...createEphemeralsOverlayStoreSlice(...a),

}));


const fallbackStoreApi = createPerChatVanillaStore();

// usages: ChatMessagesList
export const useChatOverlayStore = <T, >(vanillaStore: Readonly<StoreApi<PerChatOverlayStore>> | null, selector: (store: PerChatOverlayStore) => T): T =>
  useStore(vanillaStore || fallbackStoreApi, selector);

// usages: useAttachmentDrafts
export const useChatAttachmentsStore = <T, >(vanillaStore: Readonly<StoreApi<AttachmentsDraftsStore>> | null, selector: (store: AttachmentsDraftsStore) => T): T =>
  useStore(vanillaStore || fallbackStoreApi, selector);

// usages: Composer
export const useChatComposerOverlayStore = <T, >(vanillaStore: Readonly<StoreApi<ComposerOverlayStore>> | null, selector: (store: ComposerOverlayStore) => T): T =>
  useStore(vanillaStore || fallbackStoreApi, selector);
