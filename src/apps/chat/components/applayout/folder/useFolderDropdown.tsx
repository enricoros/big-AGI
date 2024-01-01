import * as React from 'react';
import { shallow } from 'zustand/shallow';
import FolderIcon from '@mui/icons-material/Folder';
import { useFolderStore } from '~/common/state/store-folders';
import { DropdownItems, GoodDropdown } from '~/common/components/GoodDropdown';
import { DConversationId } from '~/common/state/store-chats';

export function useFolderDropdown(conversationId: DConversationId | null) {
  // Get folders from the store
  const folders = useFolderStore(state => state.folders);

  // Prepare items for the dropdown
  const folderItems: DropdownItems = folders.reduce((items, folder) => {
    items[folder.id] = {
      title: folder.title,
      icon: <FolderIcon sx={{ color: folder.color }} />,
    };
    return items;
  }, {} as DropdownItems);

  // Handle folder change
  const handleFolderChange = (_event: any, folderId: string | null) => {
    if (conversationId && folderId) {
      // Remove conversation from all folders
      folders.forEach(folder => {
        if (folder.conversationIds.includes(conversationId)) {
          useFolderStore.getState().removeConversationFromFolder(folder.id, conversationId);
        }
      });
      // Add conversation to the selected folder
      useFolderStore.getState().addConversationToFolder(folderId, conversationId);
    }
  };

  // Get the current folder ID for the selected conversation
  const currentFolderId = folders.find(folder => folder.conversationIds.includes(conversationId || ''))?.id || null;

  // Create the dropdown component
  const folderDropdown = (
    <GoodDropdown
      items={folderItems}
      value={currentFolderId}
      onChange={handleFolderChange}
      placeholder="Select a folder"
      showSymbols={true}
    />
  );

  return { folderDropdown };
}