import * as React from 'react';

import ClearIcon from '@mui/icons-material/Clear';
import FolderIcon from '@mui/icons-material/Folder';

import type { DConversationId } from '~/common/state/store-chats';
import { DropdownItems, PageBarDropdownMemo } from '~/common/layout/optima/components/PageBarDropdown';
import { useFolderStore } from '~/common/state/store-folders';


export const ClearFolderText = 'No Folder';
const SPECIAL_ID_CLEAR_FOLDER = '_REMOVE_';


export function useFolderDropdown(conversationId: DConversationId | null) {

  // external state
  const { folders, enableFolders } = useFolderStore();


  // Prepare items for the dropdown
  const folderItems: DropdownItems | null = React.useMemo(() => {
    if (!folders.length)
      return null;

    // add one item per folder
    const items = folders.reduce((items, folder) => {
      items[folder.id] = {
        title: folder.title,
        icon: <FolderIcon sx={{ color: folder.color }} />,
      };
      return items;
    }, {} as DropdownItems);

    // add one item representing no folder
    items[SPECIAL_ID_CLEAR_FOLDER] = {
      title: ClearFolderText,
      icon: <ClearIcon />,
    };

    return items;
  }, [folders]);


  // Handle dropdown folder change
  const handleFolderChange = React.useCallback((folderId: string | null) => {
    if (conversationId && folderId) {
      // Remove conversation from all folders
      folders.forEach(folder => {
        if (folder.conversationIds.includes(conversationId)) {
          useFolderStore.getState().removeConversationFromFolder(folder.id, conversationId);
        }
      });
      // Add conversation to the selected folder
      if (folderId !== SPECIAL_ID_CLEAR_FOLDER)
        useFolderStore.getState().addConversationToFolder(folderId, conversationId);
    }
  }, [conversationId, folders]);

  // find the folder ID for the active Conversation
  const currentFolderId = folders.find(folder => folder.conversationIds.includes(conversationId || ''))?.id || null;

  // Create the dropdown component
  const folderDropdown = React.useMemo(() => {

    // don't show the dropdown if folders are not enabled
    if (!enableFolders || !folderItems)
      return null;

    return (
      <PageBarDropdownMemo
        items={folderItems}
        value={currentFolderId}
        onChange={handleFolderChange}
        placeholder='Assign to folder'
        showSymbols
      />
    );
  }, [currentFolderId, enableFolders, folderItems, handleFolderChange]);

  return { folderDropdown };
}