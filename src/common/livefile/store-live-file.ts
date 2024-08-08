import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { agiUuid } from '~/common/util/idUtils';

import type { LiveFile, LiveFileId, LiveFileMetadata } from './liveFile.types';


// configuration
const MAX_PER_TEXT_FILE_SIZE = 10 * 1024 * 1024; // 10 MB - this would be a LOT of text, and it's likely an error


// Store State and Actions

interface LiveFileState {

  // Storage of all LiveFile objects
  // NOTE: FileSystemFileHandle objects are stored here BUT they are NOT serializable
  liveFiles: Record<LiveFileId, LiveFile>;

}

interface LiveFileActions {

  // Manage LiveFile objects
  addLiveFile: (fileSystemFileHandle: FileSystemFileHandle) => Promise<LiveFileId>;
  removeLiveFile: (fileId: LiveFileId) => void;

  // Content operations
  contentClose: (fileId: LiveFileId) => Promise<void>;
  contentReload: (fileId: LiveFileId) => Promise<void>;
  contentWriteAndReload: (fileId: LiveFileId, content: string) => Promise<boolean>;

  // Metadata is a smaller view on the files data, for listing purposes
  metadataGet: (fileId: LiveFileId) => LiveFileMetadata | null;
  metadataUpdate: (fileId: LiveFileId, metadata: Partial<Omit<LiveFileMetadata, 'id' | 'referenceCount'>>) => void;

  // addReference: (fileId: LiveFileId, referenceId: string) => void;
  // removeReference: (fileId: LiveFileId, referenceId: string) => void;
}


