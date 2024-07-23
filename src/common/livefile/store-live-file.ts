import { create } from 'zustand';
import { persist } from 'zustand/middleware';


import type { LiveFile, LiveFileId, LiveFileMetadata } from '~/common/livefile/liveFile.types';
import { agiUuid } from '~/common/util/idUtils';


// Store State and Actions

interface LiveFileState {

  // Storage of all LiveFile objects
  // NOTE: FileSystemFileHandle objects are stored here BUT they are NOT serializable
  liveFiles: Map<LiveFileId, LiveFile>;

}

interface LiveFileActions {

  // Manage LiveFile objects
  addFile: (fileSystemFileHandle: FileSystemFileHandle) => Promise<LiveFileId>;
  removeFile: (fileId: LiveFileId) => void;

  // File operations to (re)load and save content
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
    liveFiles: new Map(),


    addFile: async (fileSystemFileHandle: FileSystemFileHandle) => {
      const file = await fileSystemFileHandle.getFile();

      // TODO: check for equality of handle objects, not just names. to start, print all names to console

      const existingFile = Array.from(_get().liveFiles.values()).find(f => f.fsHandle.name === fileSystemFileHandle.name);

      if (existingFile) {
        console.log('File already exists:', existingFile.id);
        return existingFile.id;
      }

      const id = agiUuid('livefile-item');
      const now = Date.now();

      _set((state) => ({
        liveFiles: new Map(state.liveFiles).set(id, {
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
        }),
      }));

      // Do not auto-load the file here, as it might be unnecessary

      return id;
    },

    removeFile: (fileId: LiveFileId) =>
      _set((state) => {
        const newFiles = new Map(state.liveFiles);
        newFiles.delete(fileId);
        return { liveFiles: newFiles };
      }),


    reloadFileContent: async (fileId: LiveFileId) => {
      const file = _get().liveFiles.get(fileId);
      if (!file || file.isLoading || file.isSaving) return;

      _set((state) => ({
        liveFiles: new Map(state.liveFiles).set(fileId, { ...file, isLoading: true, error: null }),
      }));

      try {
        const fileData = await file.fsHandle.getFile();
        const content = await fileData.text();

        _set((state) => ({
          liveFiles: new Map(state.liveFiles).set(fileId, {
            ...file,
            content,
            isLoading: false,
            lastModified: fileData.lastModified,
          }),
        }));
      } catch (error: any) {
        _set((state) => ({
          liveFiles: new Map(state.liveFiles).set(fileId, {
            ...file,
            isLoading: false,
            error: `Error loading File: ${error?.message || typeof error === 'string' ? error : 'Unknown error'}`,
          }),
        }));
      }
    },

    saveFileContent: async (fileId: LiveFileId, content: string): Promise<boolean> => {
      const file = _get().liveFiles.get(fileId);
      if (!file || file.isSaving) return false;

      _set((state) => ({
        liveFiles: new Map(state.liveFiles).set(fileId, { ...file, isSaving: true, error: null }),
      }));

      try {
        const writable = await file.fsHandle.createWritable();
        await writable.write(content);
        await writable.close();

        _set((state) => ({
          liveFiles: new Map(state.liveFiles).set(fileId, {
            ...file,
            content,
            isSaving: false,
            lastModified: Date.now(),
          }),
        }));

        return true;
      } catch (error: any) {
        _set((state) => ({
          liveFiles: new Map(state.liveFiles).set(fileId, {
            ...file,
            isSaving: false,
            error: `Error saving File: ${error?.message || typeof error === 'string' ? error : 'Unknown error'}`,
          }),
        }));
        return false;
      }
    },

    updateFileMetadata: (fileId: LiveFileId, metadata: Partial<Omit<LiveFileMetadata, 'id' /*| 'referenceCount'*/>>) =>
      _set((state) => {
        const file = state.liveFiles.get(fileId);
        if (!file) return state;
        return {
          liveFiles: new Map(state.liveFiles).set(fileId, { ...file, ...metadata }),
        };
      }),

    getFileMetadata: (fileId: LiveFileId): LiveFileMetadata | null => {
      const file = _get().liveFiles.get(fileId);
      if (!file) return null;
      return {
        id: file.id,
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified,
        created: file.created,
        isValid: typeof (file.fsHandle?.getFile) === 'function',
        // referenceCount: file.references.size,
      };
    },

    // addReference: (fileId: LiveFileId, referenceId: string) =>
    //   _set((state) => {
    //     const file = state.liveFiles.get(fileId);
    //     if (!file) return state;
    //     const newReferences = new Set(file.references).add(referenceId);
    //     return {
    //       liveFiles: new Map(state.liveFiles).set(fileId, { ...file, references: newReferences }),
    //     };
    //   }),
    //
    // removeReference: (fileId: LiveFileId, referenceId: string) =>
    //   _set((state) => {
    //     const file = state.liveFiles.get(fileId);
    //     if (!file) return state;
    //     const newReferences = new Set(file.references);
    //     newReferences.delete(referenceId);
    //     return {
    //       liveFiles: new Map(state.liveFiles).set(fileId, { ...file, references: newReferences }),
    //     };
    //   }),

  }),
  {

    name: 'agi-live-file',
    // getStorage: () => localStorage,

  },
));
