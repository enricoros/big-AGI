import * as React from 'react';

import { ListItem, ListItemButton, ListItemDecorator } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import FolderIcon from '@mui/icons-material/Folder';

import { InlineTextarea } from '~/common/components/InlineTextarea';
import { chatFoldersActions, DFolder, getRotatingFolderColor } from '~/common/stores/folders/store-chat-folders';


interface AddFolderButtonProps {
  isAddingFolder: boolean;
  setIsAddingFolder: (value: boolean) => void;
  onFolderCreated?: (newFolderId: DFolder['id']) => void;
}


/**
 * Controlled in 'isAddingFolder' state from the parent component
 */
export function FoldersAddButton({ isAddingFolder, setIsAddingFolder, onFolderCreated }: AddFolderButtonProps) {

  // state
  const [newFolderColor, setNewFolderColor] = React.useState<string | null>(null);


  // handlers

  const handleStartAddFolder = React.useCallback(() => {
    setNewFolderColor(getRotatingFolderColor());
    setIsAddingFolder(true);
  }, [setIsAddingFolder]);

  const handleCancelAddFolder = React.useCallback(() => {
    setIsAddingFolder(false);
  }, [setIsAddingFolder]);

  const handleCreateFolder = React.useCallback((name: string) => {
    setIsAddingFolder(false);
    if (!name.trim()) return;

    const newFolderId = chatFoldersActions().createFolder(name.trim(), newFolderColor || undefined);
    onFolderCreated?.(newFolderId);
  }, [newFolderColor, onFolderCreated, setIsAddingFolder]);


  return isAddingFolder ? (
    <ListItem>
      <ListItemDecorator>
        <FolderIcon style={{ color: newFolderColor || 'inherit' }} />
      </ListItemDecorator>
      <InlineTextarea
        initialText=''
        placeholder='Folder Name'
        onEdit={handleCreateFolder}
        onCancel={handleCancelAddFolder}
        sx={{ ml: -1.5, mr: -0.5, flexGrow: 1, minWidth: 100 }}
      />
      {/*<IconButton color='danger' onClick={handleCancelAddFolder}>*/}
      {/*  <CloseRoundedIcon />*/}
      {/*</IconButton>*/}
    </ListItem>
  ) : (
    <ListItem>
      <ListItemButton
        onClick={handleStartAddFolder}
        // sx={buttonSx}
      >
        <ListItemDecorator>
          <AddIcon sx={{ fontSize: 'xl', pl: '0.25rem' }} />
        </ListItemDecorator>
        New folder
      </ListItemButton>
    </ListItem>
  );
}