// store-folders.ts

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { DConversationId } from './store-chats'; // Assuming this is the path to your chats store

export interface DFolder {
  id: string;
  title: string;
  conversationIds: DConversationId[];
}

interface FolderState {
  folders: DFolder[];
}

interface FolderActions {
  createFolder: (title: string) => string;
  deleteFolder: (folderId: string) => void;
  addConversationToFolder: (folderId: string, conversationId: DConversationId) => void;
  removeConversationFromFolder: (folderId: string, conversationId: DConversationId) => void;
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

      deleteFolder: (folderId: string): void => {
        set(state => ({
          folders: state.folders.filter(folder => folder.id !== folderId),
        }));
      },

      addConversationToFolder: (folderId: string, conversationId: DConversationId): void => {
        set(state => ({
          folders: state.folders.map(folder => 
            folder.id === folderId
              ? { ...folder, conversationIds: [...folder.conversationIds, conversationId] }
              : folder
          ),
        }));
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
    }),
    {
      name: 'app-folders',
    }
  )
));