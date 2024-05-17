import { create } from 'zustand';

import type { Attachment, AttachmentId, AttachmentSource } from './attachment.types';
import { attachmentCreate, attachmentDefineConverters, attachmentLoadInputAsync, attachmentPerformConversion } from './attachment.pipeline';


/// Store

interface AttachmentsState {
  attachments: Attachment[];
}

interface AttachmentsStore extends AttachmentsState {

  createAttachment: (source: AttachmentSource) => Promise<void>;
  clearAttachments: () => void;
  removeAttachment: (attachmentId: AttachmentId) => void;
  moveAttachment: (attachmentId: AttachmentId, delta: 1 | -1) => void;
  setConverterIdxAndConvert: (attachmentId: AttachmentId, converterIdx: number | null) => Promise<void>;

  _editAttachment: (attachmentId: AttachmentId, update: Partial<Attachment> | ((attachment: Attachment) => Partial<Attachment>)) => void;
  _getAttachment: (attachmentId: AttachmentId) => Attachment | undefined;

}

export const useAttachmentsStore = create<AttachmentsStore>()(
  (_set, _get) => ({

    attachments: [],

    createAttachment: async (source: AttachmentSource) => {
      const { _getAttachment, _editAttachment, setConverterIdxAndConvert } = _get();

      const _attachment = attachmentCreate(source);
      _set(store => ({
        attachments: [...store.attachments, _attachment],
      }));

      const attachmentId = _attachment.id;
      const editFn = (changes: Partial<Attachment>) => _editAttachment(attachmentId, changes);

      // 1.Resolve the Input
      await attachmentLoadInputAsync(source, editFn);
      const loaded = _getAttachment(attachmentId);
      if (!loaded?.input)
        return;

      // 2. Define the I->O Converters
      attachmentDefineConverters(source.media, loaded.input, editFn);
      const defined = _getAttachment(attachmentId);
      if (!defined?.converters.length || defined.converterIdx !== null)
        return;

      // 3. Select the first Converter
      const firstEnabledIndex = defined.converters.findIndex(_c => !_c.disabled);
      await setConverterIdxAndConvert(attachmentId, firstEnabledIndex > -1 ? firstEnabledIndex : 0);
    },

    clearAttachments: () => _set({
      attachments: [],
    }),

    removeAttachment: (attachmentId: AttachmentId) =>
      _set(state => ({
        attachments: state.attachments.filter(attachment => attachment.id !== attachmentId),
      })),

    moveAttachment: (attachmentId: AttachmentId, delta: 1 | -1) =>
      _set(state => {
        const attachments = [...state.attachments];
        const currentIdx = attachments.findIndex(a => a.id === attachmentId);

        // If the attachment is not found, or if trying to move beyond the array boundaries, no move is needed
        if (currentIdx === -1 || (currentIdx === 0 && delta === -1) || (currentIdx === attachments.length - 1 && delta === 1))
          return state;

        // Swap the attachment with the adjacent one in the direction of delta
        const targetIdx = currentIdx + delta;
        [attachments[currentIdx], attachments[targetIdx]] = [attachments[targetIdx], attachments[currentIdx]];

        return { attachments };
      }),

    setConverterIdxAndConvert: async (attachmentId: AttachmentId, converterIdx: number | null) => {
      const { _getAttachment, _editAttachment } = _get();
      const attachment = _getAttachment(attachmentId);
      if (!attachment || attachment.converterIdx === converterIdx)
        return;

      const editFn = (changes: Partial<Attachment>) => _editAttachment(attachmentId, changes);

      await attachmentPerformConversion(attachment, converterIdx, editFn);
    },

    _editAttachment: (attachmentId: AttachmentId, update: Partial<Attachment> | ((attachment: Attachment) => Partial<Attachment>)) =>
      _set(state => ({
        attachments: state.attachments.map((attachment: Attachment): Attachment =>
          attachment.id === attachmentId
            ? { ...attachment, ...(typeof update === 'function' ? update(attachment) : update) }
            : attachment,
        ),
      })),

    _getAttachment: (attachmentId: AttachmentId) =>
      _get().attachments.find(a => a.id === attachmentId),

  }),
);
