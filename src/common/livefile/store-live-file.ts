import { create } from 'zustand';
import { persist } from 'zustand/middleware';


import type { LiveFile, LiveFileId, LiveFileMetadata } from '~/common/livefile/liveFile.types';
import { agiUuid } from '~/common/util/idUtils';


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
  addFile: (fileSystemFileHandle: FileSystemFileHandle) => Promise<LiveFileId>;
  removeFile: (fileId: LiveFileId) => void;

  // File operations to (re)load and save content
  closeFileContent: (fileId: LiveFileId) => Promise<void>;
  reloadFileContent: (fileId: LiveFileId) => Promise<void>;
  saveFileContent: (fileId: LiveFileId, content: string) => Promise<boolean>;

  // Metadata is a smaller view on the files data, for listing purposes
  getFileMetadata: (fileId: LiveFileId) => LiveFileMetadata | null;
  updateFileMetadata: (fileId: LiveFileId, metadata: Partial<Omit<LiveFileMetadata, 'id' | 'referenceCount'>>) => void;

  // addReference: (fileId: LiveFileId, referenceId: string) => void;
  // removeReference: (fileId: LiveFileId, referenceId: string) => void;
}


export const useLiveFileStore = create<LiveFileState & LiveFileActions>()(persist(
  (_set, _get) => ({

    // Default state (before loading from storage)
    liveFiles: {},


    addFile: async (fileSystemFileHandle: FileSystemFileHandle) => {

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

    removeFile: (fileId: LiveFileId) =>
      _set((state) => {
        const { [fileId]: _, ...otherFiles } = state.liveFiles;
        return { liveFiles: otherFiles };
      }),


    closeFileContent: async (fileId: LiveFileId) => {
      const file = _get().liveFiles[fileId];
      if (!file || file.isSaving) return;

      _set((state) => ({
        liveFiles: {
          ...state.liveFiles,
          [fileId]: { ...file, content: null, error: null },
        },
      }));
    },

    reloadFileContent: async (fileId: LiveFileId) => {
      const file = _get().liveFiles[fileId];
      if (!file || file.isLoading || file.isSaving) return;

      _set((state) => ({
        liveFiles: {
          ...state.liveFiles,
          [fileId]: { ...file, isLoading: true, error: null },
        },
      }));

      try {
        const fileData = await file.fsHandle.getFile();
        const content = await fileData.text();

        _set((state) => ({
          liveFiles: {
            ...state.liveFiles,
            [fileId]: {
              ...file,
              content,
              isLoading: false,
              lastModified: fileData.lastModified,
            },
          },
        }));
      } catch (error: any) {
        _set((state) => ({
          liveFiles: {
            ...state.liveFiles,
            [fileId]: {
              ...file,
              isLoading: false,
              error: `Error loading File: ${error?.message || typeof error === 'string' ? error : 'Unknown error'}`,
            },
          },
        }));
      }
    },

    saveFileContent: async (fileId: LiveFileId, content: string): Promise<boolean> => {
      const file = _get().liveFiles[fileId];
      if (!file || file.isSaving) return false;

      _set((state) => ({
        liveFiles: {
          ...state.liveFiles,
          [fileId]: { ...file, isSaving: true, error: null },
        },
      }));

      try {
        const writable = await file.fsHandle.createWritable();
        await writable.write(content);
        await writable.close();

        _set((state) => ({
          liveFiles: {
            ...state.liveFiles,
            [fileId]: {
              ...file,
              content,
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
              ...file,
              isSaving: false,
              error: `Error saving File: ${error?.message || typeof error === 'string' ? error : 'Unknown error'}`,
            },
          },
        }));
        return false;
      }
    },

    updateFileMetadata: (fileId: LiveFileId, metadata: Partial<Omit<LiveFileMetadata, 'id' /*| 'referenceCount'*/>>) =>
      _set((state) => {
        const file = state.liveFiles[fileId];
        if (!file) return state;
        return {
          liveFiles: {
            ...state.liveFiles,
            [fileId]: { ...file, ...metadata },
          },
        };
      }),

    getFileMetadata: (fileId: LiveFileId): LiveFileMetadata | null => {
      const file = _get().liveFiles[fileId];
      if (!file) return null;
      return {
        id: file.id,
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified,
        created: file.created,
        isPairingValid: checkPairingValid(file),
        // referenceCount: file.references.size,
      };
    },

    // addReference: (fileId: LiveFileId, referenceId: string) =>
    //   _set((state) => {
    //     const file = state.liveFiles[fileId];
    //     if (!file) return state;
    //     const newReferences = new Set(file.references).add(referenceId);
    //     return {
    //       liveFiles: {
    //         ...state.liveFiles,
    //         [fileId]: { ...file, references: newReferences },
    //       },
    //     };
    //   }),
    //
    // removeReference: (fileId: LiveFileId, referenceId: string) =>
    //   _set((state) => {
    //     const file = state.liveFiles[fileId];
    //     if (!file) return state;
    //     const newReferences = new Set(file.references);
    //     newReferences.delete(referenceId);
    //     return {
    //       liveFiles: {
    //         ...state.liveFiles,
    //         [fileId]: { ...file, references: newReferences },
    //       },
    //     };
    //   }),

  }),
  {

    name: 'agi-live-file',
    // getStorage: () => ...?

    onRehydrateStorage: () => (state) => {
      if (!state) return;

      /* Remove invalid LiveFiles that did not survive serialization.
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
  return useLiveFileStore.getState().addFile(fileSystemFileHandle);
}

export function liveFileGetAllValidIDs(): LiveFileId[] {
  return Object.entries(useLiveFileStore.getState().liveFiles)
    .filter(([_, file]) => checkPairingValid(file))
    .map(([id, _]) => id);
}

export function checkPairingValid(file: LiveFile): boolean {
  return typeof (file.fsHandle?.getFile) === 'function';
}
