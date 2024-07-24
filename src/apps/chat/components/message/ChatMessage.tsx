import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';
import TimeAgo from 'react-timeago';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, ButtonGroup, CircularProgress, IconButton, ListDivider, ListItem, ListItemDecorator, MenuItem, Switch, Tooltip, Typography } from '@mui/joy';
import { ClickAwayListener, Popper } from '@mui/base';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DifferenceIcon from '@mui/icons-material/Difference';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import ForkRightIcon from '@mui/icons-material/ForkRight';
import FormatPaintOutlinedIcon from '@mui/icons-material/FormatPaintOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import RecordVoiceOverOutlinedIcon from '@mui/icons-material/RecordVoiceOverOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import ReplyRoundedIcon from '@mui/icons-material/ReplyRounded';
import StarOutlineRoundedIcon from '@mui/icons-material/StarOutlineRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import TelegramIcon from '@mui/icons-material/Telegram';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';

import { ChatBeamIcon } from '~/common/components/icons/ChatBeamIcon';
import { CloseableMenu } from '~/common/components/CloseableMenu';
import { DMessage, DMessageId, DMessageUserFlag, messageFragmentsReduceText, messageHasUserFlag } from '~/common/stores/chat/chat.message';
import { KeyStroke } from '~/common/components/KeyStroke';
import { adjustContentScaling, themeScalingMap, themeZIndexPageBar } from '~/common/app.theme';
import { animationColorRainbow } from '~/common/util/animUtils';
import { copyToClipboard } from '~/common/util/clipboardUtils';
import { createTextContentFragment, DMessageAttachmentFragment, DMessageContentFragment, DMessageFragment, DMessageFragmentId, isAttachmentFragment, isContentFragment, isImageRefPart } from '~/common/stores/chat/chat.fragments';
import { prettyBaseModel } from '~/common/util/modelUtils';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { ContentFragments } from './fragments-content/ContentFragments';
import { DocumentAttachmentFragments } from './fragments-attachment-doc/DocumentAttachmentFragments';
import { ImageAttachmentFragments } from './fragments-attachment-image/ImageAttachmentFragments';
import { ReplyToBubble } from './ReplyToBubble';
import { avatarIconSx, makeMessageAvatarIcon, messageAsideColumnSx, messageBackground, messageZenAsideColumnSx } from './messageUtils';
import { useChatShowTextDiff } from '../../store-app-chat';


// Enable the menu on text selection
const ENABLE_CONTEXT_MENU = false;
const ENABLE_BUBBLE = true;
const BUBBLE_MIN_TEXT_LENGTH = 3;

// Enable the hover button to copy the whole message. The Copy button is also available in Blocks, or in the Avatar Menu.
const ENABLE_COPY_MESSAGE_OVERLAY: boolean = false;


export type ChatMessageTextPartEditState = { [fragmentId: DMessageFragmentId]: string };

export const ChatMessageMemo = React.memo(ChatMessage);

/**
 * The Message component is a customizable chat message UI component that supports
 * different roles (user, assistant, and system), text editing, syntax highlighting,
 * and code execution using Sandpack for TypeScript, JavaScript, and HTML code blocks.
 * The component also provides options for copying code to clipboard and expanding
 * or collapsing long user messages.
 *
 */
