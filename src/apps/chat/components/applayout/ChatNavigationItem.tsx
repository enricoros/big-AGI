import * as React from 'react';

import { Avatar, Box, IconButton, ListItemDecorator, MenuItem, Typography } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { SystemPurposes } from '../../../../data';

import { InlineTextarea } from '~/common/components/InlineTextarea';
import { conversationTitle, DConversation, DConversationId, useChatStore } from '~/common/state/store-chats';
import { useUIPreferencesStore } from '~/common/state/store-ui';


const DEBUG_CONVERSATION_IDs = false;


export const ChatNavigationItemMemo = React.memo(ChatNavigationItem);

function ChatNavigationItem(props: {
  conversation: DConversation,
  isActive: boolean,
  isLonely: boolean,
  maxChatMessages: number,
  showSymbols: boolean,
  onConversationActivate: (conversationId: DConversationId, closeMenu: boolean) => void,
  onConversationDelete: (conversationId: DConversationId) => void,
}) {

  const { conversation, isActive } = props;

  // state
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [deleteArmed, setDeleteArmed] = React.useState(false);

  // external state
  const doubleClickToEdit = useUIPreferencesStore(state => state.doubleClickToEdit);

  // derived state
  const { id: conversationId } = conversation;
  const isNew = conversation.messages.length === 0;
  const messageCount = conversation.messages.length;
  const assistantTyping = !!conversation.abortController;
  const systemPurposeId = conversation.systemPurposeId;
  const title = conversationTitle(conversation, 'new conversation');
  // const setUserTitle = state.setUserTitle;

  // auto-close the arming menu when clicking away
  // NOTE: there currently is a bug (race condition) where the menu closes on a new item right after opening
  //       because the isActive prop is not yet updated
  React.useEffect(() => {
    if (deleteArmed && !isActive)
      setDeleteArmed(false);
  }, [deleteArmed, isActive]);


  const handleConversationActivate = () => props.onConversationActivate(conversationId, true);

  const handleTitleEdit = () => setIsEditingTitle(true);

  const handleTitleEdited = (text: string) => {
    setIsEditingTitle(false);
    useChatStore.getState().setUserTitle(conversationId, text);
  };

  const handleDeleteButtonShow = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!isActive)
      props.onConversationActivate(conversationId, false);
    else
      setDeleteArmed(true);
  };

  const handleDeleteButtonHide = () => setDeleteArmed(false);

  const handleConversationDelete = (event: React.MouseEvent) => {
    if (deleteArmed) {
      setDeleteArmed(false);
      event.stopPropagation();
      props.onConversationDelete(conversationId);
    }
  };


  const textSymbol = SystemPurposes[systemPurposeId]?.symbol || '❓';
  const buttonSx: SxProps = { ml: 1, ...(isActive ? { color: 'white' } : {}) };

  const progress = props.maxChatMessages ? 100 * messageCount / props.maxChatMessages : 0;

  return (
    <MenuItem
      variant={isActive ? 'solid' : 'plain'} color='neutral'
      selected={isActive}
      onClick={handleConversationActivate}
      sx={{
        // py: 0,
        position: 'relative',
        border: 'none', // note, there's a default border of 1px and invisible.. hmm
        '&:hover > button': { opacity: 1 },
        ...(isActive ? { bgcolor: 'red' } : {}),
      }}
    >

      {/* Optional progress bar, underlay */}
      {progress > 0 && (
        <Box sx={{
          backgroundColor: 'neutral.softActiveBg',
          position: 'absolute', left: 0, bottom: 0, width: progress + '%', height: 4,
        }} />
      )}

      {/* Icon */}
      {props.showSymbols && <ListItemDecorator>
        {assistantTyping
          ? (
            <Avatar
              alt='typing' variant='plain'
              src='https://i.giphy.com/media/jJxaUysjzO9ri/giphy.webp'
              sx={{
                width: 24,
                height: 24,
                borderRadius: 'var(--joy-radius-sm)',
              }}
            />
          ) : (
            <Typography sx={{ fontSize: '18px' }}>
              {isNew ? '' : textSymbol}
            </Typography>
          )}
      </ListItemDecorator>}

      {/* Text */}
      {!isEditingTitle ? (

        <Box onDoubleClick={() => doubleClickToEdit ? handleTitleEdit() : null} sx={{ flexGrow: 1 }}>
          {DEBUG_CONVERSATION_IDs ? conversationId.slice(0, 10) : title}{assistantTyping && '...'}
        </Box>

      ) : (

        <InlineTextarea initialText={title} onEdit={handleTitleEdited} sx={{ ml: -1.5, mr: -0.5, flexGrow: 1 }} />

      )}

      {/* // TODO: Commented code */}
      {/* Edit */}
      {/*<IconButton*/}
      {/*  variant='plain' color='neutral'*/}
      {/*  onClick={() => props.onEditTitle(props.conversationId)}*/}
      {/*  sx={{*/}
      {/*    opacity: 0, transition: 'opacity 0.3s', ml: 'auto',*/}
      {/*  }}>*/}
      {/*  <EditIcon />*/}
      {/*</IconButton>*/}

      {/* Delete Arming */}
      {!props.isLonely && !deleteArmed && (
        <IconButton
          variant={isActive ? 'solid' : 'outlined'} color='neutral'
          size='sm' sx={{ opacity: { xs: 1, sm: 0 }, transition: 'opacity 0.3s', ...buttonSx }}
          onClick={handleDeleteButtonShow}>
          <DeleteOutlineIcon />
        </IconButton>
      )}

      {/* Delete / Cancel buttons */}
      {!props.isLonely && deleteArmed && <>
        <IconButton size='sm' variant='solid' color='danger' sx={buttonSx} onClick={handleConversationDelete}>
          <DeleteOutlineIcon />
        </IconButton>
        <IconButton size='sm' variant='solid' color='neutral' sx={buttonSx} onClick={handleDeleteButtonHide}>
          <CloseIcon />
        </IconButton>
      </>}
    </MenuItem>

  );
}