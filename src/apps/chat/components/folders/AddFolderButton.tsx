import * as React from 'react';

import { Button, ListItem, ListItemDecorator } from '@mui/joy';
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
    <ListItem sx={{
      '--ListItem-paddingLeft': '0.75rem',
      '--ListItem-minHeight': '3rem', // --Folder-ListItem-height
      display: 'flex', alignItems: 'center', gap: 1,
    }}>
      <ListItemDecorator>
        <FolderIcon style={{ color: newFolderColor || 'inherit' }} />
      </ListItemDecorator>
      <InlineTextarea
        initialText='' placeholder='Folder Name'
        onEdit={handleCreateFolder}
        onCancel={handleCancelAddFolder}
        sx={{
          flexGrow: 1,
        }} />
      {/*<IconButton color='danger' onClick={handleCancelAddFolder}>*/}
      {/*  <CloseIcon />*/}
      {/*</IconButton>*/}
    </ListItem>
  ) : (
    <Button
      color='neutral'
      variant='plain'
      startDecorator={<AddIcon />}
      onClick={handleAddFolder}
      sx={{
        // display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
        // minHeight: '3rem', // --Folder-ListItem-height
        // match the forder elements
        paddingInline: '1.2rem',
        gap: '0.75rem',
        // fontWeight: 400,
      }}
    >
      New folder
    </Button>
  );
}
