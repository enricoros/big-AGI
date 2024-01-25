import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, IconButton, ListDivider, ListItem, ListItemButton, ListItemDecorator, Tooltip } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';

import DebounceInput from '~/common/components/DebounceInput';
import { CloseableMenu } from '~/common/components/CloseableMenu';
import { DFolder, useFolderStore } from '~/common/state/store-folders';
import { PageDrawerHeader } from '~/common/layout/optima/components/PageDrawerHeader';
import { PageDrawerList, PageDrawerTallItemSx } from '~/common/layout/optima/components/PageDrawerList';
import { conversationTitle, DConversationId, useChatStore } from '~/common/state/store-chats';
import { useOptimaDrawers } from '~/common/layout/optima/useOptimaDrawers';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { ChatDrawerItemMemo, ChatNavigationItemData, FolderChangeRequest } from './ChatDrawerItem';
import { ChatFolderList } from './folder/ChatFolderList';
import { ClearFolderText } from './folder/useFolderDropdown';


// this is here to make shallow comparisons work on the next hook
const noFolders: DFolder[] = [];

/*
 * Lists folders and returns the active folder
 */
export const useFolders = (activeFolderId: string | null) => useFolderStore(({ enableFolders, folders, toggleEnableFolders }) => {

  // finds the active folder if any
  const activeFolder = (enableFolders && activeFolderId)
    ? folders.find(folder => folder.id === activeFolderId) ?? null
    : null;

  return {
    activeFolder,
    allFolders: enableFolders ? folders : noFolders,
    enableFolders,
    toggleEnableFolders,
  };
}, shallow);


/*
 * Optimization: return a reduced version of the DConversation object for 'Drawer Items' purposes,
 * to avoid unnecessary re-renders on each new character typed by the assistant
 */
export const useChatNavigationItemsData = (activeFolder: DFolder | null, allFolders: DFolder[], activeConversationId: DConversationId | null): ChatNavigationItemData[] =>
  useChatStore(({ conversations }) => {

    const activeConversations = activeFolder
      ? conversations.filter(_c => activeFolder.conversationIds.includes(_c.id))
      : conversations;

    return activeConversations.map((_c): ChatNavigationItemData => ({
      conversationId: _c.id,
      isActive: _c.id === activeConversationId,
      isEmpty: !_c.messages.length && !_c.userTitle,
      title: conversationTitle(_c),
      folder: !allFolders.length
        ? undefined                             // don't show folder select if folders are disabled
        : _c.id === activeConversationId        // only show the folder for active conversation(s)
          ? allFolders.find(folder => folder.conversationIds.includes(_c.id)) ?? null
          : null,
      messageCount: _c.messages.length,
      assistantTyping: !!_c.abortController,
      systemPurposeId: _c.systemPurposeId,
    }));

  }, (a, b) => {
    // custom equality function to avoid unnecessary re-renders
    return a.length === b.length && a.every((_a, i) => shallow(_a, b[i]));
  });


export const ChatDrawerMemo = React.memo(ChatDrawer);

