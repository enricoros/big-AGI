import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { DMessage } from '~/common/stores/chat/chat.message';
import type { LiveFileId } from '~/common/livefile/liveFile.types';
import { isAttachmentFragment } from '~/common/stores/chat/chat.fragments';
import { liveFileGetAllValidIDs } from '~/common/livefile/store-live-file';

import type { DWorkspaceId } from './workspace.types';


/**
 * A workspace must have only weak references to the contained information.
 * Strong resolution will be performed at the user levels, going by IDs.
 */
interface WorkspaceState {

  // Workspace associations (using arrays instead of Sets for serialization)
  liveFilesByWorkspace: Record<DWorkspaceId, LiveFileId[]>;

}

interface WorkspaceActions {

  // crud
  remove: (workspaceId: DWorkspaceId) => void;
  copyAssignments: (sourceWorkspaceId: DWorkspaceId, targetWorkspaceId: DWorkspaceId) => void;

  // operations
  liveFileAssign: (workspaceId: DWorkspaceId, fileId: LiveFileId) => void;
  liveFileUnassign: (workspaceId: DWorkspaceId, fileId: LiveFileId) => void;
  liveFileUnassignFromAll: (fileId: LiveFileId) => void;
  importAssignmentsFromMessages: (workspaceId: DWorkspaceId, messages: DMessage[]) => void;

}

export const useClientWorkspaceStore = create<WorkspaceState & WorkspaceActions>()(persist(
  (_set, _get) => ({

    // initial state, before any data is loaded
    liveFilesByWorkspace: {},


    // crud

    remove: (workspaceId: DWorkspaceId) =>
      _set((state) => {
        const { [workspaceId]: _, ...liveFilesByWorkspace } = state.liveFilesByWorkspace;
        return {
          liveFilesByWorkspace,
        };
      }),

    copyAssignments: (sourceWorkspaceId: DWorkspaceId, targetWorkspaceId: DWorkspaceId) =>
      _set((state) => {
        const sourceFiles = state.liveFilesByWorkspace[sourceWorkspaceId] || [];
        const targetFiles = state.liveFilesByWorkspace[targetWorkspaceId] || [];
        return {
          liveFilesByWorkspace: {
            ...state.liveFilesByWorkspace,
            // source files & target files, removing duplicates
            [targetWorkspaceId]: Array.from(new Set([...targetFiles, ...sourceFiles])),
          },
        };
      }),


    // operations

    liveFileAssign: (workspaceId: DWorkspaceId, fileId: LiveFileId) =>
      _set((state) => {
        // if alread included, do not do anything
        if (state.liveFilesByWorkspace[workspaceId]?.includes(fileId))
          return state;
        return {
          liveFilesByWorkspace: {
            ...state.liveFilesByWorkspace,
            [workspaceId]: Array.from(new Set([...(state.liveFilesByWorkspace[workspaceId] || []), fileId])),
          },
        };
      }),

    liveFileUnassign: (workspaceId: DWorkspaceId, fileId: LiveFileId) =>
      _set((state) => {
        if (!state.liveFilesByWorkspace[workspaceId]?.includes(fileId))
          return state;
        return {
          liveFilesByWorkspace: {
            ...state.liveFilesByWorkspace,
            [workspaceId]: (state.liveFilesByWorkspace[workspaceId] || []).filter(id => id !== fileId),
          },
        };
      }),

    liveFileUnassignFromAll: (fileId: LiveFileId) =>
      _set((state) => ({
        liveFilesByWorkspace: Object.fromEntries(
          Object.entries(state.liveFilesByWorkspace).map(([workspaceId, fileIds]) => [
            workspaceId,
            fileIds.filter(id => id !== fileId),
          ]),
        ),
      })),

    importAssignmentsFromMessages: (workspaceId: DWorkspaceId, messages: DMessage[]) =>
      _set((state) => {
        const existingFiles = state.liveFilesByWorkspace[workspaceId] || [];
        const newFileIds: LiveFileId[] = [];

        // Find all file IDs from conversation messages
        messages.forEach(message => {
          message.fragments.forEach(fragment => {
            if (isAttachmentFragment(fragment) && fragment.liveFileId)
              newFileIds.push(fragment.liveFileId);
          });
        });

        return {
          liveFilesByWorkspace: {
            ...state.liveFilesByWorkspace,
            // Combine existing files with new files, removing duplicates
            [workspaceId]: Array.from(new Set([...existingFiles, ...newFileIds])),
          },
        };
      }),

  }),
  {
    name: 'agi-client-workspace',

    onRehydrateStorage: () => (state) => {
      if (!state) return;

      // [GC][LiveFile] remove LiveFile references to invalid objects (also done in chats.conterters.ts)
      const validLiveFileIDs = liveFileGetAllValidIDs();
      state.liveFilesByWorkspace = Object.fromEntries(
        Object.entries(state.liveFilesByWorkspace)
          .map(([workspaceId, fileIds]) => [
            workspaceId,
            fileIds.filter(id => validLiveFileIDs.includes(id)),
          ])
          .filter(([_, fileIds]) => fileIds.length > 0),
      );
    },

  },
));

/**
 * Use this to get the workspace immediate actions (function calls)
 */
export function workspaceActions(): Readonly<WorkspaceActions> {
  return useClientWorkspaceStore.getState();
}
