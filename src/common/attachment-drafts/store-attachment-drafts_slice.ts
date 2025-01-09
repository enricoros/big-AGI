import type { StoreApi } from 'zustand';
import type { StateCreator } from 'zustand/vanilla';

import type { DBlobDBContextId, DBlobDBScopeId } from '~/modules/dblobs/dblobs.types';

import type { DMessageAttachmentFragment } from '~/common/stores/chat/chat.fragments';

import type { AttachmentCreationOptions, AttachmentDraft, AttachmentDraftConverter, AttachmentDraftId, AttachmentDraftSource } from './attachment.types';
import { attachmentCreate, attachmentDefineConverters, attachmentLoadInputAsync, attachmentPerformConversion } from './attachment.pipeline';
import { removeAttachmentOwnedDBAsset, transferAttachmentOwnedDBAsset } from './attachment.dblobs';


/// Attachment Draft Slice: per-conversation attachments store ///

interface AttachmentDraftsState {

  attachmentDrafts: AttachmentDraft[];

}

export interface AttachmentsDraftsStore extends AttachmentDraftsState {

  createAttachmentDraft: (source: AttachmentDraftSource, options: AttachmentCreationOptions) => Promise<void>;
  removeAllAttachmentDrafts: () => void;
  removeAttachmentDraft: (attachmentDraftId: AttachmentDraftId) => void;
  moveAttachmentDraft: (attachmentDraftId: AttachmentDraftId, delta: 1 | -1) => void;
  toggleAttachmentDraftConverterAndConvert: (attachmentDraftId: AttachmentDraftId, converterIdx: number | null) => Promise<void>;

  /**
   * Extracts all fragments from the all drafts and transfers ownership to the caller.
   * This store is cleared.
   */
  takeAllFragments: (newContextId: DBlobDBContextId, newScopeId: DBlobDBScopeId) => Promise<DMessageAttachmentFragment[]>;

  /**
   * Extracts typed fragments from the attachment drafts and optionally removes them from the store.
   * If `attachmentDraftId` is null, all the attachments are processed, otherwise only this.
   */
  takeFragmentsByType: (fragmentsType: DMessageAttachmentFragment['part']['pt'], attachmentDraftId: AttachmentDraftId | null, removeFragments: boolean) => DMessageAttachmentFragment[];

  removeAttachmentDraftOutputFragment: (attachmentDraftId: AttachmentDraftId, fragmentIndex: number) => void;

  _editAttachment: (attachmentDraftId: AttachmentDraftId, update: Partial<Omit<AttachmentDraft, 'outputFragments'>> | ((attachment: AttachmentDraft) => Partial<Omit<AttachmentDraft, 'outputFragments'>>)) => void;
  _replaceAttachmentOutputFragments: (attachmentDraftId: AttachmentDraftId, outputFragments: DMessageAttachmentFragment[]) => void;
  _getAttachment: (attachmentDraftId: AttachmentDraftId) => AttachmentDraft | undefined;

}

export type AttachmentDraftsStoreApi = StoreApi<AttachmentsDraftsStore>;

