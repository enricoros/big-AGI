import * as React from 'react';

import { ListItem, ListItemButton, ListItemDecorator } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import FolderIcon from '@mui/icons-material/Folder';

import { InlineTextarea } from '~/common/components/InlineTextarea';
import { getRotatingFolderColor, useFolderStore } from '~/common/state/store-folders';


export function AddFolderButton() {

  // state
  const [isAddingFolder, setIsAddingFolder] = React.useState(false);
  const [newFolderColor, setNewFolderColor] = React.useState<string | null>(null);


  const handleAddFolder = () => {
    setNewFolderColor(getRotatingFolderColor());
    setIsAddingFolder(true);
  };

  const handleCreateFolder = (name: string) => {
    if (name.trim())
      useFolderStore.getState().createFolder(name.trim(), newFolderColor || undefined);
    setIsAddingFolder(false);
  };

  const handleCancelAddFolder = () => {
    setIsAddingFolder(false);
  };

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
      {/*  <CloseIcon />*/}
      {/*</IconButton>*/}
    </ListItem>
  ) : (
    <ListItem>
      <ListItemButton
        onClick={handleAddFolder}
        sx={{
          // smaller than the folder icons (sty by parent)
          '--Icon-fontSize': 'var(--joy-fontSize-xl)',
          fontSize: 'sm',
          fontWeight: 'lg',
        }}
      >
        <ListItemDecorator>
          <AddIcon sx={{ pl: '0.125rem' }} />
        </ListItemDecorator>
        New folder
      </ListItemButton>
    </ListItem>
  );
}
