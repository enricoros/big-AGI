import type { FileWithHandle } from 'browser-fs-access';

import type { AttachmentDraftSource } from '~/common/attachment-drafts/attachment.types';
import type { DMessageAttachmentFragment } from '~/common/stores/chat/chat.fragments';


// AttachmentDraft Source

export function liveFileInSource(source: AttachmentDraftSource): boolean {
  return source.media === 'file' && !!source.fileWithHandle.handle && typeof source.fileWithHandle.handle.getFile === 'function';
}


// DMessageAttachmentFragment

export function liveFileCreate(fileWithHandle: FileWithHandle): DMessageAttachmentFragment['_liveFile'] {
  return {
    lft: 'fs',
    _fsFileHandle: fileWithHandle.handle,
  };
}

export function liveFileInAttachmentFragment(attachmentFragment: DMessageAttachmentFragment): boolean {
  return !!attachmentFragment._liveFile?._fsFileHandle;
}

