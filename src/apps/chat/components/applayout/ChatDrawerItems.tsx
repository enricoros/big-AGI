import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Avatar, Box, IconButton, Input, InputProps, List, ListDivider, ListItem, ListItemButton, ListItemDecorator, MenuItem, Sheet, Typography, useTheme } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';

import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import ExpandCircleDownIcon from '@mui/icons-material/ExpandCircleDown';

import { DConversation, DConversationId, useChatStore, useConversationsByFolder } from '~/common/state/store-chats';
import { OpenAIIcon } from '~/common/components/icons/OpenAIIcon';
import { closeLayoutDrawer } from '~/common/layout/store-applayout';
import { useUIPreferencesStore } from '~/common/state/store-ui';
import { useUXLabsStore } from '~/common/state/store-ux-labs';

import { ChatNavigationItemMemo } from './ChatNavigationItem';

import ChatSidebar from './ChatSidebar';

import { useFolderStore } from '~/common/state/store-folders'; 
import { CSSProperties, useEffect, useRef, useState } from 'react';


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
  };

  const handleFolderCreate = (folderTitle: string) => {
    const newFolderId = createFolder(folderTitle);
    
    // select the new folder
    setSelectedFolderId(newFolderId);
  };

  const handleButtonNew = React.useCallback(() => {
    const newConversationId = onConversationNew();
    if (selectedFolderId) {
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

  const ConversationList = ({ conversations }: { conversations: DConversation[] }) => {
    const listRef = useRef<HTMLDivElement>(null);
    const [showDownArrow, setShowDownArrow] = useState(false);
    const [showUpArrow, setShowUpArrow] = useState(false);


  
    const theme = useTheme();
  
    const checkForOverflow = () => {
      const currentList = listRef.current;
      if (currentList) {
        const isOverflowing = currentList.scrollHeight > currentList.clientHeight;
        setShowDownArrow(isOverflowing);
        setShowUpArrow(false); // Initially, we don't want to show the up arrow
      }
    };
  
    const checkScrollPosition = () => {
      const currentList = listRef.current;
      if (currentList) {
        const isAtBottom = currentList.scrollHeight - currentList.scrollTop === currentList.clientHeight;
        const isAtTop = currentList.scrollTop === 0;
        setShowDownArrow(!isAtBottom);
        setShowUpArrow(!isAtTop);
      }
    };
  
    useEffect(() => {
      checkForOverflow();
      window.addEventListener('resize', checkForOverflow);
  
      // Add scroll event listener
      const currentList = listRef.current;
      if (currentList) {
        currentList.addEventListener('scroll', checkScrollPosition);
      }
  
      return () => {
        window.removeEventListener('resize', checkForOverflow);
        // Remove scroll event listener
        if (currentList) {
          currentList.removeEventListener('scroll', checkScrollPosition);
        }
      };
    }, [conversations]);
  
    const styles: { container: CSSProperties; listContainer: CSSProperties; arrow: CSSProperties, arrowDown: CSSProperties, arrowUp: CSSProperties } = {
      container: {
        position: 'relative', // Container for both list and arrows
        maxHeight: '200px',
      },
      listContainer: {
        maxHeight: '200px',
        overflow: 'auto',
      },
      arrow: {
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        color: theme.palette.text.secondary,
        opacity: 0.7,
        fontSize: '30px',
      },
      arrowDown: {
        bottom: 0,
      },
      arrowUp: {
        top: 10,
        // rotate arrow 180 degrees
        transform: 'translateX(-50%) rotate(180deg)',
      },
    };
  
    return (
      <div style={styles.container}>
        <div style={styles.listContainer} ref={listRef}>
          <List>
            {conversations.map((conversation, index) => (
               <ChatNavigationItemMemo
               key={'nav-' + conversation.id}
               conversation={conversation}
               isActive={conversation.id === props.activeConversationId}
               isLonely={singleChat}
               maxChatMessages={(labsEnhancedUI || softMaxReached) ? maxChatMessages : 0}
               showSymbols={showSymbols}
               onConversationActivate={handleConversationActivate}
               onConversationDelete={handleConversationDelete}
             />
            ))}
          </List>
        </div>
        {showUpArrow && (
          <ExpandCircleDownIcon
            style={{ ...styles.arrow, ...styles.arrowUp }}
            onClick={() => {
              listRef.current?.scrollTo({
                top: 0,
                behavior: 'smooth',
              });
            }}
          />
        )}
        {showDownArrow && (
          <ExpandCircleDownIcon
            style={{ ...styles.arrow, ...styles.arrowDown }}
            onClick={() => {
              listRef.current?.scrollTo({
                top: listRef.current?.scrollHeight,
                behavior: 'smooth',
              });
            }}
          />
        )}
      </div>
    );
  };
  
  

  
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

    <ChatSidebar 
        onFolderSelect={handleFolderSelect} 
        folders={useFolderStore((state) => state.folders)}
        selectedFolderId={selectedFolderId}
        conversationsByFolder={conversations}
        />

    {/* show all ChatNavigation items */}
    <Sheet variant="soft" sx={{ width: 343, p: 2, borderRadius: 'sm' }}>
      {/* Search input for conversations */}



      <Input
        startDecorator={<SearchIcon />}
        sx={{ mb: 2 }}
        placeholder='Filter by title'
      />

      <ConversationList conversations={conversations} />

    </Sheet>

    <MenuItem disabled={props.disableNewButton} onClick={handleButtonNew}>
      <ListItemDecorator><AddIcon /></ListItemDecorator>
      <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'space-between', gap: 1 }}>
        New chat
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