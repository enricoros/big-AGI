import { Attachment, AttachmentId, AttachmentSource } from './attachment.types';
import { create } from 'zustand';
import { createBase36Uid } from '~/common/util/textUtils';


interface AttachmentsStore {

  attachments: Attachment[];

  createAttachment: (sources: AttachmentSource) => void;
  clearAttachments: () => void;
  removeAttachment: (attachmentId: AttachmentId) => void;

}

export const useAttachmentsStore = create<AttachmentsStore>()(
  (_set, _get) => ({

    attachments: [],

    createAttachment: (source: AttachmentSource) => {
      const { attachments } = _get();
      const attachment = createAttachment(source, attachments.map(a => a.id));

      _set({
        attachments: [...attachments, attachment],
      });

      console.log('createAttachment!!!');
    },

    clearAttachments: () => _set({
      attachments: [],
    }),

    removeAttachment: (attachmentId: AttachmentId) =>
      _set(state => ({
        attachments: state.attachments.filter(attachment => attachment.id !== attachmentId),
      })),

  }),
);


export function createAttachment(source: AttachmentSource, checkDuplicates: AttachmentId[]): Attachment {
  return {
    id: createBase36Uid(checkDuplicates),
    label: undefined,
    source: source,
    input: undefined,
    availableConversions: undefined,
    conversion: undefined,
    output: undefined,
    metadata: {},
  };
}