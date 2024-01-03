import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, IconButton, ListDivider, ListItemDecorator, MenuItem, Tooltip } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';

import { DFolder, useFoldersToggle, useFolderStore } from '~/common/state/store-folders';
import { OpenAIIcon } from '~/common/components/icons/OpenAIIcon';
import { PageDrawerHeader } from '~/common/layout/optima/components/PageDrawerHeader';
import { PageDrawerList, PageDrawerTallItemSx } from '~/common/layout/optima/components/PageDrawerList';
import { conversationTitle, DConversationId, useChatStore } from '~/common/state/store-chats';
import { useOptimaDrawers } from '~/common/layout/optima/useOptimaDrawers';
import { useUIPreferencesStore } from '~/common/state/store-ui';
import { useUXLabsStore } from '~/common/state/store-ux-labs';

import { ChatFolderList } from './folder/ChatFolderList';
import { ChatDrawerItemMemo, ChatNavigationItemData } from './ChatNavigationItem';

// type ListGrouping = 'off' | 'persona';


/*
 * Optimization: return a reduced version of the DConversation object for 'Drawer Items' purposes,
 * to avoid unnecessary re-renders on each new character typed by the assistant
 */
export const useChatNavigationItems = (activeConversationId: DConversationId | null, folderId: string | null): {
  chatNavItems: ChatNavigationItemData[],
  folders: DFolder[],
} => {

  // monitor folder changes
  // NOTE: we're not checking for state.useFolders, as we strongly assume folderId to be null when folders are disabled
  const { currentFolder, folders } = useFolderStore(state => {
    const currentFolder = folderId ? state.folders.find(_f => _f.id === folderId) ?? null : null;
    return {
      folders: state.folders,
      currentFolder,
    };
  }, shallow);

  // transform (folder) selected conversation into optimized 'navigation item' data
  const chatNavItems: ChatNavigationItemData[] = useChatStore(state => {

    const selectConversations = currentFolder
      ? state.conversations.filter(_c => currentFolder.conversationIds.includes(_c.id))
      : state.conversations;

    return selectConversations.map(_c => ({
      conversationId: _c.id,
      isActive: _c.id === activeConversationId,
      title: conversationTitle(_c, 'New Title'),
      messageCount: _c.messages.length,
      assistantTyping: !!_c.abortController,
      systemPurposeId: _c.systemPurposeId,
    }));

  }, (a: ChatNavigationItemData[], b: ChatNavigationItemData[]) => {
    // custom equality function to avoid unnecessary re-renders
    return a.length === b.length && a.every((_a, i) => shallow(_a, b[i]));
  });

  return { chatNavItems, folders };
};


export const ChatDrawerContentMemo = React.memo(ChatDrawerItems);

