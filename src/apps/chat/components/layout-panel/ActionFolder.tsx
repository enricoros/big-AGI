import * as React from 'react';

import { ListItemDecorator, MenuItem } from '@mui/joy';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import { FolderChangeRequest, FoldersSelectPopup } from '~/common/components/folders/FoldersSelectPopup';
import { useChatFoldersForConversation } from '~/common/stores/folders/hooks/useChatFoldersForConversation';


export function ActionFolder({ conversationId, disabled }: {
  conversationId: DConversationId | null;
  disabled: boolean;
}) {

  // state
  const [folderChangeRequest, setFolderChangeRequest] = React.useState<FolderChangeRequest | null>(null);


  // external state
  const { currentFolder, allFolders } = useChatFoldersForConversation(conversationId);


  // handlers

  const handleOpenPicker = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    if (!conversationId) return;
    setFolderChangeRequest({
      conversationId,
      anchorEl: event.currentTarget,
      currentFolder: currentFolder ?? null,
    });
  }, [conversationId, currentFolder]);

  const handleClosePicker = React.useCallback(() => {
    setFolderChangeRequest(null);
  }, []);


  const ButtonIcon = currentFolder ? FolderIcon : FolderOutlinedIcon;


  return <>

    {/*<TooltipOutlined slowEnter title='Change the folder of this conversation' placement='top'>*/}
    <MenuItem
      disabled={disabled || !conversationId}
      onClick={handleOpenPicker}
    >
      <ListItemDecorator>
        <ButtonIcon sx={{ color: currentFolder?.color }} />
      </ListItemDecorator>
      {/*<span className='agi-ellipsize'>{currentFolder ? currentFolder.title : 'Assign'}</span>*/}
      <span className='agi-ellipsize'>{currentFolder ? currentFolder.title : 'Folder'}</span>
    </MenuItem>
    {/*</TooltipOutlined>*/}

    {/* [Menu] Folder Picker */}
    {!!folderChangeRequest?.anchorEl && (
      <FoldersSelectPopup
        allFolders={allFolders}
        request={folderChangeRequest}
        onClose={handleClosePicker}
      />
    )}

  </>;
}