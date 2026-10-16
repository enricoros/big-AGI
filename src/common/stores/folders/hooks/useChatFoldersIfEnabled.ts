import { useFolderStore } from '../store-chat-folders';


export function useChatFoldersIfEnabled() {
  return useFolderStore(({ enableFolders, folders }) => enableFolders ? folders : undefined);
}
