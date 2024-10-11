import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import { agiUuid } from '~/common/util/idUtils';


export interface DFolder {
  id: string;
  title: string;
  conversationIds: DConversationId[];
  color?: string; // Optional color property
}

interface FolderState {
  folders: DFolder[];
  enableFolders: boolean; // user setting - default to off until we get enough feedback
}

interface FolderActions {
  importFoldersAppend: (folders: DFolder[], enableFolders: boolean) => void;
  createFolder: (title: string, color?: string) => void;
  deleteFolder: (folderId: string) => void;
  moveFolder: (fromIndex: number, toIndex: number) => void;
  setFolderName: (folderId: string, title: string) => void;
  setFolderColor: (folderId: string, color: string) => void;
  addConversationToFolder: (folderId: string, conversationId: DConversationId) => void;
  removeConversationFromFolder: (folderId: string, conversationId: DConversationId) => void;
  toggleEnableFolders: () => void;
}

type FolderStore = FolderState & FolderActions;

export const useFolderStore = create<FolderStore>()(/*devtools(*/
  persist(
    (set, _get) => ({

      // Initial state
      folders: [],
      enableFolders: false,

      // Actions
      importFoldersAppend: (folders: DFolder[], enableFolders: boolean) =>
        set(state => ({
          folders: [
            ...state.folders.filter(f => !folders.find(f2 => f2.id === f.id)),
            ...folders,
          ],
          enableFolders: enableFolders || state.enableFolders,
        })),

      createFolder: (title: string, color?: string) => {
        const newFolder: DFolder = {
          id: agiUuid('chat-folders-item'),
          title,
          conversationIds: [],
          color,
        };

        set(state => ({
          folders: [...state.folders, newFolder],
        }));
      },

      deleteFolder: (folderId: string): void =>
        set(state => ({
          folders: state.folders.filter(folder => folder.id !== folderId),
        })),

      moveFolder: (fromIndex: number, toIndex: number): void =>
        set(state => {
          const newFolders = [...state.folders];
          const [movedFolder] = newFolders.splice(fromIndex, 1);
          newFolders.splice(toIndex, 0, movedFolder);
          return { folders: newFolders };
        }),

      setFolderName: (folderId: string, title: string): void =>
        set(state => ({
          folders: state.folders.map(folder =>
            folder.id === folderId
              ? { ...folder, title }
              : folder,
          ),
        })),

      setFolderColor: (folderId: string, color: string): void =>
        set(state => ({
          folders: state.folders.map(folder =>
            folder.id === folderId
              ? { ...folder, color }
              : folder,
          ),
        })),

      addConversationToFolder: (folderId: string, conversationId: string) =>
        set(state => {
          const folders = state.folders.map(folder => {
            // Check if this is the correct folder and if the conversationId is not already present
            if (folder.id === folderId && !folder.conversationIds.includes(conversationId)) {
              // Use the spread operator to create a new array with the conversationId added
              return { ...folder, conversationIds: [...folder.conversationIds, conversationId] };
            }
            return folder;
          });
          return { folders };
        }),

      removeConversationFromFolder: (folderId: string, conversationId: DConversationId): void =>
        set(state => ({
          folders: state.folders.map(folder =>
            folder.id === folderId
              ? { ...folder, conversationIds: folder.conversationIds.filter(id => id !== conversationId) }
              : folder,
          ),
        })),

      toggleEnableFolders: () => set(state => ({
        enableFolders: !state.enableFolders,
      })),

    }),
    {
      name: 'app-folders',
    },
  ),
);


export const FOLDERS_COLOR_PALETTE = [
  '#828282',
  '#f22a85',
  '#f13d41',
  '#cb6701',
  '#42940f',
  '#068fa6',
  '#407cf8',

  '#626262',
  '#b91e64',
  '#b72e30',
  '#9b4d01',
  '#2f7007',
  '#076c7e',
  '#1c5dc8',

  '#474747',
  '#8c0f49',
  '#891e20',
  '#713804',
  '#1f5200',
  '#004f5d',
  '#1d4294',
];

export function getRotatingFolderColor(): string {
  const randomIndex = Math.floor(Math.random() * (FOLDERS_COLOR_PALETTE.length / 3));
  return FOLDERS_COLOR_PALETTE[randomIndex];
}