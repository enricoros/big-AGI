import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, Dropdown, IconButton, ListDivider, ListItem, ListItemButton, ListItemDecorator, Menu, MenuButton, MenuItem, Tooltip, Typography } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import ClearIcon from '@mui/icons-material/Clear';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import FolderIcon from '@mui/icons-material/Folder';
import MoreVertIcon from '@mui/icons-material/MoreVert';

import type { DConversationId } from '~/common/state/store-chats';
import { CloseableMenu } from '~/common/components/CloseableMenu';
import { DFolder, useFolderStore } from '~/common/state/store-folders';
import { DebounceInputMemo } from '~/common/components/DebounceInput';
import { FoldersToggleOff } from '~/common/components/icons/FoldersToggleOff';
import { FoldersToggleOn } from '~/common/components/icons/FoldersToggleOn';
import { PageDrawerHeader } from '~/common/layout/optima/components/PageDrawerHeader';
import { PageDrawerList } from '~/common/layout/optima/components/PageDrawerList';
import { capitalizeFirstLetter } from '~/common/util/textUtils';
import { themeScalingMap, themeZIndexOverMobileDrawer } from '~/common/app.theme';
import { useOptimaDrawers } from '~/common/layout/optima/useOptimaDrawers';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { ChatDrawerItemMemo, FolderChangeRequest } from './ChatDrawerItem';
import { ChatFolderList } from './folders/ChatFolderList';
import { ChatNavGrouping, useChatNavRenderItems } from './useChatNavRenderItems';
import { ClearFolderText } from './folders/useFolderDropdown';
import { useChatShowRelativeSize } from '../store-app-chat';


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


export const ChatDrawerMemo = React.memo(ChatDrawer);

