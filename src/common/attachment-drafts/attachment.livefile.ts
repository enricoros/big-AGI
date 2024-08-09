import { liveFileCreateOrThrow } from '~/common/livefile/store-live-file';

import type { AttachmentDraftSource } from './attachment.types';


/** Checks if the source supports LiveFile (usually attached Files with drag/drop) */
export function attachmentSourceSupportsLiveFile(source: AttachmentDraftSource): boolean {
  return source.media === 'file' && !!source.fileWithHandle.handle && typeof source.fileWithHandle.handle.getFile === 'function';
}

/** Get the ID to a LiveFile (create one if needed) */
export async function attachmentGetLiveFileId(source: AttachmentDraftSource) {
  // only files that came with a FileSystemFileHandle are supported
  if (!attachmentSourceSupportsLiveFile(source) || source.media !== 'file' || !source.fileWithHandle.handle)
    return undefined;

  // new or recycled
  return await liveFileCreateOrThrow(source.fileWithHandle.handle).catch(console.error) || undefined;
}
