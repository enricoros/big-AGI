import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { DWorkspaceId } from '~/common/stores/workspace/workspace.types';

import { agiUuid } from '~/common/util/idUtils';

import type { LiveFile, LiveFileId, LiveFileMetadata } from './liveFile.types';


// configuration
const MAX_PER_TEXT_FILE_SIZE = 10 * 1024 * 1024; // 10 MB - this would be a LOT of text, and it's likely an error


// Store State and Actions

interface LiveFileState {

  // Storage of all LiveFile objects
  // NOTE: FileSystemFileHandle objects are stored here BUT they are NOT serializable
  liveFiles: Record<LiveFileId, LiveFile>;

  // Workspace associations (using arrays instead of Sets for serialization)
  liveFilesByWorkspace: Record<DWorkspaceId, LiveFileId[]>;

}

interface LiveFileActions {

  // CRUD
  addLiveFile: (fileSystemFileHandle: FileSystemFileHandle) => Promise<LiveFileId>;
  metadataGet: (fileId: LiveFileId) => LiveFileMetadata | null;
  metadataUpdate: (fileId: LiveFileId, metadata: Partial<Omit<LiveFileMetadata, 'id' | 'referenceCount'>>) => void;
  removeLiveFile: (fileId: LiveFileId) => void;

  // content updates
  contentClose: (fileId: LiveFileId) => Promise<void>;
  contentReload: (fileId: LiveFileId) => Promise<void>;
  contentWriteAndReload: (fileId: LiveFileId, content: string) => Promise<boolean>;

  // workspace associations
  workspaceAssign: (workspaceId: DWorkspaceId, fileId: LiveFileId) => void;
  workspaceRemove: (workspaceId: DWorkspaceId, fileId: LiveFileId) => void;
  workspaceGetLiveFiles: (workspaceId: DWorkspaceId) => LiveFileId[];

}


export const useLiveFileStore = create<LiveFileState & LiveFileActions>()(persist(
  (_set, _get) => ({

    // default state before loading from storage
    liveFiles: {},
    liveFilesByWorkspace: {},


    // CRUD

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

    removeLiveFile: (fileId: LiveFileId) =>
      _set((state) => {
        const { [fileId]: _dropped, ...otherFiles } = state.liveFiles;
        return {
          liveFiles: otherFiles,
          liveFilesByWorkspace: _stateFilterLiveFilesByWorkspace(state.liveFilesByWorkspace, id => id !== fileId),
        };
      }),


    // Content updates

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


    // Workspace associations

    workspaceAssign: (workspaceId: DWorkspaceId, fileId: LiveFileId) => {
      _set((state) => {
        const currentFiles = state.liveFilesByWorkspace[workspaceId] || [];
        if (!currentFiles.includes(fileId)) {
          return {
            liveFilesByWorkspace: {
              ...state.liveFilesByWorkspace,
              [workspaceId]: [...currentFiles, fileId],
            },
          };
        }
        return state;
      });
    },

    workspaceRemove: (workspaceId: DWorkspaceId, fileId: LiveFileId) => {
      _set((state) => {
        const currentFiles = state.liveFilesByWorkspace[workspaceId];
        if (!currentFiles) return state;

        return {
          liveFilesByWorkspace: {
            ...state.liveFilesByWorkspace,
            [workspaceId]: currentFiles.filter(id => id !== fileId),
          },
        };
      });
    },

    workspaceGetLiveFiles: (workspaceId: DWorkspaceId) => {
      const state = _get();
      return state.liveFilesByWorkspace[workspaceId] || [];
    },

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

      // Clean up liveFilesByWorkspace
      const validFileIds = new Set(Object.keys(state.liveFiles));
      state.liveFilesByWorkspace = _stateFilterLiveFilesByWorkspace(state.liveFilesByWorkspace || {}, id => validFileIds.has(id));

    },

  },
));


// internal utility functions
function _stateFilterLiveFilesByWorkspace(liveFilesByWorkspace: LiveFileState['liveFilesByWorkspace'], predicate: (fileId: LiveFileId) => boolean): LiveFileState['liveFilesByWorkspace'] {
  return Object.fromEntries(
    Object.entries(liveFilesByWorkspace)
      .map(([workspaceId, fileIds]) => [
        workspaceId,
        fileIds.filter(predicate),
      ])
      .filter(([_, fileIds]) => fileIds.length > 0),
  );
}


// public accessors
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