export const createAttachmentDraftsStoreSlice: StateCreator<AttachmentsDraftsStore, [], [], AttachmentsDraftsStore> = (_set, _get) => ({

  // init state
  attachmentDrafts: [],

  // actions
  createAttachmentDraft: async (source: AttachmentDraftSource, options: AttachmentCreationOptions) => {
    const { _getAttachment, _editAttachment, toggleAttachmentDraftConverterAndConvert } = _get();

    const _attachmentDraft = attachmentCreate(source);
    _set(store => ({
      attachmentDrafts: [...store.attachmentDrafts, _attachmentDraft],
    }));

    const attachmentDraftId = _attachmentDraft.id;
    const editFn = (changes: Partial<Omit<AttachmentDraft, 'outputFragments'>>) => _editAttachment(attachmentDraftId, changes);

    // 1.Resolve the Input
    await attachmentLoadInputAsync(source, editFn);
    const loaded = _getAttachment(attachmentDraftId);
    if (!loaded?.input)
      return;

    // 2. Define the I->O Converters
    attachmentDefineConverters(source, loaded.input, options, editFn);
    const defined = _getAttachment(attachmentDraftId);
    if (!defined?.converters.length)
      return;

    // 3. Select the already active, or the first (non-disabled) Converter
    let cIndex = defined.converters.findIndex(_c => _c.isActive);
    if (cIndex === -1)
      cIndex = defined.converters.findIndex(_c => !_c.disabled);
    if (cIndex === -1)
      cIndex = 0;
    await toggleAttachmentDraftConverterAndConvert(attachmentDraftId, cIndex);
  },

  removeAllAttachmentDrafts: () =>
    _set(state => {

      // remove the associated DBlob items, as we still ahve
      for (const attachmentDraft of state.attachmentDrafts) {
        // Remove the DBlob items associated with the removed fragments
        for (let removedFragment of attachmentDraft.outputFragments) {
          void removeAttachmentOwnedDBAsset(removedFragment);
        }
      }

      return {
        attachmentDrafts: [],
      };
    }),

  removeAttachmentDraft: (attachmentDraftId: AttachmentDraftId) =>
    _set(state => ({
      attachmentDrafts: state.attachmentDrafts.filter(attachment => {
        if (attachment.id !== attachmentDraftId)
          return true;

        // Remove the DBlob items associated with the removed fragments
        for (let removedFragment of attachment.outputFragments) {
          void removeAttachmentOwnedDBAsset(removedFragment);
        }

        // Remove the draft
        return false;
      }),
    })),

  moveAttachmentDraft: (attachmentDraftId: AttachmentDraftId, delta: 1 | -1) =>
    _set(state => {
      const attachments = [...state.attachmentDrafts];
      const currentIdx = attachments.findIndex(a => a.id === attachmentDraftId);

      // If the draft is not found, or if trying to move beyond the array boundaries, no move is needed
      if (currentIdx === -1 || (currentIdx === 0 && delta === -1) || (currentIdx === attachments.length - 1 && delta === 1))
        return state;

      // Swap the draft with the adjacent one in the direction of delta
      const targetIdx = currentIdx + delta;
      [attachments[currentIdx], attachments[targetIdx]] = [attachments[targetIdx], attachments[currentIdx]];

      return { attachmentDrafts: attachments };
    }),

  toggleAttachmentDraftConverterAndConvert: async (attachmentDraftId: AttachmentDraftId, converterIdx: number | null) => {
    const { _getAttachment, _editAttachment, _replaceAttachmentOutputFragments } = _get();

    // null: select none, radio: change the active selection, checkbox: toggle the selection
    _editAttachment(attachmentDraftId, (draft) => {

      // null: uncheck all converters
      if (converterIdx === null) {
        return {
          converters: draft.converters.map((converter): AttachmentDraftConverter => ({ ...converter, isActive: false })),
        };
      }

      // No change if invalid index
      const targetConverter = draft.converters[converterIdx];
      if (!targetConverter) return draft;

      // if checkbox: Toggle only the target checkbox
      if (targetConverter.isCheckbox) {
        return {
          converters: draft.converters.map((converter, idx): AttachmentDraftConverter =>
            idx === converterIdx
              ? { ...converter, isActive: !converter.isActive }
              : converter,
          ),
        };
      } else {
        // For radio buttons: check the target and uncheck all others
        return {
          converters: draft.converters.map((converter, idx): AttachmentDraftConverter =>
            converter.isCheckbox
              ? converter
              : { ...converter, isActive: idx === converterIdx },
          ),
        };
      }
    });

    // Perform the conversion
    const attachmentDraft = _getAttachment(attachmentDraftId);
    if (!attachmentDraft) return;
    await attachmentPerformConversion(attachmentDraft, _editAttachment, _replaceAttachmentOutputFragments);
  },

  takeAllFragments: async (newContextId: DBlobDBContextId, newScopeId: DBlobDBScopeId) => {
    // get all the fragments
    const transferredFragments: DMessageAttachmentFragment[] =
      _get().attachmentDrafts.flatMap(draft => draft.outputFragments);

    // [dblob] transfer ownership (await for transferAttachmentOwnedDBAsset)
    for (const transferredFragment of transferredFragments)
      await transferAttachmentOwnedDBAsset(transferredFragment, newContextId, newScopeId);

    // clear state
    _set({ attachmentDrafts: [] });

    return transferredFragments;
  },

  takeFragmentsByType: (fragmentsType: DMessageAttachmentFragment['part']['pt'], attachmentDraftId: AttachmentDraftId | null, removeFragments: boolean): DMessageAttachmentFragment[] => {
    const { attachmentDrafts } = _get();

    const textFragments: DMessageAttachmentFragment[] = [];
    const keptDrafts: AttachmentDraft[] = [];

    for (const draft of attachmentDrafts) {

      // non-touched attachments
      if (attachmentDraftId !== null && draft.id !== attachmentDraftId) {
        keptDrafts.push(draft);
        continue;
      }

      // Extract text fragments
      const extractedTextFragments = draft.outputFragments.filter(fragment => fragment.part.pt === fragmentsType);
      textFragments.push(...extractedTextFragments);

      // keep as-is if there's nothing to remove
      if (!removeFragments || extractedTextFragments.length === 0) {
        keptDrafts.push(draft);
        continue;
      }

      // Removal: rmeove associated DBlob items
      for (let removedFragment of extractedTextFragments) {
        void removeAttachmentOwnedDBAsset(removedFragment);
      }

      // Removal: leave non-text fragments in the draft
      const keptFragments = draft.outputFragments.filter(fragment => fragment.part.pt !== fragmentsType);
      if (keptFragments.length || draft.outputsConverting) {
        keptDrafts.push({
          ...draft,
          outputFragments: keptFragments,
        });
      }
    }

    // Remove the text fragments if requested
    if (removeFragments)
      _set({
        attachmentDrafts: keptDrafts,
      });

    return textFragments;
  },


  removeAttachmentDraftOutputFragment: (attachmentDraftId: AttachmentDraftId, fragmentIndex: number) =>
    _set((state) => {
      const { attachmentDrafts } = state;

      // Find Attachment Draft
      const attachmentIndex = attachmentDrafts.findIndex((a) => a.id === attachmentDraftId);
      if (attachmentIndex === -1) return state;

      // Find the Fragment
      const attachment = attachmentDrafts[attachmentIndex];
      const fragmentToRemove = attachment.outputFragments[fragmentIndex];
      if (!fragmentToRemove) return state;

      // Removal: rmeove associated DBlob items (there are no other references to the fragment, it's only the attachment)
      void removeAttachmentOwnedDBAsset(fragmentToRemove);

      // Create a new array of fragments without the removed one
      const newOutputFragments = [...attachment.outputFragments];
      newOutputFragments.splice(fragmentIndex, 1);

      // If there are no fragments left, remove the entire attachment draft
      if (newOutputFragments.length === 0) {
        const newAttachments = [...attachmentDrafts];
        newAttachments.splice(attachmentIndex, 1);
        return {
          attachmentDrafts: newAttachments,
        };
      }

      // Update the attachment draft with the new fragments
      const newAttachments = [...attachmentDrafts];
      newAttachments[attachmentIndex] = { ...attachment, outputFragments: newOutputFragments };
      return {
        attachmentDrafts: newAttachments,
      };
    }),


  _editAttachment: (attachmentDraftId: AttachmentDraftId, update: Partial<Omit<AttachmentDraft, 'outputFragments'>> | ((attachment: AttachmentDraft) => Partial<Omit<AttachmentDraft, 'outputFragments'>>)) =>
    _set(state => ({
      attachmentDrafts: state.attachmentDrafts.map((attachmentDraft: AttachmentDraft): AttachmentDraft =>
        attachmentDraft.id === attachmentDraftId
          ? { ...attachmentDraft, ...(typeof update === 'function' ? update(attachmentDraft) : update) }
          : attachmentDraft,
      ),
    })),

  _replaceAttachmentOutputFragments: (attachmentDraftId: AttachmentDraftId, outputFragments: DMessageAttachmentFragment[]) =>
    _set(state => ({
      attachmentDrafts: state.attachmentDrafts.map((attachmentDraft: AttachmentDraft): AttachmentDraft => {
        if (attachmentDraft.id !== attachmentDraftId)
          return attachmentDraft;

        // find the removed fragments
        const removedFragments = attachmentDraft.outputFragments.filter(f => !outputFragments.includes(f));

        // remove the DBlob items associated with the removed fragments
        for (let removedFragment of removedFragments) {
          void removeAttachmentOwnedDBAsset(removedFragment);
        }

        return {
          ...attachmentDraft,
          outputFragments,
        };
      }),
    })),

  _getAttachment: (attachmentDraftId: AttachmentDraftId) =>
    _get().attachmentDrafts.find(a => a.id === attachmentDraftId),

});
