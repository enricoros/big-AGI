import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, ListDivider, ListItemDecorator, MenuItem, Tooltip, Typography } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FileUploadIcon from '@mui/icons-material/FileUpload';

import { MAX_CONVERSATIONS, useChatStore } from '~/common/state/store-chats';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { ConversationItem } from './ConversationItem';


export function ConversationItems(props: {
  conversationId: string | null
  onDeleteAllConversations: () => void,
  onImportConversation: () => void,
}) {

  // external state
  const conversationIDs = useChatStore(state => state.conversations.map(
    conversation => conversation.id,
  ), shallow);
  const { topNewConversationId, setActiveConversationId, createConversation, deleteConversation } = useChatStore(state => ({
    topNewConversationId: state.conversations.length ? state.conversations[0].messages.length === 0 ? state.conversations[0].id : null : null,
    setActiveConversationId: state.setActiveConversationId,
    createConversation: state.createConversation,
    deleteConversation: state.deleteConversation,
  }), shallow);
  const { showSymbols } = useUIPreferencesStore(state => ({
    showSymbols: state.zenMode !== 'cleaner',
  }), shallow);


  const hasChats = conversationIDs.length > 0;
  const singleChat = conversationIDs.length === 1;
  const maxReached = conversationIDs.length >= MAX_CONVERSATIONS;

  const handleNew = () => {
    // if the first in the stack is a new conversation, just activate it
    if (topNewConversationId)
      setActiveConversationId(topNewConversationId);
    else
      createConversation();
    /// FIXME props.onClose();
  };

  const handleConversationActivate = React.useCallback((conversationId: string) => {
    setActiveConversationId(conversationId);
  }, [setActiveConversationId]);

  const handleConversationDelete = React.useCallback((conversationId: string) => {
    if (!singleChat && conversationId)
      deleteConversation(conversationId);
  }, [deleteConversation, singleChat]);

  const NewPrefix = maxReached && <Tooltip title={`Maximum limit: ${MAX_CONVERSATIONS} chats. Proceeding will remove the oldest chat.`}><Box sx={{ mr: 2 }}>⚠️</Box></Tooltip>;

  return <>

    {/*<ListItem>*/}
    {/*  <Typography level='body2'>*/}
    {/*    Active chats*/}
    {/*  </Typography>*/}
    {/*</ListItem>*/}

    <MenuItem disabled={!!topNewConversationId && topNewConversationId === props.conversationId} onClick={handleNew}>
      <ListItemDecorator><AddIcon /></ListItemDecorator>
      {NewPrefix}New
    </MenuItem>

    <ListDivider />

    {conversationIDs.map(conversationId =>
      <ConversationItem
        key={'c-id-' + conversationId}
        conversationId={conversationId}
        isActive={conversationId === props.conversationId}
        isSingle={singleChat}
        showSymbols={showSymbols}
        conversationActivate={handleConversationActivate}
        conversationDelete={handleConversationDelete}
      />)}

    <ListDivider />

    <MenuItem onClick={props.onImportConversation}>
      <ListItemDecorator>
        <FileUploadIcon />
      </ListItemDecorator>
      Import conversation
    </MenuItem>

    <MenuItem disabled={!hasChats} onClick={props.onDeleteAllConversations}>
      <ListItemDecorator><DeleteOutlineIcon /></ListItemDecorator>
      <Typography>
        Delete all
      </Typography>
    </MenuItem>

    {/*<ListItem>*/}
    {/*  <Typography level='body2'>*/}
    {/*    Scratchpad*/}
    {/*  </Typography>*/}
    {/*</ListItem>*/}
    {/*<MenuItem>*/}
    {/*  <ListItemDecorator />*/}
    {/*  <Typography sx={{ opacity: 0.5 }}>*/}
    {/*    Feature <Link href={`${Brand.URIs.OpenRepo}/issues/17`} target='_blank'>#17</Link>*/}
    {/*  </Typography>*/}
    {/*</MenuItem>*/}

  </>;
}