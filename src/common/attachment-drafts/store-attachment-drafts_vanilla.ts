import type { StoreApi } from 'zustand';
import { createStore as createVanillaStore } from 'zustand/vanilla';

import { AttachmentsDraftsStore, createAttachmentDraftsStoreSlice } from './store-attachment-drafts_slice';


export const createAttachmentDraftsVanillaStore = (): StoreApi<AttachmentsDraftsStore> => createVanillaStore<AttachmentsDraftsStore>()((...a) => ({

  // Attachments: attachment drafts
  ...createAttachmentDraftsStoreSlice(...a),

}));


// const _fallbackStoreApi = createPerChatVanillaStore();

// // usages: useAttachmentDrafts
// export const useChatAttachmentsStore = <T, >(vanillaStore: Readonly<StoreApi<AttachmentsDraftsStore>> | null, selector: (store: AttachmentsDraftsStore) => T): T =>
//   useStore(vanillaStore || fallbackStoreApi, selector);