function ChatDrawerItems(props: {
  activeConversationId: DConversationId | null,
  disableNewButton: boolean,
  onConversationActivate: (conversationId: DConversationId) => void,
  onConversationDelete: (conversationId: DConversationId, bypassConfirmation: boolean) => void,
  onConversationImportDialog: () => void,
  onConversationNew: () => void,
  onConversationsDeleteAll: () => void,
  selectedFolderId: string | null,
  setSelectedFolderId: (folderId: string | null) => void,
}) {

  // local state
  // const [grouping] = React.useState<ListGrouping>('off');
  const { onConversationDelete, onConversationNew, onConversationActivate } = props;

  // external state
  const { closeDrawer, closeDrawerOnMobile } = useOptimaDrawers();
  const { useFolders, toggleUseFolders } = useFoldersToggle();
  const { chatNavItems, folders } = useChatNavigationItems(props.activeConversationId, props.selectedFolderId);
  const showSymbols = useUIPreferencesStore(state => state.zenMode !== 'cleaner');
  const labsEnhancedUI = useUXLabsStore(state => state.labsEnhancedUI);

  // derived state
  const maxChatMessages = chatNavItems.reduce((longest, _c) => Math.max(longest, _c.messageCount), 1);
  const selectConversationsCount = chatNavItems.length;
  const hasChats = selectConversationsCount > 0;
  const singleChat = selectConversationsCount === 1;
  const softMaxReached = selectConversationsCount >= 50;


  const handleButtonNew = React.useCallback(() => {
    onConversationNew();
    closeDrawerOnMobile();
  }, [closeDrawerOnMobile, onConversationNew]);

  const handleConversationActivate = React.useCallback((conversationId: DConversationId, closeMenu: boolean) => {
    onConversationActivate(conversationId);
    if (closeMenu)
      closeDrawerOnMobile();
  }, [closeDrawerOnMobile, onConversationActivate]);

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

    {/* Drawer Header */}
    <PageDrawerHeader
      title='Chats'
      onClose={closeDrawer}
      startButton={
        <Tooltip title={useFolders ? 'Hide Folders' : 'Use Folders'}>
          <IconButton onClick={toggleUseFolders}>
            {useFolders ? <FolderOpenOutlinedIcon /> : <FolderOutlinedIcon />}
          </IconButton>
        </Tooltip>
      }
    />

    {/* Folders List */}
    {useFolders && (
      <ChatFolderList
        folders={folders}
        selectedFolderId={props.selectedFolderId}
        onFolderSelect={props.setSelectedFolderId}
      />
    )}

    {/* Chats List */}
    <PageDrawerList variant='plain' noTopPadding noBottomPadding tallRows>

      {useFolders && <ListDivider sx={{ mb: 0 }} />}

      <MenuItem disabled={props.disableNewButton} onClick={handleButtonNew} sx={PageDrawerTallItemSx}>
        <ListItemDecorator><AddIcon /></ListItemDecorator>
        <Box sx={{
          // style
          fontSize: 'sm',
          fontWeight: 'lg',
          // content
          flexGrow: 1,
          display: 'flex',
          justifyContent: 'space-between',
          gap: 1,
        }}>
          New chat
          {/*<KeyStroke combo='Ctrl + Alt + N' sx={props.disableNewButton ? { opacity: 0.5 } : undefined} />*/}
        </Box>
      </MenuItem>

      {/*<ListDivider sx={{ mt: 0 }} />*/}

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {/*<ListItem sticky sx={{ justifyContent: 'space-between', boxShadow: 'sm' }}>*/}
        {/*  <Typography level='body-sm'>*/}
        {/*    Conversations*/}
        {/*  </Typography>*/}
        {/*  <ToggleButtonGroup variant='soft' size='sm' value={grouping} onChange={(_event, newValue) => newValue && setGrouping(newValue)}>*/}
        {/*    <IconButton value='off'>*/}
        {/*      <AccessTimeIcon />*/}
        {/*    </IconButton>*/}
        {/*    <IconButton value='persona'>*/}
        {/*      <PersonIcon />*/}
        {/*    </IconButton>*/}
        {/*  </ToggleButtonGroup>*/}
        {/*</ListItem>*/}

        {chatNavItems.map(item =>
          <ChatDrawerItemMemo
            key={'nav-' + item.conversationId}
            item={item}
            isLonely={singleChat}
            maxChatMessages={(labsEnhancedUI || softMaxReached) ? maxChatMessages : 0}
            showSymbols={showSymbols}
            onConversationActivate={handleConversationActivate}
            onConversationDelete={handleConversationDelete}
          />)}
      </Box>

      <ListDivider sx={{ mt: 0 }} />

      <MenuItem onClick={props.onConversationImportDialog}>
        <ListItemDecorator>
          <FileUploadIcon />
        </ListItemDecorator>
        Import chats
        <OpenAIIcon sx={{ fontSize: 'xl', ml: 'auto' }} />
      </MenuItem>

      <MenuItem disabled={!hasChats} onClick={props.onConversationsDeleteAll}>
        <ListItemDecorator>
          <DeleteOutlineIcon />
        </ListItemDecorator>
        Delete {selectConversationsCount >= 2 ? `all ${selectConversationsCount} chats` : 'chat'}
      </MenuItem>

    </PageDrawerList>

  </>;
}