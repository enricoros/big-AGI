import { createStore as createVanillaStore } from 'zustand/vanilla';

import { AttachmentDraftsStoreApi, AttachmentsDraftsStore, createAttachmentDraftsStoreSlice } from './store-attachment-drafts_slice';


export const createAttachmentDraftsVanillaStore = (): AttachmentDraftsStoreApi => createVanillaStore<AttachmentsDraftsStore>()((...a) => ({

  // Attachments: attachment drafts
  ...createAttachmentDraftsStoreSlice(...a),

}));


// const _fallbackStoreApi = createPerChatVanillaStore();

// // usages: useAttachmentDrafts
// export const useChatAttachmentsStore = <T, >(vanillaStore: Readonly<AttachmentDraftsStoreApi> | null, selector: (store: AttachmentsDraftsStore) => T): T =>
//   useStore(vanillaStore || fallbackStoreApi, selector);
