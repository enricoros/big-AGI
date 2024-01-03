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
  createFolder: (title: string) => string;
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

      createFolder: (title: string): string => {
        const newFolder: DFolder = {
          id: uuidv4(),
          title,
          conversationIds: [],
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
    }
  )
));