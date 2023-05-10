import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, ListDivider, ListItemDecorator, MenuItem, Tooltip, Typography } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FileUploadIcon from '@mui/icons-material/FileUpload';

import { ConfirmationModal } from '@/common/components/ConfirmationModal';
import { MAX_CONVERSATIONS, useChatStore } from '@/common/state/store-chats';
import { useSettingsStore } from '@/common/state/store-settings';

import { ChatPagesMenuItem } from './ChatPagesMenuItem';


const SPECIAL_ID_ALL_CHATS = 'all-chats';


export function ChatPagesMenu(props: { conversationId: string | null, onImportConversation: () => void }) {
  // state
  const [deleteConfirmationId, setDeleteConfirmationId] = React.useState<string | null>(null);

  // external state
  const conversationIDs = useChatStore(state => state.conversations.map(conversation => conversation.id), shallow);
  const { setActiveConversationId, createConversation, deleteConversation, newConversationId } = useChatStore(state => ({
    setActiveConversationId: state.setActiveConversationId,
    createConversation: state.createConversation,
    deleteConversation: state.deleteConversation,
    newConversationId: state.conversations.length ? state.conversations[0].messages.length === 0 ? state.conversations[0].id : null : null,
  }), shallow);
  const showSymbols = useSettingsStore(state => state.zenMode) !== 'cleaner';


  const hasChats = conversationIDs.length > 0;
  const singleChat = conversationIDs.length === 1;
  const maxReached = conversationIDs.length >= MAX_CONVERSATIONS;


  const handleNew = () => {
    // if the first in the stack is a new conversation, just activate it
    if (newConversationId)
      setActiveConversationId(newConversationId);
    else
      createConversation();
    /// FIXME props.onClose();
  };

  const handleConversationActivate = (conversationId: string) => setActiveConversationId(conversationId);

  const handleConversationDelete = (e: React.MouseEvent, conversationId: string) => {
    if (!singleChat) {
      e.stopPropagation();
      // NOTE: the old behavior was good, keeping it for reference - now we'll only ask for confirmation when deleting all chats
      // // if the chat is empty, just delete it
      // if (conversationId === newConversationId)
      //   deleteConversation(conversationId);
      // // otherwise, ask for confirmation
      // else {
      //   setActiveConversationId(conversationId);
      //   setDeleteConfirmationId(conversationId);
      // }
      if (conversationId)
        deleteConversation(conversationId);
    }
  };

  const handleConfirmedDeleteConversation = () => {
    if (hasChats && deleteConfirmationId) {
      if (deleteConfirmationId === SPECIAL_ID_ALL_CHATS) {
        createConversation();
        conversationIDs.forEach(conversationId => deleteConversation(conversationId));
      } else
        deleteConversation(deleteConfirmationId);
      setDeleteConfirmationId(null);
    }
  };

  const handleDeleteAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmationId(SPECIAL_ID_ALL_CHATS);
  };


  const NewPrefix = maxReached && <Tooltip title={`Maximum limit: ${MAX_CONVERSATIONS} chats. Proceeding will remove the oldest chat.`}><Box sx={{ mr: 2 }}>⚠️</Box></Tooltip>;

  return <>

    {/*<ListItem>*/}
    {/*  <Typography level='body2'>*/}
    {/*    Active chats*/}
    {/*  </Typography>*/}
    {/*</ListItem>*/}

    <MenuItem onClick={handleNew} disabled={!!newConversationId && newConversationId === props.conversationId}>
      <ListItemDecorator><AddIcon /></ListItemDecorator>
      {NewPrefix}New
    </MenuItem>

    <ListDivider />

    {conversationIDs.map(conversationId =>
      <ChatPagesMenuItem
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

    <MenuItem disabled={!hasChats} onClick={handleDeleteAll}>
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

    {/* Confirmations */}
    <ConfirmationModal
      open={!!deleteConfirmationId} onClose={() => setDeleteConfirmationId(null)} onPositive={handleConfirmedDeleteConversation}
      confirmationText={deleteConfirmationId === SPECIAL_ID_ALL_CHATS
        ? 'Are you absolutely sure you want to delete ALL conversations? This action cannot be undone.'
        : 'Are you sure you want to delete this conversation?'}
      positiveActionText={deleteConfirmationId === SPECIAL_ID_ALL_CHATS
        ? 'Yes, delete all'
        : 'Delete conversation'}
    />

  </>;
}