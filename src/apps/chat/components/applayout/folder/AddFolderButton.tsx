import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Button, IconButton, ListItem, ListItemDecorator } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DoneIcon from '@mui/icons-material/Done';
import OutlineFolderIcon from '@mui/icons-material/Folder';

import { InlineTextarea } from '~/common/components/InlineTextarea';
import { useFolderStore } from '~/common/state/store-folders';


export function AddFolderButton() {

  // state
  const [isAddingFolder, setIsAddingFolder] = React.useState(false);
  const [newFolderName, setNewFolderName] = React.useState('');

  const { createFolder } = useFolderStore((state) => ({
    createFolder: state.createFolder,
  }), shallow);

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      createFolder(newFolderName.trim());
      setNewFolderName('');
    }
    setIsAddingFolder(false);
  };

  const handleCancelAddFolder = () => {
    setNewFolderName('');
    setIsAddingFolder(false);
  };

  return isAddingFolder ? (
    <ListItem sx={{
      '--ListItem-paddingLeft': '0.75rem',
      '--ListItem-minHeight': '3rem', // --Folder-ListItem-height
      display: 'flex', alignItems: 'center', gap: 1,
    }}>
      <ListItemDecorator>
        <OutlineFolderIcon />
      </ListItemDecorator>
      <InlineTextarea initialText={newFolderName} placeholder='Folder Name' onEdit={setNewFolderName} />
      <IconButton color='success' onClick={handleCreateFolder}>
        <DoneIcon />
      </IconButton>
      <IconButton color='danger' onClick={handleCancelAddFolder}>
        <CloseIcon />
      </IconButton>
    </ListItem>
  ) : (
    <Button
      color='primary'
      variant='plain'
      startDecorator={<AddIcon />}
      onClick={() => setIsAddingFolder(true)}
      sx={{ minHeight: '3rem' }} // --Folder-ListItem-height
    >
      New folder
    </Button>
  );
}
