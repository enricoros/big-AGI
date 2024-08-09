import * as React from 'react';

import { Box, Button, Checkbox, IconButton, ListItem, Sheet, Typography } from '@mui/joy';
import ClearIcon from '@mui/icons-material/Clear';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { DMessage, messageFragmentsReduceText } from '~/common/stores/chat/chat.message';

import { TokenBadgeMemo } from '../composer/tokens/TokenBadge';
import { isErrorChatMessage } from './explainServiceErrors';
import { makeMessageAvatarIcon, messageBackground } from './messageUtils';


/**
 * Header bar for controlling the operations during the Selection mode
 */
export const MessagesSelectionHeader = (props: { hasSelected: boolean, sumTokens: number, onClose: () => void, onSelectAll: (selected: boolean) => void, onDeleteMessages: () => void }) =>
  <Sheet color='warning' variant='solid' invertedColors sx={{
    position: 'sticky', top: 0, left: 0, right: 0, zIndex: 101 /* Cleanup Selection Header on top of messages */,
    boxShadow: 'md',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: { xs: 1, sm: 2 }, px: { xs: 1, md: 2 }, py: 1,
  }}>
    <Checkbox size='md' onChange={event => props.onSelectAll(event.target.checked)} sx={{ minWidth: 24, justifyContent: 'center' }} />

    <Box>Select all ({props.sumTokens})</Box>

    <Button variant='solid' disabled={!props.hasSelected} onClick={props.onDeleteMessages} sx={{ ml: 'auto', mr: 'auto', minWidth: 150 }} endDecorator={<DeleteOutlineIcon />}>
      Delete
    </Button>

    <IconButton onClick={props.onClose}>
      <ClearIcon />
    </IconButton>
  </Sheet>;


/**
 * Small representation of a ChatMessage, used when in selection mode
 *
 * Shall look similarly to the main ChatMessage, for consistency, but just allow a simple checkbox selection
 */
export function CleanerMessage(props: { message: DMessage, selected: boolean, remainingTokens?: number, onToggleSelected?: (messageId: string, selected: boolean) => void }) {

  // derived state
  const {
    id: messageId,
    pendingIncomplete: messagePendingIncomplete,
    role: messageRole,
    purposeId: messagePurposeId,
    originLLM: messageOriginLLM,
    tokenCount: messageTokenCount,
    updated: messageUpdated,
  } = props.message;

  const messageText = messageFragmentsReduceText(props.message.fragments);

  const fromAssistant = messageRole === 'assistant';

  const isAssistantError = fromAssistant && isErrorChatMessage(messageText);

  const backgroundColor = messageBackground(messageRole, !!messageUpdated, isAssistantError);

  const avatarIconEl: React.JSX.Element | null = React.useMemo(() =>
      makeMessageAvatarIcon('pro', messageRole, messageOriginLLM, messagePurposeId, !!messagePendingIncomplete),
    [messageOriginLLM, messagePendingIncomplete, messagePurposeId, messageRole],
  );

  const handleCheckedChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    props.onToggleSelected && props.onToggleSelected(messageId, event.target.checked);

  return (
    <ListItem sx={{
      display: 'flex', flexDirection: !fromAssistant ? 'row' : 'row', alignItems: 'center',
      gap: { xs: 1, sm: 2 }, px: { xs: 1, md: 2 }, py: 2,
      backgroundColor,
      borderBottom: '1px solid',
      borderBottomColor: 'divider',
      // position: 'relative',
      '&:hover > button': { opacity: 1 },
    }}>

      {!!props.onToggleSelected && <Box sx={{ display: 'flex', minWidth: 24, justifyContent: 'center' }}>
        <Checkbox size='md' checked={props.selected} onChange={handleCheckedChange} />
      </Box>}

      <Box sx={{ display: { xs: 'none', sm: 'flex' }, minWidth: { xs: 40, sm: 48 }, justifyContent: 'center' }}>
        {avatarIconEl}
      </Box>

      <Typography level='body-sm' sx={{ minWidth: 64 }}>
        {messageRole}
      </Typography>

      {props.remainingTokens !== undefined && <Box sx={{ display: 'flex', minWidth: { xs: 32, sm: 45 }, justifyContent: 'flex-end' }}>
        <TokenBadgeMemo direct={messageTokenCount} limit={props.remainingTokens} inline />
      </Box>}

      <Typography level='body-md' sx={{
        flexGrow: 1,
        textOverflow: 'ellipsis', overflow: 'hidden',
        // whiteSpace: 'nowrap',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        maxHeight: '2.9em',
      }}>
        {messageText}
      </Typography>

    </ListItem>
  );
}