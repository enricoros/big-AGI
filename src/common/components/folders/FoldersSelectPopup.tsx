import * as React from 'react';

import { ListItem, ListItemButton, ListItemDecorator } from '@mui/joy';
import ClearIcon from '@mui/icons-material/Clear';
import FolderIcon from '@mui/icons-material/Folder';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import { chatFoldersActions, DFolder } from '~/common/stores/folders/store-chat-folders';
import { CloseablePopup } from '~/common/components/CloseablePopup';
import { FoldersAddButton } from '~/common/components/folders/FoldersAddButton';
import { themeZIndexOverMobileDrawer } from '~/common/app.theme';


// configuration
export const ClearFolderText = 'No Folder';


export interface FolderChangeRequest {
  conversationId: DConversationId;
  anchorEl: HTMLElement;
  currentFolder: DFolder | null;
}

interface FoldersSelectPopupProps {
  allFolders: DFolder[];
  request: FolderChangeRequest;
  onClose: () => void;
  // onFolderSelect: (conversationId: DConversationId, folderId: string | null) => void;
}


/**
 * Note: state is external so we recycle 1 component in the parent instead of one per item
 */
export function FoldersSelectPopup({ allFolders, request, onClose }: FoldersSelectPopupProps) {

  // state
  const [isAddingFolder, setIsAddingFolder] = React.useState(false);

  // props
  const { conversationId, anchorEl, currentFolder } = request;
  const currentFolderId = currentFolder?.id || null;


  // handlers

  const handleSetFolder = React.useCallback((folderId: string | null) => {
    setIsAddingFolder(false);

    // Remove conversation from existing folders
    chatFoldersActions().removeConversationFromAll(conversationId);

    // Add conversation to the selected folder
    folderId && chatFoldersActions().addConversationToFolder(folderId, conversationId);

    onClose();
  }, [conversationId, onClose]);

  const handleFolderClicked = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    handleSetFolder(event.currentTarget.dataset.folderId || null);
  }, [handleSetFolder]);


  return (
    <CloseablePopup
      menu anchorEl={anchorEl} onClose={onClose}
      disableMenuTypeahead={true /* important: prevents accelerator from triggering menu items so instead we can type folder names in the input */}
      bigIcons
      minWidth={200}
      maxWidth={320}
      placement='bottom-start'
      zIndex={themeZIndexOverMobileDrawer /* need to be on top of the Modal on Mobile */}
    >

      {/* Clear Folder Option */}
      {/*{currentFolder && (*/}
      <ListItem
        key='clear-folder'
        data-folder-id=''
        onClick={handleFolderClicked}
      >
        <ListItemButton disabled={!currentFolder}>
          <ListItemDecorator>
            <ClearIcon />
          </ListItemDecorator>
          {ClearFolderText}
        </ListItemButton>
      </ListItem>
      {/*)}*/}

      {/* Folder Assignment Buttons */}
      {allFolders.map(({ color, id, title }) => (
        <ListItem
          key={id}
          data-folder-id={id}
          variant={id === currentFolderId ? 'soft' : 'plain'}
          onClick={handleFolderClicked}
        >
          <ListItemButton>
            <ListItemDecorator>
              <FolderIcon sx={{ color: color }} />
            </ListItemDecorator>
            <span className='agi-ellipsize'>{title}</span>
          </ListItemButton>
        </ListItem>
      ))}

      {/* Add New Folder */}
      <FoldersAddButton
        isAddingFolder={isAddingFolder}
        setIsAddingFolder={setIsAddingFolder}
        onFolderCreated={handleSetFolder}
      />

    </CloseablePopup>
  );
}