export const useLiveFileStore = create<LiveFileState & LiveFileActions>()(persist(
  (_set, _get) => ({

    // Default state (before loading from storage)
    liveFiles: {},


    addLiveFile: async (fileSystemFileHandle: FileSystemFileHandle) => {

      // Reuse existing LiveFile if possible
      for (const otherLiveFile of Object.values(_get().liveFiles)) {
        if (checkPairingValid(otherLiveFile)) {
          const isMatch = await fileSystemFileHandle.isSameEntry(otherLiveFile.fsHandle);
          if (isMatch)
            return otherLiveFile.id;
        }
      }

      // Check for size limit: we're supposed to support medium-sized text files
      const file = await fileSystemFileHandle.getFile();
      if (file.size > MAX_PER_TEXT_FILE_SIZE)
        throw new Error(`Text file too large: ${file.size} bytes. Unsupported.`);

      // Create and store a new LiveFile
      const id = agiUuid('livefile-item');
      const now = Date.now();
      const newLiveFile: LiveFile = {
        id,
        fsHandle: fileSystemFileHandle,
        name: file.name,
        type: file.type,
        size: file.size,
        content: null,
        lastModified: file.lastModified,
        created: now,
        isLoading: false,
        isSaving: false,
        error: null,
        // references: new Set(),
      };

      _set((state) => ({
        liveFiles: {
          ...state.liveFiles,
          [id]: newLiveFile,
        },
      }));

      // Do not auto-load the file here, as this is just creating the
      // LiveFile, but the liveFile is not hot yet (content: null).

      return id;
    },

    removeLiveFile: (fileId: LiveFileId) =>
      _set((state) => {
        const { [fileId]: _, ...otherFiles } = state.liveFiles;
        return { liveFiles: otherFiles };
      }),


    contentClose: async (fileId: LiveFileId) => {
      const liveFile = _get().liveFiles[fileId];
      if (!liveFile || liveFile.isSaving) return;

      _set((state) => ({
        liveFiles: {
          ...state.liveFiles,
          [fileId]: { ...liveFile, content: null, error: null },
        },
      }));
    },

    contentReload: async (fileId: LiveFileId) => {
      const liveFile = _get().liveFiles[fileId];
      if (!liveFile || liveFile.isLoading || liveFile.isSaving) return;

      _set((state) => ({
        liveFiles: {
          ...state.liveFiles,
          [fileId]: { ...liveFile, isLoading: true, error: null },
        },
      }));

      try {
        const file = await liveFile.fsHandle.getFile();
        const fileContent = await file.text();

        _set((state) => ({
          liveFiles: {
            ...state.liveFiles,
            [fileId]: {
              ...liveFile,
              content: fileContent,
              lastModified: file.lastModified,
              isLoading: false,
              error: null,
            },
          },
        }));
      } catch (error: any) {
        _set((state) => ({
          liveFiles: {
            ...state.liveFiles,
            [fileId]: {
              ...liveFile,
              content: null,
              isLoading: false,
              error: `Error reading: ${error?.message || typeof error === 'string' ? error : 'Unknown error'}`,
            },
          },
        }));
      }
    },

    contentWriteAndReload: async (fileId: LiveFileId, newContent: string): Promise<boolean> => {
      const liveFile = _get().liveFiles[fileId];
      if (!liveFile || liveFile.isSaving) return false;

      _set((state) => ({
        liveFiles: {
          ...state.liveFiles,
          [fileId]: { ...liveFile, isSaving: true, error: null },
        },
      }));

      try {
        // Perform the write
        const writable = await liveFile.fsHandle.createWritable();
        await writable.write(newContent);
        await writable.close();

        // emulate a 'reload' by replacing the content
        _set((state) => ({
          liveFiles: {
            ...state.liveFiles,
            [fileId]: {
              ...liveFile,
              content: newContent,
              isSaving: false,
              lastModified: Date.now(),
            },
          },
        }));

        return true;
      } catch (error: any) {
        _set((state) => ({
          liveFiles: {
            ...state.liveFiles,
            [fileId]: {
              ...liveFile,
              isSaving: false,
              error: `Error saving File: ${error?.message || typeof error === 'string' ? error : 'Unknown error'}`,
            },
          },
        }));
        return false;
      }
    },

    metadataUpdate: (fileId: LiveFileId, metadata: Partial<Omit<LiveFileMetadata, 'id' /*| 'referenceCount'*/>>) =>
      _set((state) => {
        const liveFile = state.liveFiles[fileId];
        if (!liveFile) return state;
        return {
          liveFiles: {
            ...state.liveFiles,
            [fileId]: { ...liveFile, ...metadata },
          },
        };
      }),

    metadataGet: (fileId: LiveFileId): LiveFileMetadata | null => {
      const liveFile = _get().liveFiles[fileId];
      if (!liveFile) return null;
      return {
        id: liveFile.id,
        name: liveFile.name,
        type: liveFile.type,
        size: liveFile.size,
        lastModified: liveFile.lastModified,
        created: liveFile.created,
        isPairingValid: checkPairingValid(liveFile),
        // referenceCount: liveFile.references.size,
      };
    },

    // addReference: (fileId: LiveFileId, referenceId: string) =>
    //   _set((state) => {
    //     const liveFile = state.liveFiles[fileId];
    //     if (!liveFile) return state;
    //     const newReferences = new Set(liveFile.references).add(referenceId);
    //     return {
    //       liveFiles: {
    //         ...state.liveFiles,
    //         [fileId]: { ...liveFile, references: newReferences },
    //       },
    //     };
    //   }),
    //
    // removeReference: (fileId: LiveFileId, referenceId: string) =>
    //   _set((state) => {
    //     const liveFile = state.liveFiles[fileId];
    //     if (!liveFile) return state;
    //     const newReferences = new Set(liveFile.references);
    //     newReferences.delete(referenceId);
    //     return {
    //       liveFiles: {
    //         ...state.liveFiles,
    //         [fileId]: { ...liveFile, references: newReferences },
    //       },
    //     };
    //   }),

  }),
  {

    name: 'agi-live-file',
    // getStorage: () => ...?

    onRehydrateStorage: () => (state) => {
      if (!state) return;

      /* [GC] Remove invalid LiveFiles that did not survive serialization.
       * - Note: `store-chats` [GC] will also depend on this
       *
       * This is an issue because a new LiveFile creation and Pairing will be required.
       * However, it's something we can live with at the moment.
       *
       * In the future, we can use a serializable storage such as IndexedDB:
       * https://developer.chrome.com/docs/capabilities/web-apis/file-system-access#storing_file_handles_or_directory_handles_in_indexeddb
       *
       * Note that we also do this for GC - we could leave the objects here to contain older metadata,
       * but it's probably not worth it.
       */
      state.liveFiles = Object.fromEntries(
        Object.entries(state.liveFiles || {}).filter(([_, file]) => checkPairingValid(file)),
      );

    },

  },
));


// utility functions
export function liveFileCreateOrThrow(fileSystemFileHandle: FileSystemFileHandle): Promise<LiveFileId> {
  return useLiveFileStore.getState().addLiveFile(fileSystemFileHandle);
}

export function liveFileGetAllValidIDs(): LiveFileId[] {
  return Object.entries(useLiveFileStore.getState().liveFiles)
    .filter(([_, file]) => checkPairingValid(file))
    .map(([id, _]) => id);
}

export function checkPairingValid(file: LiveFile): boolean {
  return typeof (file.fsHandle?.getFile) === 'function';
}
