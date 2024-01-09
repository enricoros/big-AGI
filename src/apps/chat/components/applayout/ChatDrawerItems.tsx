import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, IconButton, ListDivider, ListItemButton, ListItemDecorator, Tooltip } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';

import { DFolder, useFoldersToggle, useFolderStore } from '~/common/state/store-folders';
import { PageDrawerHeader } from '~/common/layout/optima/components/PageDrawerHeader';
import { PageDrawerList, PageDrawerTallItemSx } from '~/common/layout/optima/components/PageDrawerList';
import { conversationTitle, DConversationId, useChatStore } from '~/common/state/store-chats';
import { useOptimaDrawers } from '~/common/layout/optima/useOptimaDrawers';
import { useUIPreferencesStore } from '~/common/state/store-ui';
import { useUXLabsStore } from '~/common/state/store-ux-labs';
import DebounceInput from '~/common/components/DebounceInput';

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
      isEmpty: !_c.messages.length && !_c.userTitle,
      title: conversationTitle(_c),
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
  onConversationExportDialog: (conversationId: DConversationId | null) => void,
  onConversationImportDialog: () => void,
  onConversationNew: () => void,
  onConversationsDeleteAll: () => void,
  selectedFolderId: string | null,
  setSelectedFolderId: (folderId: string | null) => void,
}) {

  // local state
  const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState('');

  // const [grouping] = React.useState<ListGrouping>('off');
  const { onConversationDelete, onConversationNew, onConversationActivate } = props;

  // external state
  const { closeDrawer, closeDrawerOnMobile } = useOptimaDrawers();
  const { useFolders, toggleUseFolders } = useFoldersToggle();
  const { chatNavItems, folders } = useChatNavigationItems(props.activeConversationId, props.selectedFolderId);
  const showSymbols = useUIPreferencesStore(state => state.zenMode !== 'cleaner');
  const labsEnhancedUI = useUXLabsStore(state => state.labsEnhancedUI);

  // derived state
  const selectConversationsCount = chatNavItems.length;
  const nonEmptyChats = selectConversationsCount > 1 || (selectConversationsCount === 1 && !chatNavItems[0].isEmpty);
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


  // Filter chatNavItems based on the search query and rank them by search frequency
  const filteredChatNavItems = React.useMemo(() => {
    if (!debouncedSearchQuery) return chatNavItems;
    return chatNavItems
      .map(item => {
        // Get the conversation by ID
        const conversation = useChatStore.getState().conversations.find(c => c.id === item.conversationId);
        // Calculate the frequency of the search term in the title and messages
        const titleFrequency = (item.title.toLowerCase().match(new RegExp(debouncedSearchQuery.toLowerCase(), 'g')) || []).length;
        const messageFrequency = conversation?.messages.reduce((count, message) => {
          return count + (message.text.toLowerCase().match(new RegExp(debouncedSearchQuery.toLowerCase(), 'g')) || []).length;
        }, 0) || 0;
        // Return the item with the searchFrequency property
        return {
          ...item,
          searchFrequency: titleFrequency + messageFrequency,
        };
      })
      // Exclude items with a searchFrequency of 0
      .filter(item => item.searchFrequency > 0)
      // Sort the items by searchFrequency in descending order
      .sort((a, b) => b.searchFrequency! - a.searchFrequency!);
  }, [chatNavItems, debouncedSearchQuery]);


  // basis for the underline bar
  const bottomBarBasis = filteredChatNavItems.reduce((longest, _c) => Math.max(longest, _c.searchFrequency ?? _c.messageCount), 1);


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
    {/*<Box sx={{*/}
    {/*  display: 'grid',*/}
    {/*  gridTemplateRows: !useFolders ? '0fr' : '1fr',*/}
    {/*  transition: 'grid-template-rows 0.42s cubic-bezier(.17,.84,.44,1)',*/}
    {/*  '& > div': {*/}
    {/*    padding: useFolders ? 2 : 0,*/}
    {/*    transition: 'padding 0.42s cubic-bezier(.17,.84,.44,1)',*/}
    {/*    overflow: 'hidden',*/}
    {/*  },*/}
    {/*}}>*/}
    {useFolders && (
      <ChatFolderList
        folders={folders}
        selectedFolderId={props.selectedFolderId}
        onFolderSelect={props.setSelectedFolderId}
      />
    )}
    {/*</Box>*/}

    {/* Chats List */}
    <PageDrawerList variant='plain' noTopPadding noBottomPadding tallRows>

      {useFolders && <ListDivider sx={{ mb: 0 }} />}

      {/* Search Input Field */}
      <DebounceInput
        onDebounce={setDebouncedSearchQuery}
        debounceTimeout={300}
        placeholder='Search...'
        aria-label='Search'
        sx={{ m: 2 }}
      />

      <ListItemButton disabled={props.disableNewButton} onClick={handleButtonNew} sx={PageDrawerTallItemSx}>
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
      </ListItemButton>

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

        {filteredChatNavItems.map(item =>
          <ChatDrawerItemMemo
            key={'nav-' + item.conversationId}
            item={item}
            isLonely={singleChat}
            showSymbols={showSymbols}
            bottomBarBasis={(labsEnhancedUI || softMaxReached || debouncedSearchQuery) ? bottomBarBasis : 0}
            onConversationActivate={handleConversationActivate}
            onConversationDelete={handleConversationDelete}
          />)}
      </Box>

      <ListDivider sx={{ mt: 0 }} />

      <Box sx={{ display: 'flex', alignItems: 'center' }}>

        <ListItemButton onClick={props.onConversationImportDialog} sx={{ flex: 1 }}>
          <ListItemDecorator>
            <FileUploadIcon />
          </ListItemDecorator>
          Import
          {/*<OpenAIIcon sx={{  ml: 'auto' }} />*/}
        </ListItemButton>

        <ListItemButton disabled={!nonEmptyChats} onClick={() => props.onConversationExportDialog(props.activeConversationId)} sx={{ flex: 1 }}>
          <ListItemDecorator>
            <FileDownloadIcon />
          </ListItemDecorator>
          Export
        </ListItemButton>
      </Box>

      <ListItemButton disabled={!nonEmptyChats} onClick={props.onConversationsDeleteAll}>
        <ListItemDecorator>
          <DeleteOutlineIcon />
        </ListItemDecorator>
        Delete {selectConversationsCount >= 2 ? `all ${selectConversationsCount} chats` : 'chat'}
      </ListItemButton>

    </PageDrawerList>

  </>;
}