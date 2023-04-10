import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Avatar, Box, IconButton, ListItemDecorator, Menu, MenuItem, Tooltip, Typography } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { ConfirmationModal } from '@/components/dialogs/ConfirmationModal';
// import { Link } from '@/components/util/Link';
import { SystemPurposes } from '@/lib/data';
import { createDefaultConversation, MAX_CONVERSATIONS, useChatStore, useConversationIDs } from '@/lib/store-chats';

const DEBUG_CONVERSATION_IDs = false;


function ConversationListItem(props: {
  conversationId: string,
  isActive: boolean, isSingle: boolean,
  conversationActivate: (conversationId: string) => void,
  conversationDelete: (e: React.MouseEvent, conversationId: string) => void,
  conversationEditTitle: (conversationId: string) => void,
}) {

  // bind to conversation
  const conversation = useChatStore(state => {
    const conversation = state.conversations.find(conversation => conversation.id === props.conversationId);
    return conversation && {
      assistantTyping: !!conversation.abortController,
      chatModelId: conversation.chatModelId,
      name: conversation.name,
      systemPurposeId: conversation.systemPurposeId,
    };
  }, shallow);

  // sanity check: shouldn't happen, but just in case
  if (!conversation) return null;

  const { assistantTyping, name, systemPurposeId } = conversation;

  const textSymbol = SystemPurposes[systemPurposeId]?.symbol || '❓';

  return (
    <MenuItem
      variant={props.isActive ? 'solid' : 'plain'} color='neutral'
      onClick={() => props.conversationActivate(props.conversationId)}
      // sx={{ '&:hover > button': { opacity: 1 } }}
    >

      {/* Icon */}
      <ListItemDecorator>
        {assistantTyping
          ? (
            <Avatar
              alt='typing' variant='plain'
              src='https://i.giphy.com/media/jJxaUysjzO9ri/giphy.webp'
              sx={{
                width: 24,
                height: 24,
                borderRadius: 8,
              }}
            />
          ) : (
            <Typography sx={{ fontSize: '18px' }}>
              {/*<Badge size='sm' variant='solid' color='primary' badgeContent={'3.5'}>*/}
              {textSymbol}
              {/*</Badge>*/}
            </Typography>
          )}
      </ListItemDecorator>

      {/* Text */}
      <Box onDoubleClick={() => props.conversationEditTitle(props.conversationId)} sx={{ mr: 1 }}>
        {DEBUG_CONVERSATION_IDs ? props.conversationId.slice(0, 10) : name}{assistantTyping && '...'}
      </Box>

      {/* Edit */}
      {/*<IconButton*/}
      {/*  variant='plain' color='neutral'*/}
      {/*  onClick={() => props.onEditTitle(props.conversationId)}*/}
      {/*  sx={{*/}
      {/*    opacity: 0, transition: 'opacity 0.3s', ml: 'auto',*/}
      {/*  }}>*/}
      {/*  <EditIcon />*/}
      {/*</IconButton>*/}

      {/* Clear */}
      {!props.isSingle && (
        <IconButton
          variant='outlined' color='neutral'
          size='sm' sx={{ ml: 'auto', ...(props.isActive && { color: 'white' }) }}
          onClick={e => props.conversationDelete(e, props.conversationId)}>
          <DeleteOutlineIcon />
        </IconButton>
      )}

    </MenuItem>
  );
}


/**
 * FIXME - TEMPORARY - placeholder for a proper Pages Drawer
 */
export function PagesMenu(props: { pagesMenuAnchor: HTMLElement | null, onClose: () => void }) {
  // state
  const [deleteConfirmationId, setDeleteConfirmationId] = React.useState<string | null>(null);

  // external state
  const conversationIDs = useConversationIDs();
  const { activeConversationId, addConversation, deleteConversation, setActiveConversation } = useChatStore(state => ({
    activeConversationId: state.activeConversationId,
    addConversation: state.addConversation,
    deleteConversation: state.deleteConversation,
    setActiveConversation: state.setActiveConversationId,
  }), shallow);


  const singleChat = conversationIDs.length === 1;
  const maxReached = conversationIDs.length >= MAX_CONVERSATIONS;


  const handleNew = () => addConversation(createDefaultConversation(), true);

  const handleConversationActivate = (conversationId: string) => setActiveConversation(conversationId);

  const handleConversationEditTitle = (conversationId: string) => console.log('edit title', conversationId);

  const handleConversationDelete = (e: React.MouseEvent, conversationId: string) => {
    if (!singleChat) {
      e.stopPropagation();
      setDeleteConfirmationId(conversationId);
    }
  };

  const handleConfirmedDeleteConversation = () => {
    if (!singleChat && deleteConfirmationId) {
      deleteConversation(deleteConfirmationId);
      setDeleteConfirmationId(null);
    }
  };


  const newSuffix = maxReached && <Tooltip title={`Max reached:${MAX_CONVERSATIONS} chats. The oldest will be eliminated.`}><span>⚠️</span></Tooltip>;

  return <>

    <Menu
      variant='plain' color='neutral' size='lg' placement='bottom-start' sx={{ minWidth: 320 }}
      open={!!props.pagesMenuAnchor} anchorEl={props.pagesMenuAnchor} onClose={props.onClose}
      disablePortal={false}>

      {/*<ListItem>*/}
      {/*  <Typography level='body2'>*/}
      {/*    Active chats*/}
      {/*  </Typography>*/}
      {/*</ListItem>*/}

      <MenuItem onClick={handleNew}>
        <ListItemDecorator><AddIcon /></ListItemDecorator>
        <Typography>
          New chat {newSuffix}
        </Typography>
      </MenuItem>

      {conversationIDs.map(conversationId =>
        <ConversationListItem
          key={'c-id-' + conversationId}
          conversationId={conversationId}
          isActive={conversationId === activeConversationId}
          isSingle={singleChat}
          conversationActivate={handleConversationActivate}
          conversationDelete={handleConversationDelete}
          conversationEditTitle={handleConversationEditTitle}
        />)}

      {/*<ListItem>*/}
      {/*  <Typography level='body2'>*/}
      {/*    Scratchpad*/}
      {/*  </Typography>*/}
      {/*</ListItem>*/}

      {/*<MenuItem>*/}
      {/*  <ListItemDecorator />*/}
      {/*  <Typography sx={{ opacity: 0.5 }}>*/}
      {/*    Feature <Link href='https://github.com/enricoros/nextjs-chatgpt-app/issues/17' target='_blank'>#17</Link>*/}
      {/*  </Typography>*/}
      {/*</MenuItem>*/}

    </Menu>

    {/* Confirmations */}
    <ConfirmationModal
      open={!!deleteConfirmationId} onClose={() => setDeleteConfirmationId(null)} onPositive={handleConfirmedDeleteConversation}
      confirmationText={'Are you sure you want to delete this conversation?'} positiveActionText={'Delete conversation'}
    />

  </>;
}