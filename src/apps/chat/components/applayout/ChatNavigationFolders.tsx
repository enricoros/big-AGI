import React from 'react';
import { DFolder, useFolderStore } from '~/common/state/store-folders';
import { Box, List, IconButton, ListItem, ListItemButton, ListItemDecorator, ListItemContent } from '@mui/joy';
import FolderIcon from '@mui/icons-material/Folder';
import AddBoxIcon from '@mui/icons-material/AddBox';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { DConversation, DConversationId } from '~/common/state/store-chats';
import { ChatNavigationItemMemo } from './ChatNavigationItem';

export const ChatNavigationFolders = ({
  onFolderSelect,
  onFolderCreate,
  folders,
  selectedFolderId,
  activeConversationId,
  isLonely,
  maxChatMessages,
  showSymbols,
  onConversationActivate,
  onConversationDelete,
  conversationsByFolder,

}: {
  onFolderSelect: (folderId: string | null) => void,
  onFolderCreate: (folderTitle: string) => void,
  folders: DFolder[], // Add this prop
  selectedFolderId: string | null, // Add this prop
  activeConversationId: string | null,
  isLonely: boolean,
  maxChatMessages: number,
  showSymbols: boolean,
  onConversationActivate: (conversationId: DConversationId, closeMenu: boolean) => void,
  onConversationDelete: (conversationId: DConversationId) => void,
  conversationsByFolder: DConversation[], // Add this prop
}) => {
  
  // Add a constant for the default folder title
  const DEFAULT_FOLDER_TITLE = 'General';

  const deleteFolder = useFolderStore((state) => state.deleteFolder);
  const [deleteArmedFolderId, setDeleteArmedFolderId] = React.useState<string | null>(null);

  const handleFolderSelect = (folderId: string | null) => {
    onFolderSelect(folderId);
  };

  const handleFolderCreate = () => {
    const folderTitle = prompt('Enter folder name:');
    if (folderTitle) {
      onFolderCreate(folderTitle);
    }
  };


  const handleFolderDelete = (folderId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setDeleteArmedFolderId(folderId); // Arm the deletion instead of confirming immediately
  };

  const handleConfirmDelete = (folderId: string) => {
    deleteFolder(folderId);
    if (selectedFolderId === folderId) {
      onFolderSelect(null);
    }
    setDeleteArmedFolderId(null); // Disarm the deletion
  };

  const handleCancelDelete = () => {
    setDeleteArmedFolderId(null); // Disarm the deletion
  };


  return (
    <Box>
      <List>
          {/* Add a ListItem for the default folder */}
          <ListItem key="default-folder">
          <ListItemButton
            onClick={() => handleFolderSelect(null)}
            selected={selectedFolderId === null}
            sx={{
              justifyContent: 'space-between',
              '&:hover .delete-icon': {
                visibility: 'hidden', // Hide delete icon for default folder
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <ListItemDecorator><FolderIcon /></ListItemDecorator>
              <ListItemContent>{DEFAULT_FOLDER_TITLE}</ListItemContent>
            </Box>
          </ListItemButton>
        </ListItem>

        {/* Render the default folder's conversations when selected */}
        {selectedFolderId === null && (
          <List 
            sx={{
                paddingLeft: 2,
            }}
          >
            {conversationsByFolder.map((conversation) => (
              <ChatNavigationItemMemo
                key={'nav-' + conversation.id}
                conversation={conversation}
                isActive={conversation.id === activeConversationId}
                isLonely={isLonely}
                maxChatMessages={maxChatMessages}
                showSymbols={showSymbols}
                onConversationActivate={onConversationActivate}
                onConversationDelete={onConversationDelete}
              />
            ))}
          </List>
        )}

        {folders.map((folder) => (
          <React.Fragment key={folder.id}>
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
                {deleteArmedFolderId !== folder.id && (
                  <ListItemDecorator className="delete-icon" sx={{ visibility: 'hidden' }}>
                    <IconButton color="neutral" onClick={(event) => handleFolderDelete(folder.id, event)}>
                      <DeleteOutlineIcon />
                  </IconButton>
                  </ListItemDecorator>
                )}
                {/* Confirm/Cancel delete buttons */}
                {deleteArmedFolderId === folder.id && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                    <IconButton color="danger" onClick={() => handleConfirmDelete(folder.id)}>
                      <DeleteOutlineIcon />
                    </IconButton>
                    <IconButton color="neutral" onClick={handleCancelDelete}>
                      <CloseIcon />
                    </IconButton>
                  </Box>
                )}
              </ListItemButton>
            </ListItem>
            {/* now if selected show conversations */}
            {selectedFolderId === folder.id && (
              <List 
                sx={{
                  paddingLeft: 2,
                }}>
                {conversationsByFolder.map((conversation) => (
                  <ChatNavigationItemMemo
                    key={'nav-' + conversation.id}
                    conversation={conversation}
                    isActive={conversation.id === activeConversationId}
                    isLonely={isLonely}
                    maxChatMessages={maxChatMessages}
                    showSymbols={showSymbols}
                    onConversationActivate={onConversationActivate}
                    onConversationDelete={onConversationDelete}
                  />
                ))}
              </List>
            )}
          </React.Fragment>

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