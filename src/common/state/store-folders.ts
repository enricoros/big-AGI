import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { DConversationId } from './store-chats'; // Assuming this is the path to your chats store

export interface DFolder {
  id: string;
  title: string;
  conversationIds: DConversationId[];
  color?: string; // Optional color property
}

interface FolderState {
  folders: DFolder[];
}

interface FolderActions {
  createFolder: (title: string, color?: string) => string;
  updateFolderName: (folderId: string, title: string) => void;
  deleteFolder: (folderId: string) => void;
  addConversationToFolder: (folderId: string, conversationId: DConversationId) => void;
  removeConversationFromFolder: (folderId: string, conversationId: DConversationId) => void;
  moveFolder: (fromIndex: number, toIndex: number) => void;
  setFolders: (folders: DFolder[]) => void;
  setFolderColor: (folderId: string, color: string) => void;
}

type FolderStore = FolderState & FolderActions;

export const useFolderStore = create<FolderStore>()(devtools(
  persist(
    (set, get) => ({
      folders: [], // Initial state

      createFolder: (title: string, color?: string): string => {
        const newFolder: DFolder = {
          id: uuidv4(),
          title,
          conversationIds: [],
          color,
        };

        set(state => ({
          folders: [...state.folders, newFolder],
        }));

        return newFolder.id;
      },

      updateFolderName: (folderId: string, title: string): void => {
        set(state => ({
          folders: state.folders.map(folder =>
            folder.id === folderId
              ? { ...folder, title }
              : folder
          ),
        }));
      },

      deleteFolder: (folderId: string): void => {
        set(state => ({
          folders: state.folders.filter(folder => folder.id !== folderId),
        }));
      },

      addConversationToFolder: (folderId: string, conversationId: string) => {
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
        });
      },

      removeConversationFromFolder: (folderId: string, conversationId: DConversationId): void => {
        set(state => ({
          folders: state.folders.map(folder =>
            folder.id === folderId
              ? { ...folder, conversationIds: folder.conversationIds.filter(id => id !== conversationId) }
              : folder
          ),
        }));
      },

      moveFolder: (fromIndex: number, toIndex: number): void => {
        set(state => {
          const newFolders = Array.from(state.folders);
          const [movedFolder] = newFolders.splice(fromIndex, 1);
          newFolders.splice(toIndex, 0, movedFolder);
          return { folders: newFolders };
        });
      },

      setFolders: (folders: DFolder[]): void => {
        set({ folders });
      },

      setFolderColor: (folderId: string, color: string): void => {
        set(state => ({
          folders: state.folders.map(folder =>
            folder.id === folderId
              ? { ...folder, color }
              : folder
          ),
        }));
      },
    }),
    {
      name: 'app-folders',
    },
  ),
));


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
