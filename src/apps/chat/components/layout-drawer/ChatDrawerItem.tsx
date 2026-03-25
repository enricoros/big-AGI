import * as React from 'react';

import { Avatar, Box, IconButton, ListItem, ListItemButton, ListItemDecorator, Sheet, styled, Tooltip, Typography } from '@mui/joy';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CopyAllIcon from '@mui/icons-material/CopyAll';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import TelegramIcon from '@mui/icons-material/Telegram';
import UnarchiveOutlinedIcon from '@mui/icons-material/UnarchiveOutlined';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

import { SystemPurposeId, SystemPurposes } from '../../../../data';

import { autoConversationTitle } from '~/modules/aifn/autotitle/autoTitle';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import type { DFolder } from '~/common/stores/folders/store-chat-folders';
import { ANIM_BUSY_TYPING } from '~/common/util/dMessageUtils';
import { ChatBeamIcon } from '~/common/components/icons/ChatBeamIcon';
import { InlineTextarea } from '~/common/components/InlineTextarea';
import { isDeepEqual } from '~/common/util/hooks/useDeep';
import { getArchiveDaysUntilPermanentDelete, useChatStore } from '~/common/stores/chat/store-chats';

import { CHAT_NOVEL_TITLE } from '../../AppChat';
import { shouldAutoDisarmDeleteArm } from './ChatDrawerItem.delete';
import { DELETE_HOLD_DURATION_MS, getChatTitleEditorSx, getDeleteConfirmButtonProps, getDeleteHoldProgressSx, getFolderTintBackgroundImage, getInactiveChatConfirmDeleteButtonSx, getInactiveChatDeleteButtonSx, getInactiveChatMainButtonSx, getInactiveChatRowShellSx } from './ChatDrawerItem.layout';


// set to true to display the conversation IDs
// const DEBUG_CONVERSATION_IDS = false;

export const FadeInButton = styled(IconButton)({
  opacity: 0.5,
  transition: 'opacity 0.16s',
  '&:hover': { opacity: 1 },
});


export const ChatDrawerItemMemo = React.memo(ChatDrawerItem, (prev, next) =>
  // usign a custom function because `ChatNavigationItemData` is a complex object and memo won't work
  isDeepEqual(prev.item, next.item) &&
  prev.showSymbols === next.showSymbols &&
  prev.bottomBarBasis === next.bottomBarBasis &&
  prev.onConversationActivate === next.onConversationActivate &&
  prev.onConversationBranch === next.onConversationBranch &&
  prev.onConversationDeleteNoConfirmation === next.onConversationDeleteNoConfirmation &&
  prev.onConversationDeletePermanently === next.onConversationDeletePermanently &&
  prev.onConversationSetArchived === next.onConversationSetArchived &&
  prev.onConversationExport === next.onConversationExport &&
  prev.onConversationFolderChange === next.onConversationFolderChange,
);

export interface ChatNavigationItemData {
  type: 'nav-item-chat-data',
  conversationId: DConversationId;
  isActive: boolean;
  isAlsoOpen: string | false;
  isEmpty: boolean;
  isIncognito: boolean;
  title: string;
  isArchived: boolean;
  archivedAt?: number;
  userSymbol: string | undefined;
  userFlagsSummary: string | undefined;
  containsDocAttachments: boolean;
  containsImageAssets: boolean;
  folder: DFolder | null | undefined; // null: 'All', undefined: do not show folder select
  updatedAt: number;
  hasBeamOpen: boolean;
  messageCount: number;
  beingGenerated: boolean;
  systemPurposeId: SystemPurposeId;
  searchFrequency: number;
}

export interface FolderChangeRequest {
  conversationId: DConversationId;
  anchorEl: HTMLButtonElement;
  currentFolder: DFolder | null;
}

