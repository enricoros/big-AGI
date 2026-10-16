import { DFolder, useFolderStore } from '../store-chat-folders';


/**
 * Note: this function takes a folder ID and returns it if it is a valid folder ID.
 */
export function useChatFolderValidateId(folderId: DFolder['id'] | null) {
  return useFolderStore(({ enableFolders, folders }) => {
    const activeFolder = (!enableFolders || !folderId) ? null
      : folders.find(folder => folder.id === folderId) ?? null;
    return activeFolder?.id ?? null;
  });
}
