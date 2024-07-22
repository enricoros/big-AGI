import type { AttachmentDraftSource } from '~/common/attachment-drafts/attachment.types';
import type { DMessageAttachmentFragment } from '~/common/stores/chat/chat.fragments';


export function liveFileIsSupported(source: AttachmentDraftSource): boolean {
  return source.media === 'file' && !!source.fileWithHandle.handle && typeof source.fileWithHandle.handle.getFile === 'function';
}

export function liveFileAddToAttachmentFragment(source: AttachmentDraftSource, attachmentFragment: DMessageAttachmentFragment) {
  if (source.media === 'file' && !!source.fileWithHandle.handle && typeof source.fileWithHandle.handle.getFile === 'function')
    attachmentFragment._fileSystemFileHandle = source.fileWithHandle.handle;
}