function ChatDrawerItem(props: {
  // NOTE: always update the Memo comparison if you add or remove props
  item: ChatNavigationItemData,
  showSymbols: boolean | 'gif',
  bottomBarBasis: number,
  onConversationActivate: (conversationId: DConversationId, closeMenu: boolean) => void,
  onConversationBranch: (conversationId: DConversationId, messageId: string | null, addSplitPane: boolean) => void,
  onConversationDeleteNoConfirmation: (conversationId: DConversationId) => void,
  onConversationDeletePermanently: (conversationId: DConversationId) => void,
  onConversationSetArchived: (conversationId: DConversationId, isArchived: boolean) => void,
  onConversationExport: (conversationId: DConversationId, exportAll: boolean) => void,
  onConversationFolderChange: (folderChangeRequest: FolderChangeRequest) => void,
}) {

  // state
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [isAutoEditingTitle, setIsAutoEditingTitle] = React.useState(false);
  const [deleteArmed, setDeleteArmed] = React.useState(false);
  const [deleteHoldProgress, setDeleteHoldProgress] = React.useState(0);

  // derived state
  const { onConversationBranch, onConversationDeletePermanently, onConversationExport, onConversationFolderChange, onConversationSetArchived } = props;
  const {
    conversationId,
    isActive,
    isAlsoOpen,
    isIncognito,
    title,
    isArchived,
    archivedAt,
    userSymbol,
    userFlagsSummary,
    containsDocAttachments,
    containsImageAssets,
    folder,
    hasBeamOpen,
    messageCount,
    beingGenerated,
    systemPurposeId,
    searchFrequency,
  } = props.item;
  const isNew = messageCount === 0;
  const deleteHoldFrameRef = React.useRef<number | null>(null);
  const deleteHoldStartedAtRef = React.useRef<number | null>(null);
  const deleteHoldTriggeredRef = React.useRef(false);
  const suppressNextDeleteButtonClickRef = React.useRef(false);

  const clearDeleteHold = React.useCallback((resetProgress: boolean) => {
    if (deleteHoldFrameRef.current !== null) {
      cancelAnimationFrame(deleteHoldFrameRef.current);
      deleteHoldFrameRef.current = null;
    }
    deleteHoldStartedAtRef.current = null;
    deleteHoldTriggeredRef.current = false;
    if (resetProgress)
      setDeleteHoldProgress(0);
  }, []);


  // [effect] auto-disarm only after an armed active row becomes inactive
  const wasActiveRef = React.useRef(isActive);
  const shallClose = shouldAutoDisarmDeleteArm({
    deleteArmed,
    isActive,
    wasActive: wasActiveRef.current,
  });
  React.useEffect(() => {
    if (shallClose)
      setDeleteArmed(false);
    wasActiveRef.current = isActive;
  }, [isActive, shallClose]);
  React.useEffect(() => () => clearDeleteHold(false), [clearDeleteHold]);


  // Activate

  const handleConversationActivate = () => props.onConversationActivate(conversationId, true);


  // branch

  const handleConversationBranch = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    conversationId && onConversationBranch(conversationId, null, false /* no pane from Drawer duplicate */);
  }, [conversationId, onConversationBranch]);


  // export

  const handleConversationExport = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    conversationId && onConversationExport(conversationId, false);
  }, [conversationId, onConversationExport]);


  // Folder change

  const handleFolderChangeBegin = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onConversationFolderChange({
      conversationId,
      anchorEl: event.currentTarget,
      currentFolder: folder ?? null,
    });
  }, [conversationId, folder, onConversationFolderChange]);


  // Title Edit

  const handleTitleEditBegin = React.useCallback(() => setIsEditingTitle(true), []);

  const handleTitleEditCancel = React.useCallback(() => {
    setIsEditingTitle(false);
  }, []);

  const handleTitleEditChange = React.useCallback((text: string) => {
    setIsEditingTitle(false);
    useChatStore.getState().setUserTitle(conversationId, text.trim());
  }, [conversationId]);

  const handleTitleEditAuto = React.useCallback(async () => {
    setIsAutoEditingTitle(true);
    await autoConversationTitle(conversationId, true);
    setIsAutoEditingTitle(false);
  }, [conversationId]);


  // Delete

  const { onConversationDeleteNoConfirmation } = props;
  const handleDeleteButtonShow = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    // special case: if 'Shift' is pressed, delete immediately
    if (event.shiftKey) { // immediately delete:conversation
      onConversationDeleteNoConfirmation(conversationId);
      return;
    }
    setDeleteArmed(true);
  }, [conversationId, onConversationDeleteNoConfirmation]);

  const handleDeleteButtonHide = React.useCallback((event?: React.MouseEvent) => {
    event?.stopPropagation();
    setDeleteArmed(false);
  }, []);

  const handleConversationDelete = React.useCallback((event: React.MouseEvent) => {
    if (deleteArmed) {
      setDeleteArmed(false);
      event.stopPropagation();
      onConversationSetArchived(conversationId, true);
    }
  }, [conversationId, deleteArmed, onConversationSetArchived]);
  const handleConversationRestore = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    setDeleteArmed(false);
    onConversationSetArchived(conversationId, false);
  }, [conversationId, onConversationSetArchived]);
  const handleConversationDeletePermanently = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    onConversationDeletePermanently(conversationId);
  }, [conversationId, onConversationDeletePermanently]);
  const handleDeleteButtonPointerDown = React.useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (isArchived)
      return;
    if (deleteArmed)
      return;
    if (event.pointerType === 'mouse' && event.button !== 0)
      return;

    event.stopPropagation();
    clearDeleteHold(true);

    const startedAt = performance.now();
    deleteHoldStartedAtRef.current = startedAt;

    const updateProgress = (now: number) => {
      const currentStartedAt = deleteHoldStartedAtRef.current;
      if (currentStartedAt === null)
        return;

      const progress = Math.min((now - currentStartedAt) / DELETE_HOLD_DURATION_MS, 1);
      setDeleteHoldProgress(progress);

      if (progress >= 1) {
        deleteHoldTriggeredRef.current = true;
        suppressNextDeleteButtonClickRef.current = true;
        clearDeleteHold(true);
        setDeleteArmed(false);
        onConversationSetArchived(conversationId, true);
        return;
      }

      deleteHoldFrameRef.current = requestAnimationFrame(updateProgress);
    };

    deleteHoldFrameRef.current = requestAnimationFrame(updateProgress);
  }, [clearDeleteHold, conversationId, deleteArmed, isArchived, onConversationSetArchived]);

  const handleDeleteButtonPointerEnd = React.useCallback((event?: React.PointerEvent<HTMLButtonElement>) => {
    event?.stopPropagation();
    if (deleteHoldTriggeredRef.current)
      return;
    clearDeleteHold(true);
  }, [clearDeleteHold]);

  const handleDeleteButtonClick = React.useCallback((event: React.MouseEvent) => {
    if (suppressNextDeleteButtonClickRef.current) {
      suppressNextDeleteButtonClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (isArchived) {
      handleConversationRestore(event);
      return;
    }

    if (deleteArmed)
      handleDeleteButtonHide(event);
    else
      handleDeleteButtonShow(event);
  }, [deleteArmed, handleConversationRestore, handleDeleteButtonHide, handleDeleteButtonShow, isArchived]);


  const personaSymbol = userSymbol || SystemPurposes[systemPurposeId]?.symbol || '❓';
  const personaImageURI = SystemPurposes[systemPurposeId]?.imageUri ?? undefined;
  const deleteConfirmButtonProps = getDeleteConfirmButtonProps();
  const archiveDaysUntilPermanentDelete = React.useMemo(
    () => isArchived ? getArchiveDaysUntilPermanentDelete(archivedAt) : null,
    [archivedAt, isArchived],
  );


  const progress = props.bottomBarBasis ? 100 * (searchFrequency || messageCount) / props.bottomBarBasis : 0;
  const folderTintBackgroundImage = React.useMemo(
    () => !isIncognito ? getFolderTintBackgroundImage(folder?.color, isActive ? 0.1 : 0.07) : undefined,
    [folder?.color, isActive, isIncognito],
  );

  const titleRowComponent = React.useMemo(() => <>

    {/* Symbol, if globally enabled */}
    {(props.showSymbols || isIncognito) && (
      <ListItemDecorator>
        {hasBeamOpen ? (
          <ChatBeamIcon sx={{ fontSize: 'xl' }} />
        ) : isIncognito ? (
          <Avatar variant='soft' sx={{ backgroundColor: `#9C27B022`, width: '1.5rem', height: '1.5rem' }}>
            <VisibilityOffIcon sx={{ fontSize: 'md', color: `#9C27B0` }} />
          </Avatar>
        ) : (beingGenerated && props.showSymbols === 'gif') ? (
          <Avatar
            alt='chat activity'
            variant='plain'
            src={ANIM_BUSY_TYPING}
            sx={{
              width: '1.5rem',
              height: '1.5rem',
              borderRadius: 'var(--joy-radius-sm)',
            }}
          />
        ) : beingGenerated ? (
          <TelegramIcon sx={{ fontSize: 'xl' }} />
        ) : (personaImageURI && props.showSymbols === 'gif') ? (
          <Avatar
            alt={personaSymbol}
            src={personaImageURI}
            sx={{
              width: '1.5rem',
              height: '1.5rem',
              borderRadius: 'var(--joy-radius-sm)',
            }}
          />
        ) : (
          <Typography sx={isNew ? { opacity: 0.4, filter: 'grayscale(0.75)' } : undefined}>
            {personaSymbol}
          </Typography>
        )}
      </ListItemDecorator>
    )}

    {/* Title */}
    {!isEditingTitle ? (
      // using Box to not reset the parent font scaling
      <Box
        onDoubleClick={handleTitleEditBegin}
        sx={{
          color: isActive ? 'text.primary' : 'text.secondary',
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {/*{DEBUG_CONVERSATION_IDS && `${conversationId} - `}*/}
        {title.trim() ? title : CHAT_NOVEL_TITLE}
      </Box>
    ) : (
      <InlineTextarea
        invertedColors
        initialText={title}
        onEdit={handleTitleEditChange}
        onCancel={handleTitleEditCancel}
        sx={getChatTitleEditorSx(isActive)}
      />
    )}

    {/* Right text */}
    {isArchived && archiveDaysUntilPermanentDelete !== null ? (
      <Tooltip arrow disableInteractive title={`Auto-delete in ${archiveDaysUntilPermanentDelete} day${archiveDaysUntilPermanentDelete === 1 ? '' : 's'}`}>
        <Typography
          level='body-xs'
          sx={{
            whiteSpace: 'nowrap',
            color: archiveDaysUntilPermanentDelete <= 7 ? 'danger.plainColor' : 'text.tertiary',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {archiveDaysUntilPermanentDelete}d
        </Typography>
      </Tooltip>
    ) : searchFrequency > 0 ? (
      // Display search frequency if it exists and is greater than 0
      <Typography level='body-sm'>
        {searchFrequency}
      </Typography>
    ) : (props.showSymbols && (userFlagsSummary || containsDocAttachments || containsImageAssets)) ? (
      <Box sx={{
        fontSize: 'xs',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}>
        {userFlagsSummary}{containsDocAttachments && '📄'}{containsImageAssets && '🖍️'}
      </Box>
    ) : null}

  </>, [archiveDaysUntilPermanentDelete, beingGenerated, containsDocAttachments, containsImageAssets, handleTitleEditBegin, handleTitleEditCancel, handleTitleEditChange, hasBeamOpen, isActive, isArchived, isEditingTitle, isIncognito, isNew, personaImageURI, personaSymbol, props.showSymbols, searchFrequency, title, userFlagsSummary]);

  const progressBarFixedComponent = React.useMemo(() =>
    progress > 0 && (
      <Box sx={{
        backgroundColor: 'neutral.softHoverBg',
        position: 'absolute', left: 0, bottom: 0, width: progress + '%', height: 4,
      }} />
    ), [progress]);

  return (isActive || isAlsoOpen) ? (

    // Active or Also Open
    <Sheet
      variant={isActive ? 'solid' : 'outlined'}
      invertedColors={isActive}
      onClick={!isActive ? handleConversationActivate : undefined}
      sx={{
        // common
        // position: 'relative', // for the progress bar (now disabled)
        '--ListItem-minHeight': '2.75rem',

        // differences between primary and secondary variants
        ...(isActive ? {
          border: 'none', // there's a default border of 1px and invisible.. hmm
        } : {
          // '--variant-borderWidth': '0.125rem',
          cursor: 'pointer',
        }),

        // style
        fontSize: 'inherit',
        backgroundColor: isActive ? 'neutral.solidActiveBg' : 'neutral.softBg',
        ...(folderTintBackgroundImage ? {
          backgroundImage: folderTintBackgroundImage,
        } : {}),
        borderRadius: 'md',
        mx: '0.25rem',
        my: '0.1875rem',
        '&:hover > button': {
          opacity: 1, // fade in buttons when hovering, but by default wash them out a bit
        },
        // NOTE: we experimented with this code to have the actions fade in on hover, but idk about mobile..
        //       Buttons Row had the "className='chat-actions'"
        // '& .chat-actions': {
        //   opacity: 0,
        //   transition: 'opacity 0.2s ease-in-out',
        // },
        // '&:hover .chat-actions': {
        //   opacity: 1,
        // },
        ...(isIncognito && {
          backgroundColor: 'background.level2',
          backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.03), rgba(0,0,0,0.03) 10px, transparent 10px, transparent 20px)',
          // border: 'none',
          // border: '1px dashed',
          borderColor: 'background.level3',
          // purple icon to further indicate incognito mode
          '& .MuiListItemDecorator-root': {
            color: '#9C27B0',
          },
          // filter: 'brightness(0.5) contrast(0.5)',
        }),
      }}
    >

      <ListItem sx={{ border: 'none', display: 'grid', gap: 0, px: 'calc(var(--ListItem-paddingX) - 0.25rem)' }}>

        {/* Title row */}
        <Box sx={{ display: 'flex', gap: 'var(--ListItem-gap)', minHeight: '2.25rem', alignItems: 'center' }}>
          {titleRowComponent}
          {isArchived && (
            <Tooltip arrow disableInteractive title='Restore'>
              <FadeInButton
                key='btn-restore-title-row'
                size='sm'
                onClick={handleConversationRestore}
              >
                <UnarchiveOutlinedIcon />
              </FadeInButton>
            </Tooltip>
          )}
        </Box>

        {/* buttons row */}
        {isActive && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 0.5, rowGap: 0.5, minHeight: '2.25rem', alignItems: 'center' }}>
            {props.showSymbols && <ListItemDecorator />}

            {/* Current Folder color, and change initiator */}
            {!deleteArmed && <>
              {(folder !== undefined) && <>
                <Tooltip arrow disableInteractive title={folder ? `Change Folder (${folder.title})` : 'Add to Folder'}>
                  {folder ? (
                    <IconButton size='sm' onClick={handleFolderChangeBegin}>
                      <FolderIcon style={{ color: folder.color || 'inherit' }} />
                    </IconButton>
                  ) : (
                    <FadeInButton size='sm' onClick={handleFolderChangeBegin}>
                      <FolderOutlinedIcon />
                    </FadeInButton>
                  )}
                </Tooltip>
              </>}

              <Tooltip arrow disableInteractive title='Rename'>
                <FadeInButton size='sm' disabled={isEditingTitle || isAutoEditingTitle} onClick={handleTitleEditBegin}>
                  <EditRoundedIcon />
                </FadeInButton>
              </Tooltip>

              {!isNew && <>
                <Tooltip arrow disableInteractive color='success' title='Auto-Title'>
                  <FadeInButton size='sm' disabled={isEditingTitle || isAutoEditingTitle} onClick={handleTitleEditAuto}>
                    <AutoFixHighIcon />
                  </FadeInButton>
                </Tooltip>

                <Tooltip arrow disableInteractive title='Duplicate'>
                  <FadeInButton size='sm' onClick={handleConversationBranch}>
                    <CopyAllIcon />
                  </FadeInButton>
                </Tooltip>

                <Tooltip arrow disableInteractive title='Export Chat'>
                  <FadeInButton size='sm' onClick={handleConversationExport}>
                    <FileUploadOutlinedIcon />
                  </FadeInButton>
                </Tooltip>
              </>}
            </>}

            <Box sx={{ flex: '1 1 auto', minWidth: 0 }} />

            {deleteArmed && !isArchived && (
              <Tooltip color='danger' arrow disableInteractive title='Confirm Archive'>
                <FadeInButton key='btn-del' size='sm' onClick={handleConversationDelete} {...deleteConfirmButtonProps}>
                  <ArchiveOutlinedIcon />
                </FadeInButton>
              </Tooltip>
            )}

            {!isArchived && (
              <Tooltip arrow disableInteractive title={deleteArmed ? 'Cancel Archive' : 'Archive'}>
                <FadeInButton
                  key='btn-arm'
                  size='sm'
                  onClick={handleDeleteButtonClick}
                  onPointerDown={handleDeleteButtonPointerDown}
                  onPointerUp={handleDeleteButtonPointerEnd}
                  onPointerCancel={handleDeleteButtonPointerEnd}
                  onPointerLeave={handleDeleteButtonPointerEnd}
                  sx={deleteArmed
                    ? { opacity: 1 }
                    : getDeleteHoldProgressSx(deleteHoldProgress)}
                >
                  {deleteArmed ? <CloseRoundedIcon /> : <ArchiveOutlinedIcon />}
                </FadeInButton>
              </Tooltip>
            )}

            {isArchived && (
              <Tooltip color='danger' arrow disableInteractive title='Delete Permanently'>
                <FadeInButton key='btn-del-permanent' size='sm' color='danger' onClick={handleConversationDeletePermanently}>
                  <DeleteForeverIcon />
                </FadeInButton>
              </Tooltip>
            )}
          </Box>
        )}

        {/* View places row */}
        {isAlsoOpen && (
          <Typography level='body-xs' sx={{ mx: 'auto' }}>
            <em>In view {isAlsoOpen}</em>
          </Typography>
        )}

      </ListItem>

      {/* Optional progress bar, underlay */}
      {/* NOTE: disabled on 20240204: quite distracting on the active chat sheet */}
      {/*{progressBarFixedComponent}*/}

    </Sheet>

  ) : (

    // Inactive Conversation - click to activate
    <Sheet className='chat-drawer-item-shell' variant='plain' sx={getInactiveChatRowShellSx(isIncognito, folder?.color)}>
      <ListItem sx={{ alignItems: 'center', gap: 0.5, px: 'calc(var(--ListItem-paddingX) - 0.25rem)', position: 'relative' }}>

        <ListItemButton
          onClick={handleConversationActivate}
          sx={getInactiveChatMainButtonSx(isIncognito, deleteArmed, folder?.color)}
        >

          {titleRowComponent}

          {/* Optional progress bar, underlay */}
          {progressBarFixedComponent}

        </ListItemButton>

        {deleteArmed && (
          <Tooltip color='danger' arrow disableInteractive title='Confirm Archive'>
            <FadeInButton
              aria-label='Confirm Archive'
              key='btn-del-inactive'
              size='sm'
              onClick={handleConversationDelete}
              {...deleteConfirmButtonProps}
              sx={{
                ...deleteConfirmButtonProps.sx,
                ...getInactiveChatConfirmDeleteButtonSx(),
              }}
            >
              <ArchiveOutlinedIcon />
            </FadeInButton>
          </Tooltip>
        )}

        <Tooltip arrow disableInteractive title={isArchived ? 'Restore' : deleteArmed ? 'Cancel Archive' : 'Archive'}>
          <FadeInButton
            aria-label={isArchived ? 'Restore' : deleteArmed ? 'Cancel Archive' : 'Archive'}
            className='chat-drawer-item-delete-button'
            key='btn-arm-inactive'
            size='sm'
            onClick={handleDeleteButtonClick}
            onPointerDown={handleDeleteButtonPointerDown}
            onPointerUp={handleDeleteButtonPointerEnd}
            onPointerCancel={handleDeleteButtonPointerEnd}
            onPointerLeave={handleDeleteButtonPointerEnd}
            sx={{
              ...getInactiveChatDeleteButtonSx(deleteArmed),
              ...(!deleteArmed && !isArchived ? getDeleteHoldProgressSx(deleteHoldProgress) : {}),
            }}
          >
            {isArchived ? <UnarchiveOutlinedIcon /> : deleteArmed ? <CloseRoundedIcon /> : <ArchiveOutlinedIcon />}
          </FadeInButton>
        </Tooltip>

      </ListItem>
    </Sheet>
  );
}
