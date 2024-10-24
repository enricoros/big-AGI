import { StoreApi, useStore } from 'zustand';
import { createStore as createVanillaStore } from 'zustand/vanilla';

import { AttachmentsDraftsStore, createAttachmentDraftsStoreSlice } from '~/common/attachment-drafts/store-perchat-attachment-drafts_slice';
import { ComposerOverlayStore, createComposerOverlayStoreSlice } from './store-perchat-composer_slice';
import { createEphemeralsOverlayStoreSlice, EphemeralsOverlayStore } from './store-perchat-ephemerals_slice';
import { createVariformOverlayStoreSlice, VariformOverlayStore } from './store-perchat-variform_slice';


/* Per-chat overlay store, combining all the slices.
 * No need to merge all the slices into one object, as the store is a function.
 *
 * This is for now, but if performance is an issue, we can split it back into independent
 * vanilla stores, and just instantiate many of them per each ConversationHandler.
 */
export type PerChatOverlayStore = AttachmentsDraftsStore & ComposerOverlayStore & EphemeralsOverlayStore & VariformOverlayStore;

/* Note: at this time there is another overlay stores, beam (vanilla).
 * - EphemeralsStore was based on EventTarget and subscription/unsubscription to it (inside useEffect),
 *   using `eventUtils` but it's been ported now.
 */
export const createPerChatVanillaStore = (): StoreApi<PerChatOverlayStore> => createVanillaStore<PerChatOverlayStore>()((...a) => ({

  // Attachments: attachment drafts
  ...createAttachmentDraftsStoreSlice(...a),
  // Composer: in-reference-to
  ...createComposerOverlayStoreSlice(...a),
  // Ephemerals: ephemeral messages (ReAct sidebars)
  ...createEphemeralsOverlayStoreSlice(...a),
  // VariForm: form values
  ...createVariformOverlayStoreSlice(...a),

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
