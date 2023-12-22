import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, ListDivider, ListItemDecorator, MenuItem, Typography } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FileUploadIcon from '@mui/icons-material/FileUpload';

import { DConversationId, useChatStore, useConversationsByFolder } from '~/common/state/store-chats';
import { OpenAIIcon } from '~/common/components/icons/OpenAIIcon';
import { closeLayoutDrawer } from '~/common/layout/store-applayout';
import { useUIPreferencesStore } from '~/common/state/store-ui';
import { useUXLabsStore } from '~/common/state/store-ux-labs';

import { ChatNavigationItemMemo } from './ChatNavigationItem';
import { ChatNavigationFolders }  from './ChatNavigationFolders';
import { useFolderStore } from '~/common/state/store-folders'; 


// type ListGrouping = 'off' | 'persona';

export const ChatDrawerItemsMemo = React.memo(ChatDrawerItems);

function ChatDrawerItems(props: {
  activeConversationId: DConversationId | null,
  disableNewButton: boolean,
  onConversationActivate: (conversationId: DConversationId) => void,
  onConversationDelete: (conversationId: DConversationId, bypassConfirmation: boolean) => void,
  onConversationImportDialog: () => void,
  onConversationNew: () => DConversationId,
  onConversationsDeleteAll: () => void,
  selectedFolderId: string | null,
  setSelectedFolderId: (folderId: string | null) => void,
}) {

  const { selectedFolderId, setSelectedFolderId } = props;

  // local state
  const { onConversationDelete, onConversationNew, onConversationActivate } = props;
  // const [grouping] = React.useState<ListGrouping>('off');
  // Add state to track the selected folder

  // external state
  //const conversations = useChatStore(state => state.conversations, shallow);
  const conversations = useConversationsByFolder(selectedFolderId);

  const showSymbols = useUIPreferencesStore(state => state.zenMode !== 'cleaner');
  const labsEnhancedUI = useUXLabsStore(state => state.labsEnhancedUI);
  const createFolder = useFolderStore((state) => state.createFolder);
  const addConversationToFolder = useFolderStore((state) => state.addConversationToFolder);


  // derived state
  const maxChatMessages = conversations.reduce((longest, _c) => Math.max(longest, _c.messages.length), 1);
  const totalConversations = conversations.length;
  const hasChats = totalConversations > 0;
  const singleChat = totalConversations === 1;
  const softMaxReached = totalConversations >= 50;


  const handleFolderSelect = (folderId: string | null) => {
    // Logic to handle folder selection
    setSelectedFolderId(folderId);

    // Optionally, you could automatically activate the first conversation in the folder
    console.log('Folder selected: ', folderId);

  };

  const handleFolderCreate = (folderTitle: string) => {
    const newFolderId = createFolder(folderTitle);
    // Optionally, you could automatically add the current conversation to the new folder
    // addConversationToFolder(newFolderId, props.activeConversationId);
  };

  const handleButtonNew = React.useCallback(() => {
    const newConversationId = onConversationNew();
    console.log('New conversation created: ', newConversationId); 
    if (selectedFolderId) {
      console.log('Adding conversation to folder: ', selectedFolderId);
      addConversationToFolder(selectedFolderId, newConversationId);
    }
    closeLayoutDrawer();
  }, [onConversationNew, selectedFolderId, addConversationToFolder]);
  


  const handleConversationActivate = React.useCallback((conversationId: DConversationId, closeMenu: boolean) => {
    onConversationActivate(conversationId);
    if (closeMenu)
      closeLayoutDrawer();
  }, [onConversationActivate]);

  const handleConversationDelete = React.useCallback((conversationId: DConversationId) => {
    !singleChat && conversationId && onConversationDelete(conversationId, true);
  }, [onConversationDelete, singleChat]);


  // grouping
  /*let sortedIds = conversationIDs;
  if (grouping === 'persona') {
    const conversations = useChatStore.getState().conversations;

    // group conversations by persona
    const groupedConversations: { [personaId: string]: string[] } = {};
    conversations.forEach(conversation => {
      const persona = conversation.systemPurposeId;
      if (persona) {
        if (!groupedConversations[persona])
          groupedConversations[persona] = [];
        groupedConversations[persona].push(conversation.id);
      }
    });

    // flatten grouped conversations
    sortedIds = Object.values(groupedConversations).flat();
  }*/

  return <>

    {/*<ListItem>*/}
    {/*  <Typography level='body-sm'>*/}
    {/*    Active chats*/}
    {/*  </Typography>*/}
    {/*</ListItem>*/}

    {/* Include the Folders component */}
    <ChatNavigationFolders 
      onFolderSelect={handleFolderSelect} 
      onFolderCreate={handleFolderCreate}
      folders={useFolderStore((state) => state.folders)}
      selectedFolderId={selectedFolderId}
      activeConversationId={props.activeConversationId}
      isLonely={singleChat}
      maxChatMessages={maxChatMessages}
      showSymbols={showSymbols}
      onConversationActivate={handleConversationActivate}
      onConversationDelete={handleConversationDelete}
      conversationsByFolder={conversations}
      />

    <MenuItem disabled={props.disableNewButton} onClick={handleButtonNew}>
      <ListItemDecorator><AddIcon /></ListItemDecorator>
      <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'space-between', gap: 1 }}>
        New
        {/*<KeyStroke combo='Ctrl + Alt + N' />*/}
      </Box>
    </MenuItem>

    <ListDivider sx={{ mt: 0 }} />

    <MenuItem onClick={props.onConversationImportDialog}>
      <ListItemDecorator>
        <FileUploadIcon />
      </ListItemDecorator>
      Import chats
      <OpenAIIcon sx={{ fontSize: 'xl', ml: 'auto' }} />
    </MenuItem>

    <MenuItem disabled={!hasChats} onClick={props.onConversationsDeleteAll}>
      <ListItemDecorator><DeleteOutlineIcon /></ListItemDecorator>
      <Typography>
        Delete {totalConversations >= 2 ? `all ${totalConversations} chats` : 'chat'}
      </Typography>
    </MenuItem>

  </>;
}