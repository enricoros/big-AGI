import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Box, Button, Dropdown, IconButton, ListDivider, ListItem, ListItemButton, ListItemDecorator, Menu, MenuButton, MenuItem, Tooltip, Typography } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ClearIcon from '@mui/icons-material/Clear';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import FolderIcon from '@mui/icons-material/Folder';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import StarOutlineRoundedIcon from '@mui/icons-material/StarOutlineRounded';

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
import { ChatNavGrouping, ChatSearchSorting, isDrawerSearching, useChatDrawerRenderItems } from './useChatDrawerRenderItems';
import { ClearFolderText } from './folders/useFolderDropdown';
import { useChatDrawerFilters } from '../store-app-chat';


// this is here to make shallow comparisons work on the next hook
const noFolders: DFolder[] = [];

/*
 * Lists folders and returns the active folder
 */
export const useFolders = (activeFolderId: string | null) => useFolderStore(useShallow(({ enableFolders, folders, toggleEnableFolders }) => {

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
}));


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
  const [searchSorting, setSearchSorting] = React.useState<ChatSearchSorting>('frequency');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState('');
  const [folderChangeRequest, setFolderChangeRequest] = React.useState<FolderChangeRequest | null>(null);

  // external state
  const { closeDrawer, closeDrawerOnMobile } = useOptimaDrawers();
  const {
    filterHasStars, toggleFilterHasStars,
    showPersonaIcons, toggleShowPersonaIcons,
    showRelativeSize, toggleShowRelativeSize,
  } = useChatDrawerFilters();
  const { activeFolder, allFolders, enableFolders, toggleEnableFolders } = useFolders(props.activeFolderId);
  const { filteredChatsCount, filteredChatIDs, filteredChatsAreEmpty, filteredChatsBarBasis, filteredChatsIncludeActive, renderNavItems } = useChatDrawerRenderItems(
    props.activeConversationId, props.chatPanesConversationIds, debouncedSearchQuery, activeFolder, allFolders, filterHasStars, navGrouping, searchSorting, showRelativeSize,
  );
  const { contentScaling, showSymbols } = useUIPreferencesStore(useShallow(state => ({
    contentScaling: state.contentScaling,
    showSymbols: state.zenMode !== 'cleaner',
  })));


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
  const { isSearching } = isDrawerSearching(debouncedSearchQuery);
  const groupingComponent = React.useMemo(() => (
    <Dropdown>
      <MenuButton
        aria-label='View options'
        slots={{ root: IconButton }}
        slotProps={{ root: { size: 'sm' } }}
      >
        <MoreVertIcon />
      </MenuButton>

      {!isSearching ? (
        // Search/Filter default menu: Grouping, Filtering, ...
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
              <ListItemDecorator>{navGrouping === _gName && <CheckRoundedIcon />}</ListItemDecorator>
              {capitalizeFirstLetter(_gName)}
            </MenuItem>
          ))}

          <ListDivider />
          <ListItem>
            <Typography level='body-sm'>Filter</Typography>
          </ListItem>
          <MenuItem onClick={toggleFilterHasStars}>
            <ListItemDecorator>{filterHasStars && <CheckRoundedIcon />}</ListItemDecorator>
            Starred <StarOutlineRoundedIcon />
          </MenuItem>

          <ListDivider />
          <ListItem>
            <Typography level='body-sm'>Show</Typography>
          </ListItem>
          <MenuItem onClick={toggleShowPersonaIcons}>
            <ListItemDecorator>{showPersonaIcons && <CheckRoundedIcon />}</ListItemDecorator>
            Icons
          </MenuItem>
          <MenuItem onClick={toggleShowRelativeSize}>
            <ListItemDecorator>{showRelativeSize && <CheckRoundedIcon />}</ListItemDecorator>
            Relative Size
          </MenuItem>
        </Menu>
      ) : (
        // While searching, show the sorting options
        <Menu placement='bottom-start' sx={{ minWidth: 180, zIndex: themeZIndexOverMobileDrawer /* need to be on top of the Modal on Mobile */ }}>
          <ListItem>
            <Typography level='body-sm'>Sort By</Typography>
          </ListItem>
          <MenuItem selected={searchSorting === 'frequency'} onClick={() => setSearchSorting('frequency')}>
            <ListItemDecorator>{searchSorting === 'frequency' && <CheckRoundedIcon />}</ListItemDecorator>
            Matches
          </MenuItem>
          <MenuItem selected={searchSorting === 'date'} onClick={() => setSearchSorting('date')}>
            <ListItemDecorator>{searchSorting === 'date' && <CheckRoundedIcon />}</ListItemDecorator>
            Date
          </MenuItem>
        </Menu>
      )}
    </Dropdown>
  ), [filterHasStars, isSearching, navGrouping, searchSorting, showPersonaIcons, showRelativeSize, toggleFilterHasStars, toggleShowPersonaIcons, toggleShowRelativeSize]);


  return <>

    {/* Drawer Header */}
    <PageDrawerHeader title='Chats' onClose={closeDrawer}>
      <Tooltip title={enableFolders ? 'Hide Folders' : 'Use Folders'}>
        <IconButton size='sm' onClick={toggleEnableFolders}>
          {enableFolders ? <FoldersToggleOn /> : <FoldersToggleOff />}
        </IconButton>
      </Tooltip>
    </PageDrawerHeader>

    {/* Folders List (shrink at twice the rate as the Titles) */}
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
        sx={{
          // shrink this at twice the rate as the Titles list
          flexGrow: 0, flexShrink: 2, overflow: 'hidden',
          minHeight: '7.5rem',
          p: 2,
        }}
      />
    )}
    {/*</Box>*/}

    {/* Chats List */}
    <PageDrawerList variant='plain' noTopPadding noBottomPadding tallRows>

      {enableFolders && <ListDivider sx={{ mb: 0 }} />}

      {/* Search / New Chat */}
      <Box sx={{ display: 'flex', flexDirection: 'column', m: 2, gap: 2 }}>

        {/* Search Input Field */}
        <DebounceInputMemo
          minChars={2}
          onDebounce={setDebouncedSearchQuery}
          debounceTimeout={300}
          placeholder='Search...'
          aria-label='Search'
          endDecorator={groupingComponent}
        />

        {/* New Chat Button */}
        <Button
          // variant='outlined'
          variant={disableNewButton ? undefined : 'soft'}
          disabled={disableNewButton}
          onClick={handleButtonNew}
          sx={{
            // ...PageDrawerTallItemSx,
            justifyContent: 'flex-start',
            padding: '0px 0.75rem',

            // style
            border: '1px solid',
            borderColor: 'neutral.outlinedBorder',
            borderRadius: 'sm',
            '--ListItemDecorator-size': 'calc(2.5rem - 1px)', // compensate for the border
            // backgroundColor: 'background.popup',
            // boxShadow: (disableNewButton || props.isMobile) ? 'none' : 'xs',
            // transition: 'box-shadow 0.2s',
          }}
        >
          <ListItemDecorator><AddIcon sx={{ fontSize: '' }} /></ListItemDecorator>
          New chat
        </Button>

      </Box>

      {/* Chat Titles List (shrink as half the rate as the Folders List) */}
      <Box sx={{ flexGrow: 1, flexShrink: 1, flexBasis: '20rem', overflowY: 'auto', ...themeScalingMap[contentScaling].chatDrawerItemSx }}>
        {renderNavItems.map((item, idx) => item.type === 'nav-item-chat-data' ? (
            <ChatDrawerItemMemo
              key={'nav-chat-' + item.conversationId}
              item={item}
              showSymbols={showPersonaIcons && showSymbols}
              bottomBarBasis={filteredChatsBarBasis}
              onConversationActivate={handleConversationActivate}
              onConversationBranch={onConversationBranch}
              onConversationDeleteNoConfirmation={handleConversationDeleteNoConfirmation}
              onConversationExport={onConversationsExportDialog}
              onConversationFolderChange={handleConversationFolderChange}
            />
          ) : item.type === 'nav-item-group' ? (
            <Typography key={'nav-divider-' + idx} level='body-xs' sx={{
              textAlign: 'center',
              my: 'calc(var(--ListItem-minHeight) / 4)',
              // keeps the group header sticky to the top
              position: 'sticky',
              top: 0,
              backgroundColor: 'background.popup',
              zIndex: 1,
            }}>
              {item.title}
            </Typography>
          ) : item.type === 'nav-item-info-message' ? (
            <Typography key={'nav-info-' + idx} level='body-xs' sx={{ textAlign: 'center', color: 'primary.softColor', my: 'calc(var(--ListItem-minHeight) / 4)' }}>
              {filterHasStars && <StarOutlineRoundedIcon sx={{ color: 'primary.softColor', fontSize: 'xl', mb: -0.5, mr: 1 }} />}
              {item.message}
              {filterHasStars && <>
                <Button variant='soft' size='sm' onClick={toggleFilterHasStars} sx={{ display: 'block', mt: 2, mx: 'auto' }}>
                  remove filters
                </Button>
              </>}
            </Typography>
          ) : null,
        )}
      </Box>

      <ListDivider sx={{ my: 0 }} />

      {/* Bottom commands */}
      <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
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