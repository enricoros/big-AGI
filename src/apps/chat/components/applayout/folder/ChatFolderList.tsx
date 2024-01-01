import * as React from 'react';

import Sheet, { sheetClasses } from '@mui/joy/Sheet';
import Typography from '@mui/joy/Typography';
import { Box, Button, IconButton, Input } from '@mui/joy';

import { DFolder, useFolderStore } from '~/common/state/store-folders';
import { DConversation } from '~/common/state/store-chats';
import { useState } from 'react';


import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DoneIcon from '@mui/icons-material/Done';
import OutlineFolderIcon from '@mui/icons-material/Folder';


export function ChatFolderList() {
  // local state
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // external state
  
  // Get the createFolder action from the store
  const { createFolder } = useFolderStore((state) => ({
    createFolder: state.createFolder,
  }));


  // handlers

  // Handler to create a new folder
  const handleCreateFolder = () => {
    // check min length
    if (newFolderName.trim() !== '') {
      createFolder(newFolderName.trim());
      setNewFolderName('');
      setIsAddingFolder(false);
    }
  };

  // Handler to cancel adding a new folder
  const handleCancelAddFolder = () => {
    setNewFolderName('');
    setIsAddingFolder(false);
  };

  return (
    <Sheet variant="soft" sx={{ width: 343, p: 2, borderRadius: 'sm' }}>
      <Typography level="h3" fontSize="xl" fontWeight="xl" mb={1}>
        Folders
      </Typography>
      <div>Folder List</div>
      {isAddingFolder ? (
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
      )}
    </Sheet>
  );
}
