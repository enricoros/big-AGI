import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Avatar, Box, IconButton, ListItemDecorator, MenuItem, Typography } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { InlineTextarea } from '@/common/components/InlineTextarea';
import { SystemPurposes } from '../../../../data';
import { conversationTitle, useChatStore } from '@/common/state/store-chats';


const DEBUG_CONVERSATION_IDs = false;


export function ConversationItem(props: {
  conversationId: string,
  isActive: boolean, isSingle: boolean, showSymbols: boolean,
  conversationActivate: (conversationId: string) => void,
  conversationDelete: (conversationId: string) => void,
}) {

  // state
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [deleteArmed, setDeleteArmed] = React.useState(false);

  // bind to conversation
  const cState = useChatStore(state => {
    const conversation = state.conversations.find(conversation => conversation.id === props.conversationId);
    return conversation && {
      isNew: conversation.messages.length === 0,
      assistantTyping: !!conversation.abortController,
      systemPurposeId: conversation.systemPurposeId,
      title: conversationTitle(conversation),
      setUserTitle: state.setUserTitle,
    };
  }, shallow);

  // auto-close the arming menu when clicking away
  // NOTE: there currently is a bug (race condition) where the menu closes on a new item right after opening
  //       because the isActive prop is not yet updated
  React.useEffect(() => {
    if (deleteArmed && !props.isActive)
      setDeleteArmed(false);
  }, [deleteArmed, props.isActive]);

  // sanity check: shouldn't happen, but just in case
  if (!cState) return null;
  const { isNew, assistantTyping, setUserTitle, systemPurposeId, title } = cState;

  const handleActivate = () => props.conversationActivate(props.conversationId);

  const handleEditBegin = () => setIsEditingTitle(true);

  const handleEdited = (text: string) => {
    setIsEditingTitle(false);
    setUserTitle(props.conversationId, text);
  };

  const handleDeleteBegin = () => setDeleteArmed(true);

  const handleDeleteConfirm = (e: React.MouseEvent) => {
    if (deleteArmed) {
      setDeleteArmed(false);
      e.stopPropagation();
      props.conversationDelete(props.conversationId);
    }
  };

  const handleDeleteCancel = () => setDeleteArmed(false);

  const textSymbol = SystemPurposes[systemPurposeId]?.symbol || '❓';
  const buttonSx: SxProps = { ml: 1, ...(props.isActive ? { color: 'white' } : {}) };

  return (
    <MenuItem
      variant={props.isActive ? 'solid' : 'plain'} color='neutral'
      selected={props.isActive}
      onClick={handleActivate}
      sx={{
        // py: 0,
        '&:hover > button': { opacity: 1 },
      }}
    >

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

        <Box onDoubleClick={handleEditBegin} sx={{ flexGrow: 1 }}>
          {DEBUG_CONVERSATION_IDs ? props.conversationId.slice(0, 10) : title}{assistantTyping && '...'}
        </Box>

      ) : (

        <InlineTextarea initialText={title} onEdit={handleEdited} sx={{ ml: -1.5, mr: -0.5, flexGrow: 1 }} />

      )}

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
      {!props.isSingle && !deleteArmed && (
        <IconButton
          variant='outlined' color='neutral'
          size='sm' sx={{ opacity: { xs: 1, sm: 0 }, transition: 'opacity 0.3s', ...buttonSx }}
          onClick={handleDeleteBegin}>
          <DeleteOutlineIcon />
        </IconButton>
      )}

      {/* Delete / Cancel buttons */}
      {!props.isSingle && deleteArmed && <>
        <IconButton size='sm' variant='solid' color='danger' sx={buttonSx} onClick={handleDeleteConfirm}>
          <DeleteOutlineIcon />
        </IconButton>
        <IconButton size='sm' variant='plain' color='neutral' sx={buttonSx} onClick={handleDeleteCancel}>
          <CloseIcon />
        </IconButton>
      </>}
    </MenuItem>
  );
}