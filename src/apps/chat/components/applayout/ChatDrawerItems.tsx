import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, ListDivider, ListItemDecorator, MenuItem, Typography } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FileUploadIcon from '@mui/icons-material/FileUpload';

import { DConversationId, useChatStore } from '~/common/state/store-chats';
import { OpenAIIcon } from '~/common/components/icons/OpenAIIcon';
import { closeLayoutDrawer } from '~/common/layout/store-applayout';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { ConversationItem } from './ConversationItem';


type ListGrouping = 'off' | 'persona';

export function ChatDrawerItems(props: {
  conversationId: DConversationId | null,
  disableNewButton: boolean,
  onDeleteAllConversations: () => void,
  onDeleteConversation: (conversationId: DConversationId) => void,
  onImportConversation: () => void,
  onNewConversation: () => void,
  onSelectConversation: (conversationId: DConversationId) => void,
}) {

  // local state
  const { onDeleteConversation, onNewConversation, onSelectConversation } = props;
  const [grouping] = React.useState<ListGrouping>('off');

  // external state
  const { conversationIDs, maxChatMessages } = useChatStore(state => ({
    conversationIDs: state.conversations.map(_c => _c.id),
    maxChatMessages: state.conversations.reduce((longest, _c) => Math.max(longest, _c.messages.length), 0),
  }), shallow);
  const [experimentalLabs, showSymbols] = useUIPreferencesStore(state => [state.experimentalLabs, state.zenMode !== 'cleaner'], shallow);

  // derived state
  const totalConversations = conversationIDs.length;
  const hasChats = totalConversations > 0;
  const singleChat = totalConversations === 1;
  const softMaxReached = totalConversations >= 50;


  const handleNew = React.useCallback(() => {
    onNewConversation();
    closeLayoutDrawer();
  }, [onNewConversation]);

  const handleConversationDelete = React.useCallback((conversationId: DConversationId) => {
    !singleChat && conversationId && onDeleteConversation(conversationId);
  }, [onDeleteConversation, singleChat]);

  const handleConversationSelect = React.useCallback((conversationId: DConversationId, closeMenu: boolean) => {
    onSelectConversation(conversationId);
    if (closeMenu)
      closeLayoutDrawer();
  }, [onSelectConversation]);


  // grouping
  let sortedIds = conversationIDs;
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
  }

  return <>

    {/*<ListItem>*/}
    {/*  <Typography level='body-sm'>*/}
    {/*    Active chats*/}
    {/*  </Typography>*/}
    {/*</ListItem>*/}

    <MenuItem disabled={props.disableNewButton} onClick={handleNew}>
      <ListItemDecorator><AddIcon /></ListItemDecorator>
      <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'space-between', gap: 1 }}>
        New
        {/*<KeyStroke combo='Ctrl + Alt + N' />*/}
      </Box>
    </MenuItem>

    <ListDivider sx={{ mb: 0 }} />

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

      {sortedIds.map(conversationId =>
        <ConversationItem
          key={'c-id-' + conversationId}
          conversationId={conversationId}
          isActive={conversationId === props.conversationId}
          isLonely={singleChat}
          maxChatMessages={(experimentalLabs || softMaxReached) ? maxChatMessages : 0}
          showSymbols={showSymbols}
          onDeleteConversation={handleConversationDelete}
          onSelectConversation={handleConversationSelect}
        />)}
    </Box>

    <ListDivider sx={{ mt: 0 }} />

    <MenuItem onClick={props.onImportConversation}>
      <ListItemDecorator>
        <FileUploadIcon />
      </ListItemDecorator>
      Import chats
      <OpenAIIcon sx={{ fontSize: 'xl', ml: 'auto' }} />
    </MenuItem>

    <MenuItem disabled={!hasChats} onClick={props.onDeleteAllConversations}>
      <ListItemDecorator><DeleteOutlineIcon /></ListItemDecorator>
      <Typography>
        Delete {totalConversations >= 2 ? `all ${totalConversations} chats` : 'chat'}
      </Typography>
    </MenuItem>

    {/*<ListItem>*/}
    {/*  <Typography level='body-sm'>*/}
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