export function ChatMessage(props: {
  message: DMessage,
  diffPreviousText?: string,
  fitScreen: boolean,
  isMobile?: boolean,
  isBottom?: boolean,
  isImagining?: boolean,
  isSpeaking?: boolean,
  hideAvatar?: boolean,
  showBlocksDate?: boolean,
  showUnsafeHtml?: boolean,
  adjustContentScaling?: number,
  topDecorator?: React.ReactNode,
  onMessageAssistantFrom?: (messageId: string, offset: number) => Promise<void>,
  onMessageBeam?: (messageId: string) => Promise<void>,
  onMessageBranch?: (messageId: string) => void,
  onMessageDelete?: (messageId: string) => void,
  onMessageFragmentAppend?: (messageId: DMessageId, fragment: DMessageFragment) => void
  onMessageFragmentDelete?: (messageId: DMessageId, fragmentId: DMessageFragmentId) => void,
  onMessageFragmentReplace?: (messageId: DMessageId, fragmentId: DMessageFragmentId, newFragment: DMessageFragment) => void,
  onMessageToggleUserFlag?: (messageId: string, flag: DMessageUserFlag) => void,
  onMessageTruncate?: (messageId: string) => void,
  onReplyTo?: (messageId: string, selectedText: string) => void,
  onTextDiagram?: (messageId: string, text: string) => Promise<void>,
  onTextImagine?: (text: string) => Promise<void>,
  onTextSpeak?: (text: string) => Promise<void>,
  sx?: SxProps,
}) {

  // state
  const blocksRendererRef = React.useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = React.useState(false);
  const [selText, setSelText] = React.useState<string | null>(null);
  const [bubbleAnchor, setBubbleAnchor] = React.useState<HTMLElement | null>(null);
  const [contextMenuAnchor, setContextMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [opsMenuAnchor, setOpsMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [textContentEditState, setTextContentEditState] = React.useState<ChatMessageTextPartEditState | null>(null);

  // external state
  const { isZenMode, contentScaling, doubleClickToEdit, renderMarkdown } = useUIPreferencesStore(useShallow(state => ({
    isZenMode: state.zenMode === 'cleaner',
    contentScaling: adjustContentScaling(state.contentScaling, props.adjustContentScaling),
    doubleClickToEdit: state.doubleClickToEdit,
    renderMarkdown: state.renderMarkdown,
  })));
  const [showDiff, setShowDiff] = useChatShowTextDiff();


  // derived state
  const {
    id: messageId,
    role: messageRole,
    fragments: messageFragments,
    pendingIncomplete: messagePendingIncomplete,
    avatar: messageAvatar,
    purposeId: messagePurposeId,
    originLLM: messageOriginLLM,
    metadata: messageMetadata,
    created: messageCreated,
    updated: messageUpdated,
  } = props.message;


  // split the fragments: Image Attachments are rendered as cards, Content is the body (sequence of parts), and other attachment fragments as documents
  const contentFragments: DMessageContentFragment[] = [];
  const imageAttachments: DMessageAttachmentFragment[] = [];
  const nonImageAttachments: DMessageAttachmentFragment[] = [];
  messageFragments.forEach(fragment => {
    if (isContentFragment(fragment)) contentFragments.push(fragment);
    else if (isAttachmentFragment(fragment)) {
      if (isImageRefPart(fragment.part)) imageAttachments.push(fragment);
      else nonImageAttachments.push(fragment);
    } else
      console.warn('Unexpected fragment type:', fragment.ft);
  });

  const isUserStarred = messageHasUserFlag(props.message, 'starred');

  const fromAssistant = messageRole === 'assistant';
  const fromSystem = messageRole === 'system';
  const wasEdited = !!messageUpdated;

  const textSel = selText ? selText : messageFragmentsReduceText(contentFragments);
  const isSpecialT2I = textSel.startsWith('https://images.prodia.xyz/') || textSel.startsWith('/draw ') || textSel.startsWith('/imagine ') || textSel.startsWith('/img ');
  const couldDiagram = textSel.length >= 100 && !isSpecialT2I;
  const couldImagine = textSel.length >= 3 && !isSpecialT2I;
  const couldSpeak = couldImagine;

  // TODO: fix the diffing
  // const textDiffs = useSanityTextDiffs(messageText, props.diffPreviousText, showDiff);


  const { onMessageFragmentAppend, onMessageFragmentDelete, onMessageFragmentReplace } = props;

  const handleFragmentNew = React.useCallback(() => {
    onMessageFragmentAppend?.(messageId, createTextContentFragment(''));
  }, [messageId, onMessageFragmentAppend]);

  const handleFragmentDelete = React.useCallback((fragmentId: DMessageFragmentId) => {
    onMessageFragmentDelete?.(messageId, fragmentId);
  }, [messageId, onMessageFragmentDelete]);

  const handleFragmentReplace = React.useCallback((fragmentId: DMessageFragmentId, newFragment: DMessageFragment) => {
    onMessageFragmentReplace?.(messageId, fragmentId, newFragment);
  }, [messageId, onMessageFragmentReplace]);


  // Text Editing

  const isEditingText = !!textContentEditState;

  const handleEditsApply = React.useCallback(() => {
    const state = textContentEditState || {};
    setTextContentEditState(null);
    Object.entries(state).forEach(([fragmentId, editedText]) => {
      if (editedText.length > 0)
        handleFragmentReplace(fragmentId, createTextContentFragment(editedText));
      else
        handleFragmentDelete(fragmentId);
    });
  }, [handleFragmentDelete, handleFragmentReplace, textContentEditState]);

  const handleEditsBegin = React.useCallback(() => setTextContentEditState({}), []);

  const handleEditsCancel = React.useCallback(() => setTextContentEditState(null), []);

  const handleEditSetText = React.useCallback((fragmentId: DMessageFragmentId, editedText: string) =>
    setTextContentEditState((prev): ChatMessageTextPartEditState => ({ ...prev, [fragmentId]: editedText || '' })), []);


  // Message Operations Menu

  const { onMessageToggleUserFlag } = props;

  const handleOpsMenuToggle = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault(); // added for the Right mouse click (to prevent the menu)
    setOpsMenuAnchor(anchor => anchor ? null : event.currentTarget);
  }, []);

  const handleCloseOpsMenu = React.useCallback(() => setOpsMenuAnchor(null), []);

  const handleOpsCopy = (e: React.MouseEvent) => {
    copyToClipboard(textSel, 'Text');
    e.preventDefault();
    handleCloseOpsMenu();
    closeContextMenu();
    closeBubble();
  };

  const handleOpsEditToggle = React.useCallback((e: React.MouseEvent) => {
    if (messagePendingIncomplete && !isEditingText) return; // don't allow editing while incomplete
    if (isEditingText) handleEditsCancel();
    else handleEditsBegin();
    e.preventDefault();
    handleCloseOpsMenu();
  }, [handleCloseOpsMenu, handleEditsBegin, handleEditsCancel, isEditingText, messagePendingIncomplete]);

  const handleOpsToggleStarred = React.useCallback(() => {
    onMessageToggleUserFlag?.(messageId, 'starred');
  }, [messageId, onMessageToggleUserFlag]);

  const handleOpsAssistantFrom = async (e: React.MouseEvent) => {
    e.preventDefault();
    handleCloseOpsMenu();
    await props.onMessageAssistantFrom?.(messageId, fromAssistant ? -1 : 0);
  };

  const handleOpsBeamFrom = async (e: React.MouseEvent) => {
    e.stopPropagation();
    handleCloseOpsMenu();
    await props.onMessageBeam?.(messageId);
  };

  const handleOpsBranch = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // to try to not steal the focus from the banched conversation
    props.onMessageBranch?.(messageId);
    handleCloseOpsMenu();
  };

  const handleOpsToggleShowDiff = () => setShowDiff(!showDiff);

  const handleOpsDiagram = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (props.onTextDiagram) {
      await props.onTextDiagram(messageId, textSel);
      handleCloseOpsMenu();
      closeContextMenu();
      closeBubble();
    }
  };

  const handleOpsImagine = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (props.onTextImagine) {
      await props.onTextImagine(textSel);
      handleCloseOpsMenu();
      closeContextMenu();
      closeBubble();
    }
  };

  const handleOpsReplyTo = (e: React.MouseEvent) => {
    e.preventDefault();
    if (props.onReplyTo && textSel.trim().length >= BUBBLE_MIN_TEXT_LENGTH) {
      props.onReplyTo(messageId, textSel.trim());
      handleCloseOpsMenu();
      closeContextMenu();
      closeBubble();
    }
  };

  const handleOpsSpeak = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (props.onTextSpeak) {
      await props.onTextSpeak(textSel);
      handleCloseOpsMenu();
      closeContextMenu();
      closeBubble();
    }
  };

  const handleOpsTruncate = (_e: React.MouseEvent) => {
    props.onMessageTruncate?.(messageId);
    handleCloseOpsMenu();
  };

  const handleOpsDelete = (_e: React.MouseEvent) => {
    props.onMessageDelete?.(messageId);
  };


  // Context Menu

  const removeContextAnchor = React.useCallback(() => {
    if (contextMenuAnchor) {
      try {
        document.body.removeChild(contextMenuAnchor);
      } catch (e) {
        // ignore...
      }
    }
  }, [contextMenuAnchor]);

  const openContextMenu = React.useCallback((event: MouseEvent, selectedText: string) => {
    event.stopPropagation();
    event.preventDefault();

    // remove any stray anchor
    removeContextAnchor();

    // create a temporary fixed anchor element to position the menu
    const anchorEl = document.createElement('div');
    anchorEl.style.position = 'fixed';
    anchorEl.style.left = `${event.clientX}px`;
    anchorEl.style.top = `${event.clientY}px`;
    document.body.appendChild(anchorEl);

    setContextMenuAnchor(anchorEl);
    setSelText(selectedText);
  }, [removeContextAnchor]);

  const closeContextMenu = React.useCallback(() => {
    // window.getSelection()?.removeAllRanges?.();
    removeContextAnchor();
    setContextMenuAnchor(null);
    setSelText(null);
  }, [removeContextAnchor]);

  const handleContextMenu = React.useCallback((event: MouseEvent) => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const selectedText = range.toString().trim();
      if (selectedText.length > 0)
        openContextMenu(event, selectedText);
    }
  }, [openContextMenu]);


  // Bubble

  const closeBubble = React.useCallback((anchorEl?: HTMLElement) => {
    window.getSelection()?.removeAllRanges?.();
    try {
      const anchor = anchorEl || bubbleAnchor;
      anchor && document.body.removeChild(anchor);
    } catch (e) {
      // ignore...
    }
    setBubbleAnchor(null);
    setSelText(null);
  }, [bubbleAnchor]);

  // restore blocksRendererRef
  const handleOpenBubble = React.useCallback((_event: MouseEvent) => {
    // check for selection
    const selection = window.getSelection();
    if (!selection || selection.rangeCount <= 0) return;

    // check for enought selection
    const selectionText = selection.toString().trim();
    if (selectionText.length < BUBBLE_MIN_TEXT_LENGTH) return;

    // check for the selection being inside the blocks renderer (core of the message)
    const selectionRange = selection.getRangeAt(0);
    const blocksElement = blocksRendererRef.current;
    if (!blocksElement || !blocksElement.contains(selectionRange.commonAncestorContainer)) return;

    const rangeRects = selectionRange.getClientRects();
    if (rangeRects.length <= 0) return;

    const firstRect = rangeRects[0];
    const anchorEl = document.createElement('div');
    anchorEl.style.position = 'fixed';
    anchorEl.style.left = `${firstRect.left + window.scrollX}px`;
    anchorEl.style.top = `${firstRect.top + window.scrollY}px`;
    document.body.appendChild(anchorEl);
    anchorEl.setAttribute('role', 'dialog');

    // auto-close logic on unselect
    const closeOnUnselect = () => {
      const selection = window.getSelection();
      if (!selection || selection.toString().trim() === '') {
        closeBubble(anchorEl);
        document.removeEventListener('selectionchange', closeOnUnselect);
      }
    };
    document.addEventListener('selectionchange', closeOnUnselect);

    setBubbleAnchor(anchorEl);
    setSelText(selectionText); /* TODO: operate on the underlying content, not the rendered text */
  }, [closeBubble]);


  // Blocks renderer

  const handleBlocksContextMenu = React.useCallback((event: React.MouseEvent) => {
    handleContextMenu(event.nativeEvent);
  }, [handleContextMenu]);

  const handleBlocksDoubleClick = React.useCallback((event: React.MouseEvent) => {
    doubleClickToEdit && props.onMessageFragmentReplace && handleOpsEditToggle(event);
  }, [doubleClickToEdit, handleOpsEditToggle, props.onMessageFragmentReplace]);

  const handleBlocksMouseUp = React.useCallback((event: React.MouseEvent) => {
    handleOpenBubble(event.nativeEvent);
  }, [handleOpenBubble]);


  // style
  const backgroundColor = messageBackground(messageRole, wasEdited, false /*isAssistantError && !errorMessage*/);

  // avatar
  const showAvatarIcon = !props.hideAvatar && !isZenMode;
  const avatarIconEl: React.JSX.Element | null = React.useMemo(
    () => showAvatarIcon ? makeMessageAvatarIcon(messageAvatar, messageRole, messageOriginLLM, messagePurposeId, !!messagePendingIncomplete, true) : null,
    [messageAvatar, messageOriginLLM, messagePendingIncomplete, messagePurposeId, messageRole, showAvatarIcon],
  );


  return (
    <ListItem
      role='chat-message'
      onMouseUp={(ENABLE_BUBBLE && !fromSystem /*&& !isAssistantError*/) ? handleBlocksMouseUp : undefined}
      sx={{
        // style
        backgroundColor: backgroundColor,
        px: { xs: 1, md: themeScalingMap[contentScaling]?.chatMessagePadding ?? 2 },
        py: themeScalingMap[contentScaling]?.chatMessagePadding ?? 2,
        // filter: 'url(#agi-futuristic-glow)',

        // style: omit border if set externally
        ...(!('borderBottom' in (props.sx || {})) && {
          borderBottom: '1px solid',
          borderBottomColor: 'divider',
        }),

        // style: when starred
        ...(isUserStarred && {
          outline: '3px solid',
          outlineColor: 'primary.solidBg',
          boxShadow: 'lg',
          borderRadius: 'lg',
          zIndex: 1,
        }),

        // style: make room for a top decorator if set
        '&:hover > button': { opacity: 1 },

        // layout
        display: 'block', // this is Needed, otherwise there will be a horizontal overflow

        ...props.sx,
      }}
      // className={messagePendingIncomplete ? 'agi-border-4' /* CSS Effect while in progress */ : undefined}
    >

      {/* (Optional) underlayed top decorator */}
      {props.topDecorator}

      {/* Message Row: Aside, Fragment[][], Aside2 */}
      <Box role={undefined /* aside | message | ops */} sx={{
        display: 'flex',
        flexDirection: !fromAssistant ? 'row-reverse' : 'row',
        alignItems: 'flex-start', // avatars at the top, and honor 'static' position
        gap: { xs: 0, md: 1 },
      }}>


        {/* [aside A] Fragments Edit: Apply */}
        {isEditingText && (
          <Box sx={messageAsideColumnSx}>
            {/*<Typography level='body-xs'>&nbsp;</Typography>*/}
            <Tooltip arrow disableInteractive title='Apply Edits'>
              <IconButton size='sm' variant='solid' color='warning' onClick={handleEditsApply} sx={{ mt: 0.25 }}>
                <CheckRoundedIcon />
              </IconButton>
            </Tooltip>
            <Typography level='body-xs' sx={{ overflowWrap: 'anywhere', mt: 0.25 }}>
              Done
            </Typography>
          </Box>
        )}

        {/* [aside B] Avatar (Persona) */}
        {!props.hideAvatar && !isEditingText && (
          <Box sx={isZenMode ? messageZenAsideColumnSx : messageAsideColumnSx}>

            {/* Persona Avatar or Menu Button */}
            <Box
              onClick={(event) => {
                event.shiftKey && console.log(props.message);
                handleOpsMenuToggle(event);
              }}
              onContextMenu={handleOpsMenuToggle}
              onMouseEnter={props.isMobile ? undefined : () => setIsHovering(true)}
              onMouseLeave={props.isMobile ? undefined : () => setIsHovering(false)}
              sx={{ display: 'flex' }}
            >
              {!isHovering && !opsMenuAnchor && !isZenMode ? (
                avatarIconEl
              ) : (
                <IconButton
                  size='sm'
                  variant={opsMenuAnchor ? 'solid' : (isZenMode && fromAssistant) ? 'plain' : 'soft'}
                  color={(fromAssistant || fromSystem) ? 'neutral' : 'primary'}
                  sx={avatarIconSx}
                >
                  <MoreVertIcon />
                </IconButton>
              )}
            </Box>

            {/* Assistant (llm/function) name */}
            {fromAssistant && !isZenMode && (
              <Tooltip arrow title={messagePendingIncomplete ? null : (messageOriginLLM || 'unk-model')} variant='solid'>
                <Typography level='body-xs' sx={{
                  overflowWrap: 'anywhere',
                  ...(messagePendingIncomplete ? { animation: `${animationColorRainbow} 5s linear infinite` } : {}),
                }}>
                  {prettyBaseModel(messageOriginLLM)}
                </Typography>
              </Tooltip>
            )}

          </Box>
        )}


        {/* (many-type) Fragment Classes  */}
        <Box ref={blocksRendererRef /* restricts the BUBBLE menu to the children of this */} sx={{
          // style
          flexGrow: 1,  // capture all the space, for edit modes
          minWidth: 0,  // VERY important, otherwise very wide messages will overflow the container, causing scroll on the whole page
          my: 'auto',   // v-center content if there's any gap (e.g. single line of text)

          // layout
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,     // we give a bit more space between the 'classes' of fragments (content, attachments, etc.)
        }}>

          {/* (optional) Message date */}
          {(props.showBlocksDate === true && !!(messageUpdated || messageCreated)) && (
            <Typography level='body-sm' sx={{ mx: 1.5, textAlign: fromAssistant ? 'left' : 'right' }}>
              <TimeAgo date={messageUpdated || messageCreated} />
            </Typography>
          )}

          {/* Reply-To Bubble */}
          {!!messageMetadata?.inReplyToText && (
            <ReplyToBubble
              inlineUserMessage
              replyToText={messageMetadata.inReplyToText}
              className='reply-to-bubble'
            />
          )}

          {/* Image Attachment Fragments - just for a prettier display on top of the message */}
          {imageAttachments.length >= 1 && !isEditingText && (
            <ImageAttachmentFragments
              imageAttachments={imageAttachments}
              contentScaling={contentScaling}
              messageRole={messageRole}
              isMobile={props.isMobile}
              onFragmentDelete={handleFragmentDelete}
            />
          )}

          {/* Content Fragments */}
          <ContentFragments
            fragments={contentFragments}

            contentScaling={contentScaling}
            fitScreen={props.fitScreen}
            messageOriginLLM={messageOriginLLM}
            messageRole={messageRole}
            optiAllowSubBlocksMemo={!!messagePendingIncomplete}
            renderTextAsMarkdown={renderMarkdown}
            showTopWarning={(fromSystem && wasEdited) ? 'modified by user - auto-update disabled' : undefined}
            showUnsafeHtml={props.showUnsafeHtml}

            textEditsState={textContentEditState}
            setEditedText={handleEditSetText}
            onEditsApply={handleEditsApply}
            onEditsCancel={handleEditsCancel}

            onFragmentDelete={handleFragmentDelete}
            onFragmentReplace={handleFragmentReplace}

            onContextMenu={(props.onMessageFragmentReplace && ENABLE_CONTEXT_MENU) ? handleBlocksContextMenu : undefined}
            onDoubleClick={(props.onMessageFragmentReplace && doubleClickToEdit) ? handleBlocksDoubleClick : undefined}
          />

          {/* Empty Fragments Edit: if there's no content, have a button to create a new TextContentFragment */}
          {isEditingText && !contentFragments.length && (
            <Button variant='plain' color='neutral' onClick={handleFragmentNew} sx={{ justifyContent: 'flex-start' }}>
              add text ...
            </Button>
          )}

          {/* Document Fragments */}
          {nonImageAttachments.length >= 1 && !isEditingText && (
            <DocumentAttachmentFragments
              attachmentFragments={nonImageAttachments}
              messageRole={messageRole}
              contentScaling={contentScaling}
              isMobile={props.isMobile}
              renderTextAsMarkdown={renderMarkdown}
              onFragmentDelete={handleFragmentDelete}
              onFragmentReplace={handleFragmentReplace}
            />
          )}

        </Box>

        {/* Fragments Edit: Cancel */}
        {isEditingText && (
          <Box sx={messageAsideColumnSx}>
            {/*<Typography level='body-xs'>&nbsp;</Typography>*/}
            <Tooltip arrow disableInteractive title='Discard Edits'>
              <IconButton size='md' onClick={handleEditsCancel}>
                <CloseRoundedIcon />
              </IconButton>
            </Tooltip>
            <Typography level='body-xs' sx={{ overflowWrap: 'anywhere' }}>
              Cancel
            </Typography>
          </Box>
        )}

      </Box>


      {/* Overlay copy icon */}
      {ENABLE_COPY_MESSAGE_OVERLAY && !fromSystem && !isEditingText && (
        <Tooltip title={messagePendingIncomplete ? null : (fromAssistant ? 'Copy message' : 'Copy input')} variant='solid'>
          <IconButton
            variant='outlined' onClick={handleOpsCopy}
            sx={{
              position: 'absolute', ...(fromAssistant ? { right: { xs: 12, md: 28 } } : { left: { xs: 12, md: 28 } }), zIndex: 10,
              opacity: 0, transition: 'opacity 0.3s',
            }}>
            <ContentCopyIcon />
          </IconButton>
        </Tooltip>
      )}


      {/* Message Operations Menu (3 dots) */}
      {!!opsMenuAnchor && (
        <CloseableMenu
          dense placement='bottom-end'
          open anchorEl={opsMenuAnchor} onClose={handleCloseOpsMenu}
          sx={{ minWidth: 280 }}
        >

          {fromSystem && (
            <ListItem>
              <Typography level='body-sm'>
                System message
              </Typography>
            </ListItem>
          )}

          {/* Edit / Copy */}
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {/* Edit */}
            {!!props.onMessageFragmentReplace && (
              <MenuItem variant='plain' disabled={!!messagePendingIncomplete} onClick={handleOpsEditToggle} sx={{ flex: 1 }}>
                <ListItemDecorator>{isEditingText ? <CloseRoundedIcon /> : <EditRoundedIcon />}</ListItemDecorator>
                {isEditingText ? 'Discard' : 'Edit'}
              </MenuItem>
            )}
            {/* Copy */}
            <MenuItem onClick={handleOpsCopy} sx={{ flex: 1 }}>
              <ListItemDecorator><ContentCopyIcon /></ListItemDecorator>
              Copy
            </MenuItem>
            {/* Starred */}
            {!!onMessageToggleUserFlag && (
              <MenuItem onClick={handleOpsToggleStarred} sx={{ flexGrow: 0, px: 1 }}>
                <Tooltip disableInteractive title={!isUserStarred ? 'Star message - use @ to refer to it later' : 'Unstar'}>
                  {isUserStarred
                    ? <StarRoundedIcon color='primary' sx={{ fontSize: 'xl2' }} />
                    : <StarOutlineRoundedIcon sx={{ fontSize: 'xl2' }} />
                  }
                </Tooltip>
              </MenuItem>
            )}
          </Box>
          {/* Delete / Branch / Truncate */}
          {!!props.onMessageBranch && <ListDivider />}
          {!!props.onMessageBranch && (
            <MenuItem onClick={handleOpsBranch} disabled={fromSystem}>
              <ListItemDecorator>
                <ForkRightIcon />
              </ListItemDecorator>
              Branch
              {!props.isBottom && <span style={{ opacity: 0.5 }}>from here</span>}
            </MenuItem>
          )}
          {!!props.onMessageDelete && (
            <MenuItem onClick={handleOpsDelete} disabled={false /*fromSystem*/}>
              <ListItemDecorator><DeleteOutlineIcon /></ListItemDecorator>
              Delete
              <span style={{ opacity: 0.5 }}>message</span>
            </MenuItem>
          )}
          {!!props.onMessageTruncate && (
            <MenuItem onClick={handleOpsTruncate} disabled={props.isBottom}>
              <ListItemDecorator><VerticalAlignBottomIcon /></ListItemDecorator>
              Truncate
              <span style={{ opacity: 0.5 }}>after this</span>
            </MenuItem>
          )}
          {/* Diagram / Draw / Speak */}
          {!!props.onTextDiagram && <ListDivider />}
          {!!props.onTextDiagram && (
            <MenuItem onClick={handleOpsDiagram} disabled={!couldDiagram}>
              <ListItemDecorator><AccountTreeOutlinedIcon /></ListItemDecorator>
              Auto-Diagram ...
            </MenuItem>
          )}
          {!!props.onTextImagine && (
            <MenuItem onClick={handleOpsImagine} disabled={!couldImagine || props.isImagining}>
              <ListItemDecorator>{props.isImagining ? <CircularProgress size='sm' /> : <FormatPaintOutlinedIcon />}</ListItemDecorator>
              Auto-Draw
            </MenuItem>
          )}
          {!!props.onTextSpeak && (
            <MenuItem onClick={handleOpsSpeak} disabled={!couldSpeak || props.isSpeaking}>
              <ListItemDecorator>{props.isSpeaking ? <CircularProgress size='sm' /> : <RecordVoiceOverOutlinedIcon />}</ListItemDecorator>
              Speak
            </MenuItem>
          )}
          {/* Diff Viewer */}
          {!!props.diffPreviousText && <ListDivider />}
          {!!props.diffPreviousText && (
            <MenuItem onClick={handleOpsToggleShowDiff}>
              <ListItemDecorator><DifferenceIcon /></ListItemDecorator>
              Show difference
              <Switch checked={showDiff} onChange={handleOpsToggleShowDiff} sx={{ ml: 'auto' }} />
            </MenuItem>
          )}
          {/* Beam/Restart */}
          {(!!props.onMessageAssistantFrom || !!props.onMessageBeam) && <ListDivider />}
          {!!props.onMessageAssistantFrom && (
            <MenuItem disabled={fromSystem} onClick={handleOpsAssistantFrom}>
              <ListItemDecorator>{fromAssistant ? <ReplayIcon color='primary' /> : <TelegramIcon color='primary' />}</ListItemDecorator>
              {!fromAssistant
                ? <>Restart <span style={{ opacity: 0.5 }}>from here</span></>
                : !props.isBottom
                  ? <>Retry <span style={{ opacity: 0.5 }}>from here</span></>
                  : <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'space-between', gap: 1 }}>Retry<KeyStroke combo='Ctrl + Shift + Z' /></Box>}
            </MenuItem>
          )}
          {!!props.onMessageBeam && (
            <MenuItem disabled={fromSystem} onClick={handleOpsBeamFrom}>
              <ListItemDecorator>
                <ChatBeamIcon color={fromSystem ? undefined : 'primary'} />
              </ListItemDecorator>
              {!fromAssistant
                ? <>Beam <span style={{ opacity: 0.5 }}>from here</span></>
                : !props.isBottom
                  ? <>Beam <span style={{ opacity: 0.5 }}>this message</span></>
                  : <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'space-between', gap: 1 }}>Beam<KeyStroke combo='Ctrl + Shift + B' /></Box>}
            </MenuItem>
          )}
        </CloseableMenu>
      )}


      {/* Bubble */}
      {ENABLE_BUBBLE && !!bubbleAnchor && (
        <Popper placement='top-start' open anchorEl={bubbleAnchor} slotProps={{
          root: { style: { zIndex: themeZIndexPageBar + 1 } },
        }}>
          <ClickAwayListener onClickAway={() => closeBubble()}>
            <ButtonGroup
              variant='plain'
              sx={{
                '--ButtonGroup-separatorColor': 'none !important',
                '--ButtonGroup-separatorSize': 0,
                borderRadius: '0',
                backgroundColor: 'background.popup',
                border: '1px solid',
                borderColor: 'primary.outlinedBorder',
                boxShadow: '0px 4px 12px -4px rgb(var(--joy-palette-neutral-darkChannel) / 50%)',
                mb: 1,
                ml: -1,
                alignItems: 'center',
                '& > button': {
                  '--Icon-fontSize': '1rem',
                  minHeight: '2.5rem',
                  minWidth: '2.75rem',
                },
              }}
            >
              {!!props.onReplyTo && <Tooltip disableInteractive arrow placement='top' title={fromAssistant ? 'Reply' : 'Refer To'}>
                <IconButton color='primary' onClick={handleOpsReplyTo}>
                  <ReplyRoundedIcon sx={{ fontSize: 'xl' }} />
                </IconButton>
              </Tooltip>}
              {/*{!!props.onMessageBeam && fromAssistant && <Tooltip disableInteractive arrow placement='top' title='Beam'>*/}
              {/*  <IconButton color='primary'>*/}
              {/*    <ChatBeamIcon sx={{ fontSize: 'xl' }} />*/}
              {/*  </IconButton>*/}
              {/*</Tooltip>}*/}
              {!!props.onReplyTo && fromAssistant && <MoreVertIcon sx={{ color: 'neutral.outlinedBorder', fontSize: 'md' }} />}
              <Tooltip disableInteractive arrow placement='top' title='Copy'>
                <IconButton onClick={handleOpsCopy}>
                  <ContentCopyIcon />
                </IconButton>
              </Tooltip>
              {(!!props.onTextDiagram || !!props.onTextSpeak) && <MoreVertIcon sx={{ color: 'neutral.outlinedBorder', fontSize: 'md' }} />}
              {!!props.onTextDiagram && <Tooltip disableInteractive arrow placement='top' title={couldDiagram ? 'Auto-Diagram...' : 'Too short to Auto-Diagram'}>
                <IconButton onClick={couldDiagram ? handleOpsDiagram : undefined}>
                  <AccountTreeOutlinedIcon sx={{ color: couldDiagram ? 'primary' : 'neutral.plainDisabledColor' }} />
                </IconButton>
              </Tooltip>}
              {!!props.onTextImagine && <Tooltip disableInteractive arrow placement='top' title='Auto-Draw'>
                <IconButton onClick={handleOpsImagine} disabled={!couldImagine || props.isImagining}>
                  {!props.isImagining ? <FormatPaintOutlinedIcon /> : <CircularProgress sx={{ '--CircularProgress-size': '16px' }} />}
                </IconButton>
              </Tooltip>}
              {!!props.onTextSpeak && <Tooltip disableInteractive arrow placement='top' title='Speak'>
                <IconButton onClick={handleOpsSpeak} disabled={!couldSpeak || props.isSpeaking}>
                  {!props.isSpeaking ? <RecordVoiceOverOutlinedIcon /> : <CircularProgress sx={{ '--CircularProgress-size': '16px' }} />}
                </IconButton>
              </Tooltip>}
            </ButtonGroup>
          </ClickAwayListener>
        </Popper>
      )}


      {/* Context (Right-click) Menu */}
      {!!contextMenuAnchor && (
        <CloseableMenu
          dense placement='bottom-start'
          open anchorEl={contextMenuAnchor} onClose={closeContextMenu}
          sx={{ minWidth: 220 }}
        >
          <MenuItem onClick={handleOpsCopy} sx={{ flex: 1, alignItems: 'center' }}>
            <ListItemDecorator><ContentCopyIcon /></ListItemDecorator>
            Copy
          </MenuItem>
          {!!props.onTextDiagram && <ListDivider />}
          {!!props.onTextDiagram && <MenuItem onClick={handleOpsDiagram} disabled={!couldDiagram || props.isImagining}>
            <ListItemDecorator><AccountTreeOutlinedIcon /></ListItemDecorator>
            Auto-Diagram ...
          </MenuItem>}
          {!!props.onTextImagine && <MenuItem onClick={handleOpsImagine} disabled={!couldImagine || props.isImagining}>
            <ListItemDecorator>{props.isImagining ? <CircularProgress size='sm' /> : <FormatPaintOutlinedIcon />}</ListItemDecorator>
            Auto-Draw
          </MenuItem>}
          {!!props.onTextSpeak && <MenuItem onClick={handleOpsSpeak} disabled={!couldSpeak || props.isSpeaking}>
            <ListItemDecorator>{props.isSpeaking ? <CircularProgress size='sm' /> : <RecordVoiceOverOutlinedIcon />}</ListItemDecorator>
            Speak
          </MenuItem>}
        </CloseableMenu>
      )}

    </ListItem>
  );
}
