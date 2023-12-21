import React from 'react';
import { useFolderStore } from '~/common/state/store-folders';
import { Box, List, ListItem, ListItemButton, ListItemDecorator, ListItemContent } from '@mui/joy';
import FolderIcon from '@mui/icons-material/Folder';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteIcon from '@mui/icons-material/Delete';

export const Folders = ({ onFolderSelect, onFolderCreate }: { onFolderSelect: (folderId: string | null) => void, onFolderCreate: (folderTitle: string) => void }) => {
  
  // Internal state
  const [selectedFolderId, setSelectedFolderId] = React.useState<string | null>(null);

  // External state
  const folders = useFolderStore((state) => state.folders);
  const deleteFolder = useFolderStore((state) => state.deleteFolder);

  const handleFolderSelect = (folderId: string) => {
    onFolderSelect(folderId);
    setSelectedFolderId(folderId);
  };

  const handleFolderCreate = () => {
    const folderTitle = prompt('Enter folder name:');
    if (folderTitle) {
      onFolderCreate(folderTitle);
    }
  };

  const handleFolderDelete = (folderId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent ListItemButton onClick from being triggered
    if (window.confirm('Are you sure you want to delete this folder?')) {
      deleteFolder(folderId);
      if (selectedFolderId === folderId) {
        setSelectedFolderId(null); // Reset selection if the deleted folder was selected
        onFolderSelect(''); // Notify parent component about the deletion
      }
    }
  };

  return (
    <Box>
      <List>
        {folders.map((folder) => (
          <ListItem key={folder.id}>
            <ListItemButton 
              onClick={() => handleFolderSelect(folder.id)} 
              selected={folder.id === selectedFolderId}
              sx={{ justifyContent: 'space-between',
              '&:hover .delete-icon': {
                visibility: 'visible', // Show delete icon on hover
              } }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ListItemDecorator><FolderIcon /></ListItemDecorator>
                <ListItemContent>{folder.title}</ListItemContent>
              </Box>
              <ListItemDecorator className="delete-icon" sx={{ visibility: 'hidden' }}>
                <DeleteIcon onClick={(event) => handleFolderDelete(folder.id, event)} />
              </ListItemDecorator>
            </ListItemButton>
          </ListItem>
        ))}
        <ListItem>
          <ListItemButton onClick={handleFolderCreate}>
            <ListItemDecorator><AddBoxIcon /></ListItemDecorator>
            <ListItemContent>Create New Folder</ListItemContent>              
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );
};