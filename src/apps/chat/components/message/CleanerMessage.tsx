import * as React from 'react';

import { Box, Button, Checkbox, IconButton, ListItem, Sheet, Typography } from '@mui/joy';
import ClearIcon from '@mui/icons-material/Clear';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

import { DMessage, MESSAGE_FLAG_AIX_SKIP, messageFragmentsReduceText, messageHasUserFlag } from '~/common/stores/chat/chat.message';
import { makeMessageAvatarIcon, messageBackground } from '~/common/util/dMessageUtils';

import { TokenBadgeMemo } from '../composer/tokens/TokenBadge';
import { isErrorChatMessage } from './explainServiceErrors';
import { messageSkippedSx } from './ChatMessage';


/**
 * Header bar for controlling the operations during the Selection mode
 */
export const MessagesSelectionHeader = (props: { hasSelected: boolean, sumTokens: number, onClose: () => void, onSelectAll: (selected: boolean) => void, onDeleteMessages: () => void, onHideMessages: () => void }) =>
  <Sheet color='warning' variant='solid' invertedColors sx={{
    position: 'sticky', top: 0, left: 0, right: 0, zIndex: 101 /* Cleanup Selection Header on top of messages */,
    boxShadow: 'md',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: { xs: 1, sm: 2 }, px: { xs: 1, md: 2 }, py: 1,
  }}>
    <Checkbox size='md' onChange={event => props.onSelectAll(event.target.checked)} sx={{ minWidth: 24, justifyContent: 'center' }} />

    <Box sx={{ fontSize: 'sm' }}>Select all ({props.sumTokens?.toLocaleString()})</Box>

    <Box sx={{ mx: 'auto', display: 'flex', gap: 1 }}>
      <Button size='sm' disabled={!props.hasSelected} onClick={props.onHideMessages} sx={{ minWidth: { md: 120 } }} endDecorator={<VisibilityOffIcon />}>
        Hide
      </Button>
      <Button size='sm' disabled={!props.hasSelected} onClick={props.onDeleteMessages} sx={{ minWidth: { md: 120 } }} endDecorator={<DeleteOutlineIcon />}>
        Delete
      </Button>
    </Box>

    <IconButton size='sm' onClick={props.onClose}>
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
    generator: messageGenerator,
    tokenCount: messageTokenCount,
    updated: messageUpdated,
  } = props.message;

  const messageText = messageFragmentsReduceText(props.message.fragments);

  const fromAssistant = messageRole === 'assistant';

  const messageGeneratorName = messageGenerator?.name;

  const isUserMessageSkipped = messageHasUserFlag(props.message, MESSAGE_FLAG_AIX_SKIP);

  const isAssistantError = fromAssistant && isErrorChatMessage(messageText);

  const backgroundColor = messageBackground(messageRole, !!messageUpdated, isAssistantError);

  const avatarIconEl: React.JSX.Element | null = React.useMemo(() => {
    return makeMessageAvatarIcon('pro', messageRole, messageGeneratorName, messagePurposeId, !!messagePendingIncomplete, isUserMessageSkipped, false, false);
  }, [isUserMessageSkipped, messageGeneratorName, messagePendingIncomplete, messagePurposeId, messageRole]);

  const handleCheckedChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    props.onToggleSelected && props.onToggleSelected(messageId, event.target.checked);

  return (
    <ListItem
      onClick={() => props.onToggleSelected?.(messageId, !props.selected)}
      sx={{
        display: 'flex', flexDirection: !fromAssistant ? 'row' : 'row', alignItems: 'center',
        gap: { xs: 1, sm: 2 }, px: { xs: 1, md: 2 }, py: 2,
        backgroundColor,
        borderBottom: '1px solid',
        borderBottomColor: 'divider',
        ...(isUserMessageSkipped && messageSkippedSx),
        // position: 'relative',
        '&:hover > button': { opacity: 1 },
      }}
    >

      {!!props.onToggleSelected && <Box sx={{ display: 'flex', minWidth: 24, justifyContent: 'center' }}>
        <Checkbox size='md' checked={props.selected} onChange={handleCheckedChange} />
      </Box>}

      {props.remainingTokens !== undefined && <Box sx={{ display: 'flex', minWidth: { xs: 32, sm: 45 }, justifyContent: 'flex-end' }}>
        <TokenBadgeMemo direct={messageTokenCount} limit={props.remainingTokens} inline />
      </Box>}

      <Box sx={{ display: { xs: 'none', sm: 'flex' }, minWidth: { xs: 40, sm: 48 }, justifyContent: 'center' }}>
        {avatarIconEl}
      </Box>

      <Typography level='body-sm' sx={{ minWidth: 64 }}>
        {messageRole}
      </Typography>

      <Typography level='body-sm' sx={{
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