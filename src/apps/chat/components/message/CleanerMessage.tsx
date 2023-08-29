import * as React from 'react';

import { Box, Button, Checkbox, IconButton, ListItem, Sheet, Typography, useTheme } from '@mui/joy';
import ClearIcon from '@mui/icons-material/Clear';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { DMessage } from '~/common/state/store-chats';

import { TokenBadge } from '../composer/TokenBadge';
import { makeAvatar, messageBackground } from './ChatMessage';


/**
 * Header bar for controlling the operations during the Selection mode
 */
export const MessagesSelectionHeader = (props: { hasSelected: boolean, isBottom: boolean, sumTokens: number, onClose: () => void, onSelectAll: (selected: boolean) => void, onDeleteMessages: () => void }) =>
  <Sheet color='warning' variant='solid' invertedColors sx={{
    display: 'flex', flexDirection: 'row', alignItems: 'center',
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 101,
    boxShadow: 'md',
    gap: { xs: 1, sm: 2 }, px: { xs: 1, md: 2 }, py: 1,
  }}>
    <Checkbox size='md' onChange={event => props.onSelectAll(event.target.checked)} sx={{ minWidth: 24, justifyContent: 'center' }} />

    <Box>Select all ({props.sumTokens})</Box>

    <Button variant='solid' disabled={!props.hasSelected} onClick={props.onDeleteMessages} sx={{ ml: 'auto', mr: 'auto', minWidth: 150 }} endDecorator={<DeleteOutlineIcon />}>
      Delete
    </Button>

    <IconButton variant='plain' onClick={props.onClose}>
      <ClearIcon />
    </IconButton>
  </Sheet>;


/**
 * Small representation of a ChatMessage, used when in selection mode
 *
 * Shall look similarly to the main ChatMessage, for consistency, but just allow a simple checkbox selection
 */
export function CleanerMessage(props: { message: DMessage, isBottom: boolean, selected: boolean, remainingTokens?: number, onToggleSelected?: (messageId: string, selected: boolean) => void }) {
  // external state
  const theme = useTheme();

  const {
    id: messageId,
    text: messageText,
    sender: messageSender,
    avatar: messageAvatar,
    typing: messageTyping,
    role: messageRole,
    purposeId: messagePurposeId,
    originLLM: messageOriginLLM,
    tokenCount: messageTokenCount,
    updated: messageUpdated,
  } = props.message;

  const fromAssistant = messageRole === 'assistant';

  const isAssistantError = fromAssistant && (messageText.startsWith('[Issue] ') || messageText.startsWith('[OpenAI Issue]'));

  const background = messageBackground(theme, messageRole, !!messageUpdated, isAssistantError);

  const avatarEl: React.JSX.Element | null = React.useMemo(() =>
      makeAvatar(messageAvatar, messageRole, messageOriginLLM, messagePurposeId, messageSender, messageTyping, 'sm'),
    [messageAvatar, messageOriginLLM, messagePurposeId, messageRole, messageSender, messageTyping],
  );

  const handleCheckedChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    props.onToggleSelected && props.onToggleSelected(messageId, event.target.checked);

  return (
    <ListItem sx={{
      display: 'flex', flexDirection: !fromAssistant ? 'row' : 'row', alignItems: 'center',
      gap: { xs: 1, sm: 2 }, px: { xs: 1, md: 2 }, py: 2,
      background,
      borderBottom: `1px solid ${theme.palette.divider}`,
      // position: 'relative',
      ...(props.isBottom && { mb: 'auto' }),
      '&:hover > button': { opacity: 1 },
    }}>

      {!!props.onToggleSelected && <Box sx={{ display: 'flex', minWidth: 24, justifyContent: 'center' }}>
        <Checkbox size='md' checked={props.selected} onChange={handleCheckedChange} />
      </Box>}

      <Box sx={{ display: 'flex', minWidth: { xs: 40, sm: 48 }, justifyContent: 'center' }}>
        {avatarEl}
      </Box>

      <Typography level='body-sm' sx={{ minWidth: 64 }}>
        {messageRole}
      </Typography>

      {props.remainingTokens !== undefined && <Box sx={{ display: 'flex', minWidth: { xs: 32, sm: 45 }, justifyContent: 'flex-end' }}>
        <TokenBadge directTokens={messageTokenCount} tokenLimit={props.remainingTokens} inline />
      </Box>}

      <Typography sx={{ flexGrow: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
        {messageText}
      </Typography>

    </ListItem>
  );
}