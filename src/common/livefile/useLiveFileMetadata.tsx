import type { LiveFileId, LiveFileMetadata } from '~/common/livefile/liveFile.types';
import { useLiveFileStore } from '~/common/livefile/store-live-file';
import { useShallow } from 'zustand/react/shallow';

export function useLiveFileMetadata(liveFileId: LiveFileId | undefined): LiveFileMetadata | null {
  return useLiveFileStore(useShallow((store) =>
    !liveFileId ? null : store.metadataGet(liveFileId),
  ));
}