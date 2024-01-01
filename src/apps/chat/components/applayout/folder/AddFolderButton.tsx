import * as React from 'react';
import { useState } from 'react';
import { Box, IconButton, Input, Button } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DoneIcon from '@mui/icons-material/Done';
import OutlineFolderIcon from '@mui/icons-material/Folder';
import { useFolderStore } from '~/common/state/store-folders';

export function AddFolderButton() {
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const { createFolder } = useFolderStore((state) => ({
    createFolder: state.createFolder,
  }));

  const handleCreateFolder = () => {
    if (newFolderName.trim() !== '') {
      createFolder(newFolderName.trim());
      setNewFolderName('');
      setIsAddingFolder(false);
    }
  };

  const handleCancelAddFolder = () => {
    setNewFolderName('');
    setIsAddingFolder(false);
  };

  return isAddingFolder ? (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <OutlineFolderIcon sx={{ ml: '13px' }} />
      <Input
        placeholder="Folder name"
        value={newFolderName}
        onChange={(e) => setNewFolderName(e.target.value)}
        onKeyPress={(e) => {
          if (e.key === 'Enter') handleCreateFolder();
        }}
        autoFocus
        sx={{ ml: '0px' }}
      />
      <IconButton color="success" onClick={handleCreateFolder}>
        <DoneIcon />
      </IconButton>
      <IconButton color="danger" onClick={handleCancelAddFolder}>
        <CloseIcon />
      </IconButton>
    </Box>
  ) : (
    <Button
      color="primary"
      variant="plain"
      startDecorator={<AddIcon />}
      sx={{ display: 'flex', justifyContent: 'flex-start' }}
      onClick={() => setIsAddingFolder(true)}
    >
      New folder
    </Button>
  );
}
