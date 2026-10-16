import { useShallow } from 'zustand/react/shallow';

import { DFolder, useFolderStore } from '../store-chat-folders';


const _stableNoFolders: DFolder[] = [];


export function useChatFolderActive(activeFolderId: string | null) {
  return useFolderStore(useShallow(({ enableFolders, folders, toggleEnableFolders }) => {

    // finds the active folder if any
    const activeFolder = (enableFolders && activeFolderId)
      ? folders.find(folder => folder.id === activeFolderId) ?? null
      : null;

    return {
      activeFolder,
      // allFolders: enableFolders ? folders : _stableNoFolders,
      allFolders: folders, // Always return folders so colors show even when folder list is hidden
      enableFolders,
      toggleEnableFolders,
    };
  }));
}