function ChatDrawer(props: {
  isMobile: boolean,
  activeConversationId: DConversationId | null,
  activeFolderId: string | null,
  chatPanesConversationIds: DConversationId[],
  disableNewButton: boolean,
  onConversationActivate: (conversationId: DConversationId) => void,
  onConversationBranch: (conversationId: DConversationId, messageId: string | null) => void,
  onConversationNew: (forceNoRecycle: boolean) => void,
  onConversationsDelete: (conversationIds: DConversationId[], bypassConfirmation: boolean) => void,
  onConversationsExportDialog: (conversationId: DConversationId | null, exportAll: boolean) => void,
  onConversationsImportDialog: () => void,
  setActiveFolderId: (folderId: string | null) => void,
}) {

  const { onConversationActivate, onConversationBranch, onConversationNew, onConversationsDelete, onConversationsExportDialog } = props;

  // local state
  const [navGrouping, setNavGrouping] = React.useState<ChatNavGrouping>('date');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState('');
  const [folderChangeRequest, setFolderChangeRequest] = React.useState<FolderChangeRequest | null>(null);

  // external state
  const { closeDrawer, closeDrawerOnMobile } = useOptimaDrawers();
  const { showRelativeSize, toggleRelativeSize } = useChatShowRelativeSize();
  const { activeFolder, allFolders, enableFolders, toggleEnableFolders } = useFolders(props.activeFolderId);
  const { filteredChatsCount, filteredChatIDs, filteredChatsAreEmpty, filteredChatsBarBasis, filteredChatsIncludeActive, renderNavItems } = useChatNavRenderItems(
    props.activeConversationId, props.chatPanesConversationIds, debouncedSearchQuery, activeFolder, allFolders, navGrouping, showRelativeSize,
  );
  const { contentScaling, showSymbols } = useUIPreferencesStore(state => ({
    contentScaling: state.contentScaling,
    showSymbols: state.zenMode !== 'cleaner',
  }), shallow);


  // New/Activate/Delete Conversation

  const isMultiPane = props.chatPanesConversationIds.length >= 2;
  const disableNewButton = props.disableNewButton && filteredChatsIncludeActive;
  const newButtonDontRecycle = isMultiPane || !filteredChatsIncludeActive;

  const handleButtonNew = React.useCallback(() => {
    onConversationNew(newButtonDontRecycle);
    closeDrawerOnMobile();
  }, [closeDrawerOnMobile, newButtonDontRecycle, onConversationNew]);

  const handleConversationActivate = React.useCallback((conversationId: DConversationId, closeMenu: boolean) => {
    onConversationActivate(conversationId);
    if (closeMenu)
      closeDrawerOnMobile();
  }, [closeDrawerOnMobile, onConversationActivate]);

  const handleConversationsDeleteFiltered = React.useCallback(() => {
    !!filteredChatIDs?.length && onConversationsDelete(filteredChatIDs, false);
  }, [filteredChatIDs, onConversationsDelete]);

  const handleConversationDeleteNoConfirmation = React.useCallback((conversationId: DConversationId) => {
    conversationId && onConversationsDelete([conversationId], true);
  }, [onConversationsDelete]);

  const handleConversationsExport = React.useCallback(() => {
    props.activeConversationId && onConversationsExportDialog(props.activeConversationId, true);
  }, [onConversationsExportDialog, props.activeConversationId]);


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


  // memoize the group dropdown
  const groupingComponent = React.useMemo(() => (
    <Dropdown>
      <MenuButton
        aria-label='View options'
        slots={{ root: IconButton }}
        slotProps={{ root: { size: 'sm' } }}
      >
        <MoreVertIcon sx={{ fontSize: 'xl' }} />
      </MenuButton>
      <Menu placement='bottom-start' sx={{ minWidth: 180, zIndex: themeZIndexOverMobileDrawer /* need to be on top of the Modal on Mobile */ }}>
        <ListItem>
          <Typography level='body-sm'>Group By</Typography>
        </ListItem>
        {(['date', 'persona'] as const).map(_gName => (
          <MenuItem
            key={'group-' + _gName}
            aria-label={`Group by ${_gName}`}
            selected={navGrouping === _gName}
            onClick={() => setNavGrouping(grouping => grouping === _gName ? false : _gName)}
          >
            <ListItemDecorator>{navGrouping === _gName && <CheckIcon />}</ListItemDecorator>
            {capitalizeFirstLetter(_gName)}
          </MenuItem>
        ))}
        <ListDivider />
        <ListItem>
          <Typography level='body-sm'>Show</Typography>
        </ListItem>
        <MenuItem onClick={toggleRelativeSize}>
          <ListItemDecorator>{showRelativeSize && <CheckIcon />}</ListItemDecorator>
          Relative Size
        </MenuItem>
      </Menu>
    </Dropdown>
  ), [navGrouping, showRelativeSize, toggleRelativeSize]);


  return <>

    {/* Drawer Header */}
    <PageDrawerHeader title='Chats' onClose={closeDrawer}>
      <Tooltip title={enableFolders ? 'Hide Folders' : 'Use Folders'}>
        <IconButton onClick={toggleEnableFolders}>
          {enableFolders ? <FoldersToggleOn /> : <FoldersToggleOff />}
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
        contentScaling={contentScaling}
        activeFolderId={props.activeFolderId}
        onFolderSelect={props.setActiveFolderId}
      />
    )}
    {/*</Box>*/}

    {/* Chats List */}
    <PageDrawerList variant='plain' noTopPadding noBottomPadding tallRows>

      {enableFolders && <ListDivider sx={{ mb: 0 }} />}

      {/* Search Input Field */}
      <DebounceInputMemo
        minChars={2}
        onDebounce={setDebouncedSearchQuery}
        debounceTimeout={300}
        placeholder='Search...'
        aria-label='Search'
        endDecorator={groupingComponent}
        sx={{ m: 2 }}
      />

      {/* New Chat Button */}
      <ListItem sx={{ mx: '0.25rem', mb: 0.5 }}>
        <ListItemButton
          // variant='outlined'
          variant={disableNewButton ? undefined : 'outlined'}
          disabled={disableNewButton}
          onClick={handleButtonNew}
          sx={{
            // ...PageDrawerTallItemSx,
            px: 'calc(var(--ListItem-paddingX) - 0.25rem)',

            // text size
            fontSize: 'sm',
            fontWeight: 'lg',

            // style
            borderRadius: 'md',
            boxShadow: (disableNewButton || props.isMobile) ? 'none' : 'sm',
            backgroundColor: 'background.popup',
            transition: 'box-shadow 0.2s',
          }}
        >
          <ListItemDecorator><AddIcon sx={{ '--Icon-fontSize': 'var(--joy-fontSize-xl)', pl: '0.125rem' }} /></ListItemDecorator>
          New chat
        </ListItemButton>
      </ListItem>

      {/*<ListDivider sx={{ mt: 0 }} />*/}

      {/* List of Chat Titles (and actions) */}
      <Box sx={{ flex: 1, overflowY: 'auto', ...themeScalingMap[contentScaling].chatDrawerItemSx }}>
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

        {renderNavItems.map((item, idx) => item.type === 'nav-item-chat-data' ? (
            <ChatDrawerItemMemo
              key={'nav-chat-' + item.conversationId}
              item={item}
              showSymbols={showSymbols}
              bottomBarBasis={filteredChatsBarBasis}
              onConversationActivate={handleConversationActivate}
              onConversationBranch={onConversationBranch}
              onConversationDelete={handleConversationDeleteNoConfirmation}
              onConversationExport={onConversationsExportDialog}
              onConversationFolderChange={handleConversationFolderChange}
            />
          ) : item.type === 'nav-item-group' ? (
            <Typography key={'nav-divider-' + idx} level='body-xs' sx={{ textAlign: 'center', my: 'calc(var(--ListItem-minHeight) / 4)' }}>
              {item.title}
            </Typography>
          ) : item.type === 'nav-item-info-message' ? (
            <Typography key={'nav-info-' + idx} level='body-xs' sx={{ textAlign: 'center', my: 'calc(var(--ListItem-minHeight) / 2)' }}>
              {item.message}
            </Typography>
          ) : null,
        )}
      </Box>

      <ListDivider sx={{ my: 0 }} />

      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <ListItemButton onClick={props.onConversationsImportDialog} sx={{ flex: 1 }}>
          <ListItemDecorator>
            <FileUploadOutlinedIcon />
          </ListItemDecorator>
          Import
          {/*<OpenAIIcon sx={{  ml: 'auto' }} />*/}
        </ListItemButton>

        <ListItemButton disabled={filteredChatsAreEmpty} onClick={handleConversationsExport} sx={{ flex: 1 }}>
          <ListItemDecorator>
            <FileDownloadOutlinedIcon />
          </ListItemDecorator>
          Export
        </ListItemButton>
      </Box>

      <ListItemButton disabled={filteredChatsAreEmpty} onClick={handleConversationsDeleteFiltered}>
        <ListItemDecorator>
          <DeleteOutlineIcon />
        </ListItemDecorator>
        Delete {filteredChatsCount >= 2 ? `all ${filteredChatsCount} chats` : 'chat'}
      </ListItemButton>

    </PageDrawerList>


    {/* [Menu] Chat Item Folder Change */}
    {!!folderChangeRequest?.anchorEl && (
      <CloseableMenu
        bigIcons
        open anchorEl={folderChangeRequest.anchorEl} onClose={handleConversationFolderCancel}
        placement='bottom-start'
        zIndex={themeZIndexOverMobileDrawer /* need to be on top of the Modal on Mobile */}
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
              <ListItemDecorator>
                <ClearIcon />
              </ListItemDecorator>
              {ClearFolderText}
            </ListItemButton>
          </ListItem>
        )}

      </CloseableMenu>
    )}

  </>;
}