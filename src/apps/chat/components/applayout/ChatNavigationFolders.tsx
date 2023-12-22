import React from 'react';
import { DFolder, useFolderStore } from '~/common/state/store-folders';
import { Box, List, ListItem, ListItemButton, ListItemDecorator, ListItemContent } from '@mui/joy';
import FolderIcon from '@mui/icons-material/Folder';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteIcon from '@mui/icons-material/Delete';
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
    event.stopPropagation(); // Prevent ListItemButton onClick from being triggered
    if (window.confirm('Are you sure you want to delete this folder?')) {
      deleteFolder(folderId);
      if (selectedFolderId === folderId) {
        onFolderSelect(null); // Notify parent component about the deletion
      }
    }
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
          <>
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
          </>

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