function ChatDrawer(props: {
  activeConversationId: DConversationId | null,
  activeFolderId: string | null,
  disableNewButton: boolean,
  onConversationActivate: (conversationId: DConversationId) => void,
  onConversationDelete: (conversationId: DConversationId, bypassConfirmation: boolean) => void,
  onConversationExportDialog: (conversationId: DConversationId | null) => void,
  onConversationImportDialog: () => void,
  onConversationNew: () => void,
  onConversationsDeleteAll: () => void,
  setActiveFolderId: (folderId: string | null) => void,
}) {

  const { onConversationActivate, onConversationDelete, onConversationExportDialog, onConversationNew } = props;

  // local state
  const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState('');
  const [folderChangeRequest, setFolderChangeRequest] = React.useState<FolderChangeRequest | null>(null);

  // external state
  const { closeDrawer, closeDrawerOnMobile } = useOptimaDrawers();
  const { activeFolder, allFolders, enableFolders, toggleEnableFolders } = useFolders(props.activeFolderId);
  const chatNavItems = useChatNavigationItemsData(activeFolder, allFolders, props.activeConversationId);
  const showSymbols = useUIPreferencesStore(state => state.zenMode !== 'cleaner');

  // derived state
  const selectConversationsCount = chatNavItems.length;
  const nonEmptyChats = selectConversationsCount > 1 || (selectConversationsCount === 1 && !chatNavItems[0].isEmpty);
  const singleChat = selectConversationsCount === 1;
  const softMaxReached = selectConversationsCount >= 10;


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


  // Folder change request

  const handleConversationFolderChange = React.useCallback((folderChangeRequest: FolderChangeRequest) => setFolderChangeRequest(folderChangeRequest), []);

  const handleConversationFolderCancel = React.useCallback(() => setFolderChangeRequest(null), []);

  const handleConversationFolderSet = React.useCallback((conversationId: DConversationId, nextFolderId: string | null) => {
    // Remove conversation from existing folders
    const { addConversationToFolder, folders, removeConversationFromFolder } = useFolderStore.getState();
    folders.forEach(folder => folder.conversationIds.includes(conversationId) && removeConversationFromFolder(folder.id, conversationId));

    // Add conversation to the selected folder
    nextFolderId && addConversationToFolder(nextFolderId, conversationId);

    // Close the menu
    setFolderChangeRequest(null);
  }, []);


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
    <PageDrawerHeader title='Chats' onClose={closeDrawer}>
      <Tooltip title={enableFolders ? 'Hide Folders' : 'Use Folders'}>
        <IconButton onClick={toggleEnableFolders}>
          {enableFolders ? <FolderOpenOutlinedIcon /> : <FolderOutlinedIcon />}
        </IconButton>
      </Tooltip>
    </PageDrawerHeader>

    {/* Folders List */}
    {/*<Box sx={{*/}
    {/*  display: 'grid',*/}
    {/*  gridTemplateRows: !enableFolders ? '0fr' : '1fr',*/}
    {/*  transition: 'grid-template-rows 0.42s cubic-bezier(.17,.84,.44,1)',*/}
    {/*  '& > div': {*/}
    {/*    padding: enableFolders ? 2 : 0,*/}
    {/*    transition: 'padding 0.42s cubic-bezier(.17,.84,.44,1)',*/}
    {/*    overflow: 'hidden',*/}
    {/*  },*/}
    {/*}}>*/}
    {enableFolders && (
      <ChatFolderList
        folders={allFolders}
        activeFolderId={props.activeFolderId}
        onFolderSelect={props.setActiveFolderId}
      />
    )}
    {/*</Box>*/}

    {/* Chats List */}
    <PageDrawerList variant='plain' noTopPadding noBottomPadding tallRows>

      {enableFolders && <ListDivider sx={{ mb: 0 }} />}

      {/* Search Input Field */}
      <DebounceInput
        minChars={2}
        onDebounce={setDebouncedSearchQuery}
        debounceTimeout={300}
        placeholder='Search...'
        aria-label='Search'
        sx={{ m: 2 }}
      />

      <ListItem sx={{ '--ListItem-minHeight': '2.75rem' }}>
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
      </ListItem>

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
            bottomBarBasis={(softMaxReached || debouncedSearchQuery) ? bottomBarBasis : 0}
            onConversationActivate={handleConversationActivate}
            onConversationDelete={handleConversationDelete}
            onConversationExport={onConversationExportDialog}
            onConversationFolderChange={handleConversationFolderChange}
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


    {/* [Menu] Chat Item Folder Change */}
    {!!folderChangeRequest?.anchorEl && (
      <CloseableMenu
        open anchorEl={folderChangeRequest.anchorEl} onClose={handleConversationFolderCancel}
        placement='bottom-start'
        zIndex={1301 /* need to be on top of the Modal on Mobile */}
        sx={{ minWidth: 200 }}
      >

        {/* Folder Assignment Buttons */}
        {allFolders.map(folder => {
          const isRequestFolder = folder === folderChangeRequest.currentFolder;
          return (
            <ListItem
              key={folder.id}
              variant={isRequestFolder ? 'soft' : 'plain'}
              onClick={() => handleConversationFolderSet(folderChangeRequest.conversationId, folder.id)}
            >
              <ListItemButton>
                <ListItemDecorator>
                  <FolderIcon sx={{ color: folder.color }} />
                </ListItemDecorator>
                {folder.title}
              </ListItemButton>
            </ListItem>
          );
        })}

        {/* Remove Folder Assignment */}
        {!!folderChangeRequest.currentFolder && (
          <ListItem onClick={() => handleConversationFolderSet(folderChangeRequest.conversationId, null)}>
            <ListItemButton>
              {ClearFolderText}
            </ListItemButton>
          </ListItem>
        )}

      </CloseableMenu>
    )}

  </>;
}