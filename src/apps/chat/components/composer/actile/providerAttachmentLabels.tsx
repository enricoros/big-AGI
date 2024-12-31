import type { ActileItem, ActileProvider, ActileProviderItems } from './ActileProvider';

import type { AttachmentDraftsStoreApi } from '~/common/attachment-drafts/store-perchat-attachment-drafts_slice';

export interface AttachmentLabelItem extends ActileItem {
  // nothing to do do here, this is really just a label
}

export const providerAttachmentLabels = (
  attachmentsStoreApi: AttachmentDraftsStoreApi | null,
  onLabelSelect: (item: ActileItem, searchPrefix: string) => void,
): ActileProvider<AttachmentLabelItem> => ({

  key: 'pattlbl',

  get label() {
    return 'Attachment Labels';
  },

  // Uses '@' as the trigger
  fastCheckTriggerText: (trailingText: string) => trailingText === '@' || trailingText.endsWith(' @'),

  fetchItems: async (): ActileProviderItems<AttachmentLabelItem> => ({
    searchPrefix: '',
    items: attachmentsStoreApi?.getState()?.attachmentDrafts.map(draft => ({
      key: draft.id,
      providerKey: 'pattlbl',
      label: draft.label,
      argument: undefined,
      description: 'name',
      Icon: undefined,
    } as AttachmentLabelItem)) ?? [],
  }),

  onItemSelect: item => onLabelSelect(item as AttachmentLabelItem, '@'),

});