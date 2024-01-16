import * as React from 'react';

import { Avatar, Box, IconButton, ListItem, ListItemButton, ListItemDecorator, Sheet, styled, Tooltip, Typography } from '@mui/joy';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CloseIcon from '@mui/icons-material/Close';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';

import { SystemPurposeId, SystemPurposes } from '../../../../data';

import { conversationAutoTitle } from '~/modules/aifn/autotitle/autoTitle';

import { DConversationId, useChatStore } from '~/common/state/store-chats';
import { InlineTextarea } from '~/common/components/InlineTextarea';


const FadeInButton = styled(IconButton)({
  opacity: 0.5,
  transition: 'opacity 0.2s',
  '&:hover': { opacity: 1 },
});


export const ChatDrawerItemMemo = React.memo(ChatNavigationItem);

export interface ChatNavigationItemData {
  conversationId: DConversationId;
  isActive: boolean;
  isEmpty: boolean;
  title: string;
  messageCount: number;
  assistantTyping: boolean;
  systemPurposeId: SystemPurposeId;
  searchFrequency?: number;
}

function ChatNavigationItem(props: {
  item: ChatNavigationItemData,
  isLonely: boolean,
  showSymbols: boolean,
  bottomBarBasis: number,
  onConversationActivate: (conversationId: DConversationId, closeMenu: boolean) => void,
  onConversationDelete: (conversationId: DConversationId) => void,
}) {

  // state
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [deleteArmed, setDeleteArmed] = React.useState(false);

  // derived state
  const { conversationId, isActive, title, messageCount, assistantTyping, systemPurposeId, searchFrequency } = props.item;
  const isNew = messageCount === 0;


  // [effect] auto-disarm when inactive
  const shallClose = deleteArmed && !isActive;
  React.useEffect(() => {
    if (shallClose)
      setDeleteArmed(false);
  }, [shallClose]);


  // Activate

  const handleConversationActivate = () => props.onConversationActivate(conversationId, true);


  // Title Edit

  const handleTitleEditBegin = React.useCallback(() => setIsEditingTitle(true), []);

  const handleTitleEditCancel = React.useCallback(() => {
    setIsEditingTitle(false);
  }, []);

  const handleTitleEditChange = React.useCallback((text: string) => {
    setIsEditingTitle(false);
    useChatStore.getState().setUserTitle(conversationId, text.trim());
  }, [conversationId]);

  const handleTitleEditAuto = React.useCallback(() => {
    conversationAutoTitle(conversationId, true);
  }, [conversationId]);


  // Delete

  const handleDeleteButtonShow = React.useCallback(() => setDeleteArmed(true), []);

  const handleDeleteButtonHide = React.useCallback(() => setDeleteArmed(false), []);

  const handleConversationDelete = React.useCallback((event: React.MouseEvent) => {
    if (deleteArmed) {
      setDeleteArmed(false);
      event.stopPropagation();
      props.onConversationDelete(conversationId);
    }
  }, [conversationId, deleteArmed, props]);


  const textSymbol = SystemPurposes[systemPurposeId]?.symbol || '❓';

  const progress = props.bottomBarBasis ? 100 * (searchFrequency ?? messageCount) / props.bottomBarBasis : 0;


  const titleRowComponent = React.useMemo(() => <>

    {/* Symbol, if globally enabled */}
    {props.showSymbols && <ListItemDecorator>
      {assistantTyping
        ? (
          <Avatar
            alt='typing' variant='plain'
            src='https://i.giphy.com/media/jJxaUysjzO9ri/giphy.webp'
            sx={{
              width: '1.5rem',
              height: '1.5rem',
              borderRadius: 'var(--joy-radius-sm)',
            }}
          />
        ) : (
          <Typography>
            {isNew ? '' : textSymbol}
          </Typography>
        )}
    </ListItemDecorator>}

    {/* Title */}
    {!isEditingTitle ? (
      <Typography
        // level={isActive ? 'title-md' : 'body-md'}
        onDoubleClick={handleTitleEditBegin}
        sx={{
          color: isActive ? 'text.primary' : 'text.secondary',
          flex: 1,
        }}
      >
        {title.trim() ? title : 'Chat'}{assistantTyping && '...'}
      </Typography>
    ) : (
      <InlineTextarea
        invertedColors
        initialText={title}
        onEdit={handleTitleEditChange}
        onCancel={handleTitleEditCancel}
        sx={{
          flexGrow: 1,
          ml: -1.5, mr: -0.5,
        }}
      />
    )}

    {/* Display search frequency if it exists and is greater than 0 */}
    {searchFrequency && searchFrequency > 0 && (
      <Box sx={{ ml: 1 }}>
        <Typography level='body-sm'>
          {searchFrequency}
        </Typography>
      </Box>
    )}

  </>, [assistantTyping, handleTitleEditBegin, handleTitleEditCancel, handleTitleEditChange, isActive, isEditingTitle, isNew, props.showSymbols, searchFrequency, textSymbol, title]);

  const progressBarFixedComponent = React.useMemo(() =>
    progress > 0 && (
      <Box sx={{
        backgroundColor: 'neutral.softBg',
        position: 'absolute', left: 0, bottom: 0, width: progress + '%', height: 4,
      }} />
    ), [progress]);


  return isActive ?

    // Active Conversation
    <Sheet
      variant={isActive ? 'solid' : 'plain'} color='neutral'
      invertedColors={isActive}
      sx={{
        // common
        '--ListItem-minHeight': '2.75rem',
        position: 'relative', // for the progress bar
        border: 'none', // there's a default border of 1px and invisible.. hmm
        // style
        borderRadius: 'md',
        mx: '0.25rem',
        '&:hover > button': {
          opacity: 1, // fade in buttons when hovering, but by default wash them out a bit
        },
      }}
    >

      <ListItem sx={{ border: 'none', display: 'grid', gap: 0, px: 'calc(var(--ListItem-paddingX) - 0.25rem)' }}>

        {/* title row */}
        <Box sx={{ display: 'flex', gap: 'var(--ListItem-gap)', minHeight: '2.25rem', alignItems: 'center' }}>

          {titleRowComponent}

        </Box>

        {/* buttons row */}
        <Box sx={{ display: 'flex', gap: 'var(--ListItem-gap)', minHeight: '2.25rem', alignItems: 'center' }}>

          <ListItemDecorator />

          <Tooltip title='Rename Chat'>
            <FadeInButton size='sm' disabled={isEditingTitle} onClick={handleTitleEditBegin}>
              <EditIcon />
            </FadeInButton>
          </Tooltip>

          {!isNew && (
            <Tooltip title='Auto-title Chat'>
              <FadeInButton size='sm' disabled={isEditingTitle} onClick={handleTitleEditAuto}>
                <AutoFixHighIcon />
              </FadeInButton>
            </Tooltip>
          )}

          {/* --> */}
          <Box sx={{ flex: 1 }} />

          {/* Delete Button(s) */}
          {!props.isLonely && !searchFrequency && <>
            {deleteArmed && (
              <Tooltip title='Confirm Deletion'>
                <FadeInButton key='btn-del' variant='solid' color='success' size='sm' onClick={handleConversationDelete} sx={{ opacity: 1 }}>
                  <DeleteForeverIcon sx={{ color: 'danger.solidBg' }} />
                </FadeInButton>
              </Tooltip>
            )}

            <Tooltip title={deleteArmed ? 'Cancel' : 'Delete?'}>
              <FadeInButton key='btn-arm' size='sm' onClick={deleteArmed ? handleDeleteButtonHide : handleDeleteButtonShow} sx={deleteArmed ? { opacity: 1 } : {}}>
                {deleteArmed ? <CloseIcon /> : <DeleteOutlineIcon />}
              </FadeInButton>
            </Tooltip>
          </>}

        </Box>

      </ListItem>

      {/* Optional progress bar, underlay */}
      {progressBarFixedComponent}

    </Sheet>

    :

    // Inactive Conversation - click to activate
    <ListItemButton
      onClick={handleConversationActivate}
      sx={{
        '--ListItem-minHeight': '2.75rem',
        position: 'relative', // for the progress bar
        border: 'none', // there's a default border of 1px and invisible.. hmm
      }}
    >

      {titleRowComponent}

      {/* Optional progress bar, underlay */}
      {progressBarFixedComponent}

    </ListItemButton>;
}