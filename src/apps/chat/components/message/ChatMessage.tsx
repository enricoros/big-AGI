import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';
import TimeAgo from 'react-timeago';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, ButtonGroup, CircularProgress, Divider, IconButton, ListDivider, ListItem, ListItemDecorator, MenuItem, Switch, Tooltip, Typography } from '@mui/joy';
import { ClickAwayListener, Popper } from '@mui/base';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DifferenceIcon from '@mui/icons-material/Difference';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import ForkRightIcon from '@mui/icons-material/ForkRight';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatPaintOutlinedIcon from '@mui/icons-material/FormatPaintOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import RecordVoiceOverOutlinedIcon from '@mui/icons-material/RecordVoiceOverOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import ReplyAllRoundedIcon from '@mui/icons-material/ReplyAllRounded';
import ReplyRoundedIcon from '@mui/icons-material/ReplyRounded';
import StarOutlineRoundedIcon from '@mui/icons-material/StarOutlineRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import StrikethroughSIcon from '@mui/icons-material/StrikethroughS';
import TelegramIcon from '@mui/icons-material/Telegram';
import TextureIcon from '@mui/icons-material/Texture';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

import { ModelVendorAnthropic } from '~/modules/llms/vendors/anthropic/anthropic.vendor';

import { AnthropicIcon } from '~/common/components/icons/vendors/AnthropicIcon';
import { ChatBeamIcon } from '~/common/components/icons/ChatBeamIcon';
import { CloseablePopup } from '~/common/components/CloseablePopup';
import { DMessage, DMessageId, DMessageUserFlag, DMetaReferenceItem, MESSAGE_FLAG_AIX_SKIP, MESSAGE_FLAG_NOTIFY_COMPLETE, MESSAGE_FLAG_STARRED, MESSAGE_FLAG_VND_ANT_CACHE_AUTO, MESSAGE_FLAG_VND_ANT_CACHE_USER, messageFragmentsReduceText, messageHasUserFlag } from '~/common/stores/chat/chat.message';
import { KeyStroke } from '~/common/components/KeyStroke';
import { MarkHighlightIcon } from '~/common/components/icons/MarkHighlightIcon';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { adjustContentScaling, themeScalingMap, themeZIndexChatBubble } from '~/common/app.theme';
import { avatarIconSx, makeMessageAvatarIcon, messageBackground, useMessageAvatarLabel } from '~/common/util/dMessageUtils';
import { copyToClipboard } from '~/common/util/clipboardUtils';
import { createTextContentFragment, DMessageFragment, DMessageFragmentId, updateFragmentWithEditedText } from '~/common/stores/chat/chat.fragments';
import { useUIPreferencesStore } from '~/common/state/store-ui';
import { useUXLabsStore } from '~/common/state/store-ux-labs';

import { BlockOpContinue } from './BlockOpContinue';
import { ContentFragments } from './fragments-content/ContentFragments';
import { DocumentAttachmentFragments } from './fragments-attachment-doc/DocumentAttachmentFragments';
import { ImageAttachmentFragments } from './fragments-attachment-image/ImageAttachmentFragments';
import { InReferenceToList } from './in-reference-to/InReferenceToList';
import { messageAsideColumnSx, messageAvatarLabelAnimatedSx, messageAvatarLabelSx, messageZenAsideColumnSx } from './ChatMessage.styles';
import { setIsNotificationEnabledForModel, useChatShowTextDiff } from '../../store-app-chat';
import { useFragmentBuckets } from './useFragmentBuckets';
import { useSelHighlighterMemo } from './useSelHighlighterMemo';


// Enable the menu on text selection
const ENABLE_CONTEXT_MENU = false;
const ENABLE_BUBBLE = true;
export const BUBBLE_MIN_TEXT_LENGTH = 3;

// Enable the hover button to copy the whole message. The Copy button is also available in Blocks, or in the Avatar Menu.
const ENABLE_COPY_MESSAGE_OVERLAY: boolean = false;


const messageBodySx: SxProps = {
  display: 'flex',
  alignItems: 'flex-start', // avatars at the top, and honor 'static' position
  gap: { xs: 0, md: 1 },
};

const messageBodyReverseSx: SxProps = {
  ...messageBodySx,
  flexDirection: 'row-reverse',
};

export const messageSkippedSx = {
  // show a nice ghostly border (dashed?)
  border: '1px dashed',
  borderColor: 'neutral.solidBg',
  // make it look good
  filter: 'grayscale(1)',
} as const;

const personaAvatarOrMenuSx: SxProps = {
  display: 'flex',
};

const editButtonWrapSx: SxProps = {
  overflowWrap: 'anywhere',
  mb: -0.5, // this is so that the 'edit/cancel' labels won't push down the edit box when single lined
};

const fragmentsListSx: SxProps = {
  // style
  flexGrow: 1,  // capture all the space, for edit modes
  minWidth: 0,  // VERY important, otherwise very wide messages will overflow the container, causing scroll on the whole page
  my: 'auto',   // v-center content if there's any gap (e.g. single line of text)

  // layout
  display: 'flex',
  flexDirection: 'column',
  gap: 1.5,     // we give a bit more space between the 'classes' of fragments (in-reply-to, images, content, attachments, etc.)
};

const antCachePromptOffSx: SxProps = {
  transition: 'color 0.16s, transform 0.16s',
};

const antCachePromptOnSx: SxProps = {
  ...antCachePromptOffSx,
  color: ModelVendorAnthropic.brandColor,
  transform: 'rotate(90deg)',
};


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
  hasInReferenceTo?: boolean;
  isMobile: boolean,
  isBottom?: boolean,
  isImagining?: boolean,
  isSpeaking?: boolean,
  hideAvatar?: boolean,
  showAntPromptCaching?: boolean,
  showBlocksDate?: boolean,
  showUnsafeHtmlCode?: boolean,
  adjustContentScaling?: number,
  topDecorator?: React.ReactNode,
  onAddInReferenceTo?: (item: DMetaReferenceItem) => void,
  onMessageAssistantFrom?: (messageId: string, offset: number) => Promise<void>,
  onMessageBeam?: (messageId: string) => Promise<void>,
  onMessageBranch?: (messageId: string) => void,
  onMessageContinue?: (messageId: string) => void,
  onMessageDelete?: (messageId: string) => void,
  onMessageFragmentAppend?: (messageId: DMessageId, fragment: DMessageFragment) => void
  onMessageFragmentDelete?: (messageId: DMessageId, fragmentId: DMessageFragmentId) => void,
  onMessageFragmentReplace?: (messageId: DMessageId, fragmentId: DMessageFragmentId, newFragment: DMessageFragment) => void,
  onMessageToggleUserFlag?: (messageId: string, flag: DMessageUserFlag, maxPerConversation?: number) => void,
  onMessageTruncate?: (messageId: string) => void,
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
  const { adjContentScaling, disableMarkdown, doubleClickToEdit, uiComplexityMode } = useUIPreferencesStore(useShallow(state => ({
    adjContentScaling: adjustContentScaling(state.contentScaling, props.adjustContentScaling),
    disableMarkdown: state.disableMarkdown,
    doubleClickToEdit: state.doubleClickToEdit,
    uiComplexityMode: state.complexityMode,
  })));
  const labsEnhanceCodeBlocks = useUXLabsStore(state => state.labsEnhanceCodeBlocks);
  const [showDiff, setShowDiff] = useChatShowTextDiff();


  // derived state
  const {
    id: messageId,
    role: messageRole,
    fragments: messageFragments,
    pendingIncomplete: messagePendingIncomplete,
    purposeId: messagePurposeId,
    generator: messageGenerator,
    metadata: messageMetadata,
    created: messageCreated,
    updated: messageUpdated,
  } = props.message;

  const fromAssistant = messageRole === 'assistant';
  const fromSystem = messageRole === 'system';
  const fromUser = messageRole === 'user';
  const messageHasBeenEdited = !!messageUpdated;

  const isUserMessageSkipped = messageHasUserFlag(props.message, MESSAGE_FLAG_AIX_SKIP);
  const isUserStarred = messageHasUserFlag(props.message, MESSAGE_FLAG_STARRED);
  const isUserNotifyComplete = messageHasUserFlag(props.message, MESSAGE_FLAG_NOTIFY_COMPLETE);
  const isVndAndCacheAuto = !!props.showAntPromptCaching && messageHasUserFlag(props.message, MESSAGE_FLAG_VND_ANT_CACHE_AUTO);
  const isVndAndCacheUser = !!props.showAntPromptCaching && messageHasUserFlag(props.message, MESSAGE_FLAG_VND_ANT_CACHE_USER);

  const {
    imageAttachments,       // Stamp-sized Images
    contentOrVoidFragments, // Text (Markdown + Code + ... blocks), Errors, (large) Images, Placeholders
    nonImageAttachments,    // Document Attachments, likely the User dropped them in
  } = useFragmentBuckets(messageFragments);

  const fragmentFlattenedText = React.useMemo(() => messageFragmentsReduceText(messageFragments), [messageFragments]);
  const handleHighlightSelText = useSelHighlighterMemo(messageId, selText, contentOrVoidFragments, fromAssistant, props.onMessageFragmentReplace);

  const textSubject = selText ? selText : fragmentFlattenedText;
  const isSpecialT2I = textSubject.startsWith('https://images.prodia.xyz/') || textSubject.startsWith('/draw ') || textSubject.startsWith('/imagine ') || textSubject.startsWith('/img ');
  const couldDiagram = textSubject.length >= 100 && !isSpecialT2I;
  const couldImagine = textSubject.length >= 3 && !isSpecialT2I;
  const couldSpeak = couldImagine;


  // TODO: fix the diffing
  // const wordsDiff = useWordsDifference(textSubject, props.diffPreviousText, showDiff);


  const { onMessageAssistantFrom, onMessageDelete, onMessageFragmentAppend, onMessageFragmentDelete, onMessageFragmentReplace } = props;

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

  const handleApplyEdit = React.useCallback((fragmentId: DMessageFragmentId, editedText: string) => {
    // perform deletion of the fragment if the text is empty
    if (!editedText.length)
      return handleFragmentDelete(fragmentId);

    // find the fragment to be replaced
    const oldFragment = messageFragments.find(f => f.fId === fragmentId);
    if (!oldFragment) return;
    const newFragment = updateFragmentWithEditedText(oldFragment, editedText);
    if (newFragment)
      handleFragmentReplace(fragmentId, newFragment);
  }, [handleFragmentDelete, handleFragmentReplace, messageFragments]);

  const handleApplyAllEdits = React.useCallback(async (withControl: boolean) => {
    const state = textContentEditState || {};
    setTextContentEditState(null);
    for (const [fragmentId, editedText] of Object.entries(state))
      handleApplyEdit(fragmentId, editedText);
    // if the user pressed Ctrl, we begin a regeneration from here
    if (withControl && onMessageAssistantFrom)
      await onMessageAssistantFrom(messageId, 0);
  }, [handleApplyEdit, messageId, onMessageAssistantFrom, textContentEditState]);

  const handleEditsApplyClicked = React.useCallback(() => handleApplyAllEdits(false), [handleApplyAllEdits]);

  const handleEditsBegin = React.useCallback(() => setTextContentEditState({}), []);

  const handleEditsCancel = React.useCallback(() => setTextContentEditState(null), []);

  const handleEditSetText = React.useCallback((fragmentId: DMessageFragmentId, editedText: string, applyNow: boolean) => {
    if (applyNow)
      handleApplyEdit(fragmentId, editedText);
    else
      setTextContentEditState((prev): ChatMessageTextPartEditState => ({ ...prev, [fragmentId]: editedText || '' }));
  }, [handleApplyEdit]);


  // Message Operations Menu

  const { onAddInReferenceTo, onMessageToggleUserFlag } = props;

  const handleOpsMenuToggle = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault(); // added for the Right mouse click (to prevent the menu)
    setOpsMenuAnchor(anchor => anchor ? null : event.currentTarget);
  }, []);

  const handleCloseOpsMenu = React.useCallback(() => setOpsMenuAnchor(null), []);

  const handleOpsCopy = (e: React.MouseEvent) => {
    copyToClipboard(textSubject, 'Text');
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

  const handleOpsToggleAntCacheUser = React.useCallback(() => {
    onMessageToggleUserFlag?.(messageId, MESSAGE_FLAG_VND_ANT_CACHE_USER, 2);
  }, [messageId, onMessageToggleUserFlag]);

  const handleOpsToggleSkipMessage = React.useCallback(() => {
    onMessageToggleUserFlag?.(messageId, MESSAGE_FLAG_AIX_SKIP);
  }, [messageId, onMessageToggleUserFlag]);

  const handleOpsToggleStarred = React.useCallback(() => {
    onMessageToggleUserFlag?.(messageId, MESSAGE_FLAG_STARRED);
  }, [messageId, onMessageToggleUserFlag]);

  const handleOpsToggleNotifyComplete = React.useCallback(() => {
    // also remember the preference, for auto-setting flags by the persona
    setIsNotificationEnabledForModel(messageId, !isUserNotifyComplete);
    onMessageToggleUserFlag?.(messageId, MESSAGE_FLAG_NOTIFY_COMPLETE);
  }, [isUserNotifyComplete, messageId, onMessageToggleUserFlag]);

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
    e.stopPropagation(); // to try to not steal the focus from the branched conversation
    props.onMessageBranch?.(messageId);
    handleCloseOpsMenu();
  };

  const handleOpsToggleShowDiff = () => setShowDiff(!showDiff);

  const handleOpsDiagram = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (props.onTextDiagram) {
      await props.onTextDiagram(messageId, textSubject.trim());
      handleCloseOpsMenu();
      closeContextMenu();
      closeBubble();
    }
  };

  const handleOpsImagine = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (props.onTextImagine) {
      await props.onTextImagine(textSubject.trim());
      handleCloseOpsMenu();
      closeContextMenu();
      closeBubble();
    }
  };

  const handleOpsAddInReferenceTo = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onAddInReferenceTo && textSubject.trim().length >= BUBBLE_MIN_TEXT_LENGTH) {
      onAddInReferenceTo({ mrt: 'dmsg', mText: textSubject.trim(), mRole: messageRole /*, messageId*/ });
      handleCloseOpsMenu();
      closeContextMenu();
      closeBubble();
    }
  };

  const handleOpsSpeak = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (props.onTextSpeak) {
      await props.onTextSpeak(textSubject.trim());
      handleCloseOpsMenu();
      closeContextMenu();
      closeBubble();
    }
  };

  const handleOpsTruncate = (_e: React.MouseEvent) => {
    props.onMessageTruncate?.(messageId);
    handleCloseOpsMenu();
  };

  const handleOpsDelete = React.useCallback(() => {
    onMessageDelete?.(messageId);
  }, [messageId, onMessageDelete]);


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

    // check for enough selection
    const selectionText = selection.toString();
    if (selectionText.trim().length < BUBBLE_MIN_TEXT_LENGTH) return;

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
    if ((doubleClickToEdit || event.shiftKey) && props.onMessageFragmentReplace)
      handleOpsEditToggle(event);
  }, [doubleClickToEdit, handleOpsEditToggle, props.onMessageFragmentReplace]);

  const handleBlocksMouseUp = React.useCallback((event: React.MouseEvent) => {
    handleOpenBubble(event.nativeEvent);
  }, [handleOpenBubble]);


  // style
  const backgroundColor = messageBackground(messageRole, messageHasBeenEdited, false /*isAssistantError && !errorMessage*/);

  const listItemSx: SxProps = React.useMemo(() => ({
    // vars
    '--AGI-overlay-start-opacity': uiComplexityMode === 'extra' ? 0.1 : 0,

    // style
    backgroundColor: backgroundColor,
    px: { xs: 1, md: themeScalingMap[adjContentScaling]?.chatMessagePadding ?? 2 },
    py: themeScalingMap[adjContentScaling]?.chatMessagePadding ?? 2,
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

    // style: when has a user/automatic breakpoint
    ...(isVndAndCacheUser && {
      borderInlineStart: `0.125rem solid ${ModelVendorAnthropic.brandColor}`,
      // borderTopLeftRadius: '0.375rem',
      // borderBottomLeftRadius: '0.375rem',
    }),
    ...(uiComplexityMode === 'extra' && isVndAndCacheAuto && !isVndAndCacheUser && {
      position: 'relative',
      '&::before': {
        content: '""',
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: '0.125rem',
        background: `repeating-linear-gradient( -45deg, transparent, transparent 2px, ${ModelVendorAnthropic.brandColor} 2px, ${ModelVendorAnthropic.brandColor} 12px ) repeat`,
      },
    }),
    // style: when the user skips the message
    ...(isUserMessageSkipped && messageSkippedSx),

    // style: when the message is being edited
    ...(isEditingText && {
      zIndex: 1, // this is to make the whole message appear on top of Beam Scatter > RayControlsMemo
    }),

    // for: ENABLE_COPY_MESSAGE_OVERLAY
    // '&:hover > button': { opacity: 1 },

    // layout
    display: 'block', // this is Needed, otherwise there will be a horizontal overflow

    ...props.sx,
  }), [adjContentScaling, backgroundColor, isEditingText, isUserMessageSkipped, isUserStarred, isVndAndCacheAuto, isVndAndCacheUser, props.sx, uiComplexityMode]);


  // avatar icon & label & tooltip

  const zenMode = uiComplexityMode === 'minimal';

  const showAvatarIcon = !props.hideAvatar && !zenMode;
  const messageGeneratorName = messageGenerator?.name;
  const messageAvatarIcon = React.useMemo(
    () => !showAvatarIcon ? null : makeMessageAvatarIcon(uiComplexityMode, messageRole, messageGeneratorName, messagePurposeId, !!messagePendingIncomplete, isUserMessageSkipped, isUserNotifyComplete, true),
    [isUserMessageSkipped, isUserNotifyComplete, messageGeneratorName, messagePendingIncomplete, messagePurposeId, messageRole, showAvatarIcon, uiComplexityMode],
  );

  const { label: messageAvatarLabel, tooltip: messageAvatarTooltip } = useMessageAvatarLabel(props.message, uiComplexityMode);


  return (
    <Box
      component='li'
      role='chat-message'
      tabIndex={-1 /* for shortcuts navigation */}
      onMouseUp={(ENABLE_BUBBLE && !fromSystem /*&& !isAssistantError*/) ? handleBlocksMouseUp : undefined}
      sx={listItemSx}
      // className={messagePendingIncomplete ? 'agi-border-4' /* CSS Effect while in progress */ : undefined}
    >

      {/* (Optional) top decorator */}
      {props.topDecorator}


      {/* Message Row: Aside, Fragment[][], Aside2 */}
      <Box
        role={undefined /* aside | message | ops */}
        sx={(fromAssistant && !isEditingText) ? messageBodySx : messageBodyReverseSx}
      >

        {/* [start-Avatar] Avatar (Persona) */}
        {!props.hideAvatar && !isEditingText && (
          <Box sx={zenMode ? messageZenAsideColumnSx : messageAsideColumnSx}>

            {/* Persona Avatar or Menu Button */}
            <Box
              onClick={(event) => {
                // [DEBUG][PROD] shift+click to dump the DMessage
                event.shiftKey && console.log('message', props.message);
                handleOpsMenuToggle(event);
              }}
              onContextMenu={handleOpsMenuToggle}
              onMouseEnter={props.isMobile ? undefined : () => setIsHovering(true)}
              onMouseLeave={props.isMobile ? undefined : () => setIsHovering(false)}
              sx={personaAvatarOrMenuSx}
            >
              {showAvatarIcon && !isHovering && !opsMenuAnchor ? (
                messageAvatarIcon
              ) : (
                <IconButton
                  size='sm'
                  variant={opsMenuAnchor ? 'solid' : (zenMode && fromAssistant) ? 'plain' : 'soft'}
                  color={(fromAssistant || fromSystem) ? 'neutral' : 'primary'}
                  sx={avatarIconSx}
                >
                  <MoreVertIcon />
                </IconButton>
              )}
            </Box>

            {/* Assistant (llm/function) name */}
            {fromAssistant && !zenMode && (
              <TooltipOutlined asLargePane enableInteractive title={messageAvatarTooltip} placement='bottom-start'>
                <Typography level='body-xs' sx={messagePendingIncomplete ? messageAvatarLabelAnimatedSx : messageAvatarLabelSx}>
                  {messageAvatarLabel}
                </Typography>
              </TooltipOutlined>
            )}

          </Box>
        )}

        {/* [start-Edit] Fragments Edit: Apply */}
        {isEditingText && (
          <Box sx={messageAsideColumnSx} className='msg-edit-button'>
            <Tooltip arrow disableInteractive title='Apply Edits'>
              <IconButton size='sm' variant='solid' color='warning' onClick={handleEditsApplyClicked}>
                <CheckRoundedIcon />
              </IconButton>
            </Tooltip>
            <Typography level='body-xs' sx={editButtonWrapSx}>
              Done
            </Typography>
          </Box>
        )}


        {/* V-Fragments: Image Attachments | Content | Doc Attachments */}
        <Box ref={blocksRendererRef /* restricts the BUBBLE menu to the children of this */} sx={fragmentsListSx}>

          {/* (optional) Message date */}
          {(props.showBlocksDate === true && !!(messageUpdated || messageCreated)) && (
            <Typography level='body-sm' sx={{ mx: 1.5, textAlign: fromAssistant ? 'left' : 'right' }}>
              <TimeAgo date={messageUpdated || messageCreated} />
            </Typography>
          )}

          {/* (special case) System modified warning */}
          {fromSystem && messageHasBeenEdited && (
            <Typography level='body-sm' color='warning' sx={{ mt: 1, mx: 1.5, textAlign: 'end' }}>
              modified by user - auto-update disabled
            </Typography>
          )}

          {/* In-Reference-To Bubble */}
          {!!messageMetadata?.inReferenceTo?.length && (
            <InReferenceToList items={messageMetadata.inReferenceTo} />
          )}

          {/* Image Attachment Fragments - just for a prettier display on top of the message */}
          {imageAttachments.length >= 1 && (
            <ImageAttachmentFragments
              imageAttachments={imageAttachments}
              contentScaling={adjContentScaling}
              messageRole={messageRole}
              disabled={isEditingText}
              onFragmentDelete={handleFragmentDelete}
            />
          )}

          {/* Content Fragments */}
          <ContentFragments
            fragments={contentOrVoidFragments}
            showEmptyNotice={!messageFragments.length && !messagePendingIncomplete}

            contentScaling={adjContentScaling}
            uiComplexityMode={uiComplexityMode}
            fitScreen={props.fitScreen}
            isMobile={props.isMobile}
            messageRole={messageRole}
            optiAllowSubBlocksMemo={!!messagePendingIncomplete}
            disableMarkdownText={disableMarkdown || fromUser /* User messages are edited as text. Try to have them in plain text. NOTE: This may bite. */}
            showUnsafeHtmlCode={props.showUnsafeHtmlCode}
            enhanceCodeBlocks={labsEnhanceCodeBlocks}

            textEditsState={textContentEditState}
            setEditedText={(!props.onMessageFragmentReplace || messagePendingIncomplete) ? undefined : handleEditSetText}
            onEditsApply={handleApplyAllEdits}
            onEditsCancel={handleEditsCancel}

            onFragmentBlank={handleFragmentNew}
            onFragmentDelete={handleFragmentDelete}
            onFragmentReplace={handleFragmentReplace}
            onMessageDelete={props.onMessageDelete ? handleOpsDelete : undefined}

            onContextMenu={(props.onMessageFragmentReplace && ENABLE_CONTEXT_MENU) ? handleBlocksContextMenu : undefined}
            onDoubleClick={(props.onMessageFragmentReplace /*&& doubleClickToEdit disabled, as we may have shift too */) ? handleBlocksDoubleClick : undefined}
          />

          {/* Document Fragments */}
          {nonImageAttachments.length >= 1 && (
            <DocumentAttachmentFragments
              attachmentFragments={nonImageAttachments}
              messageRole={messageRole}
              contentScaling={adjContentScaling}
              isMobile={props.isMobile}
              zenMode={zenMode}
              allowSelection={!isEditingText}
              disableMarkdownText={disableMarkdown}
              onFragmentDelete={handleFragmentDelete}
              onFragmentReplace={handleFragmentReplace}
            />
          )}

          {/* Continue... */}
          {props.isBottom && messageGenerator?.tokenStopReason === 'out-of-tokens' && !!props.onMessageContinue && (
            <BlockOpContinue
              contentScaling={adjContentScaling}
              messageId={messageId}
              messageRole={messageRole}
              onContinue={props.onMessageContinue}
            />
          )}

        </Box>


        {/* [end-Edit] Fragments Edit: Cancel */}
        {isEditingText && (
          <Box sx={messageAsideColumnSx} className='msg-edit-button'>
            <Tooltip arrow disableInteractive title='Discard Edits'>
              <IconButton size='sm' variant='solid' onClick={handleEditsCancel}>
                <CloseRoundedIcon />
              </IconButton>
            </Tooltip>
            <Typography level='body-xs' sx={editButtonWrapSx}>
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
              opacity: 0, transition: 'opacity 0.16s cubic-bezier(.17,.84,.44,1)',
            }}>
            <ContentCopyIcon />
          </IconButton>
        </Tooltip>
      )}


      {/* Message Operations Menu (3 dots) */}
      {!!opsMenuAnchor && (
        <CloseablePopup
          menu anchorEl={opsMenuAnchor} onClose={handleCloseOpsMenu}
          dense
          minWidth={280}
          placement={fromAssistant ? 'auto-start' : 'auto-end'}
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

          {/* Notify Complete */}
          {messagePendingIncomplete && !!onMessageToggleUserFlag && <ListDivider />}
          {messagePendingIncomplete && !!onMessageToggleUserFlag && (
            <MenuItem onClick={handleOpsToggleNotifyComplete}>
              <ListItemDecorator>{isUserNotifyComplete ? <NotificationsActiveIcon /> : <NotificationsOutlinedIcon />}</ListItemDecorator>
              Notify on reply
            </MenuItem>
          )}

          {/* Anthropic Breakpoint Toggle */}
          {!messagePendingIncomplete && <ListDivider />}
          {!messagePendingIncomplete && !isUserMessageSkipped && !!props.showAntPromptCaching && (
            <MenuItem onClick={handleOpsToggleAntCacheUser}>
              <ListItemDecorator><AnthropicIcon sx={isVndAndCacheUser ? antCachePromptOnSx : antCachePromptOffSx} /></ListItemDecorator>
              {isVndAndCacheUser ? 'Do not cache' : <>Cache <span style={{ opacity: 0.5 }}>up to here</span></>}
            </MenuItem>
          )}
          {!messagePendingIncomplete && !isUserMessageSkipped && !!props.showAntPromptCaching && isVndAndCacheAuto && !isVndAndCacheUser && (
            <MenuItem disabled>
              <ListItemDecorator><TextureIcon sx={{ color: ModelVendorAnthropic.brandColor }} /></ListItemDecorator>
              Auto-Cached <span style={{ opacity: 0.5 }}>for 5 min</span>
            </MenuItem>
          )}
          {/* Aix Skip Message */}
          {!messagePendingIncomplete && (
            <MenuItem onClick={handleOpsToggleSkipMessage}>
              <ListItemDecorator>{isUserMessageSkipped ? <VisibilityOffIcon sx={{ color: 'danger.plainColor' }} /> : <VisibilityIcon />}</ListItemDecorator>
              {isUserMessageSkipped ? 'Unskip' : 'Skip AI processing'}
            </MenuItem>
          )}

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
                  : <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'space-between', gap: 1 }}>Retry<KeyStroke variant='outlined' combo='Ctrl + Shift + Z' /></Box>}
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
                  ? <>Beam Edit</>
                  : <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'space-between', gap: 1 }}>Beam Edit<KeyStroke variant='outlined' combo='Ctrl + Shift + B' /></Box>}
            </MenuItem>
          )}
        </CloseablePopup>
      )}


      {/* Bubble Over Toolbar */}
      {ENABLE_BUBBLE && !!bubbleAnchor && (
        <Popper placement='top-start' open={true} anchorEl={bubbleAnchor} slotProps={{
          root: { style: { zIndex: themeZIndexChatBubble } },
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
                boxShadow: '0px 4px 24px -8px rgb(var(--joy-palette-neutral-darkChannel) / 50%)',
                mb: 1.5,
                ml: -1.5,
                alignItems: 'center',
                '& > button': {
                  '--Icon-fontSize': 'var(--joy-fontSize-lg, 1.125rem)',
                  minHeight: '2.5rem',
                  minWidth: '2.75rem',
                },
              }}
            >
              {/* Bubble Add Reference */}
              {!!onAddInReferenceTo && <Tooltip disableInteractive arrow placement='top' title={props.hasInReferenceTo ? 'Reply to this too' : fromAssistant ? 'Reply' : 'Refer To'}>
                <IconButton color='primary' onClick={handleOpsAddInReferenceTo}>
                  {props.hasInReferenceTo ? <ReplyAllRoundedIcon sx={{ fontSize: 'xl' }} /> : <ReplyRoundedIcon sx={{ fontSize: 'xl' }} />}
                </IconButton>
              </Tooltip>}
              {/*{!!props.onMessageBeam && fromAssistant && <Tooltip disableInteractive arrow placement='top' title='Beam'>*/}
              {/*  <IconButton color='primary'>*/}
              {/*    <ChatBeamIcon sx={{ fontSize: 'xl' }} />*/}
              {/*  </IconButton>*/}
              {/*</Tooltip>}*/}
              {!!onAddInReferenceTo && <Divider />}

              {/* Text Tools (edits fragment, only for assistant messages) */}
              {fromAssistant && <Tooltip disableInteractive arrow placement='top' title='Highlight Text'>
                <IconButton disabled={!handleHighlightSelText} onClick={!handleHighlightSelText ? undefined : () => {
                  handleHighlightSelText('highlight');
                  closeBubble();
                }}>
                  <MarkHighlightIcon hcolor={handleHighlightSelText ? 'yellow' : undefined} />
                </IconButton>
              </Tooltip>}
              {fromAssistant && <Tooltip disableInteractive arrow placement='top' title='Strike Through'>
                <IconButton disabled={!handleHighlightSelText} onClick={!handleHighlightSelText ? undefined : () => {
                  handleHighlightSelText('strike');
                  closeBubble();
                }}>
                  <StrikethroughSIcon />
                </IconButton>
              </Tooltip>}
              {fromAssistant && <Tooltip disableInteractive arrow placement='top' title='Toggle Bold'>
                <IconButton disabled={!handleHighlightSelText} onClick={!handleHighlightSelText ? undefined : () => {
                  handleHighlightSelText('strong');
                  closeBubble();
                }}>
                  <FormatBoldIcon />
                </IconButton>
              </Tooltip>}
              {fromAssistant && <Divider />}

              {/* Intelligent functions */}
              {!!props.onTextDiagram && <Tooltip disableInteractive arrow placement='top' title={couldDiagram ? 'Auto-Diagram...' : 'Too short to Auto-Diagram'}>
                <IconButton color='success' onClick={couldDiagram ? handleOpsDiagram : undefined}>
                  <AccountTreeOutlinedIcon sx={{ color: couldDiagram ? 'primary' : 'neutral.plainDisabledColor' }} />
                </IconButton>
              </Tooltip>}
              {!!props.onTextImagine && <Tooltip disableInteractive arrow placement='top' title='Auto-Draw'>
                <IconButton color='success' onClick={handleOpsImagine} disabled={!couldImagine || props.isImagining}>
                  {!props.isImagining ? <FormatPaintOutlinedIcon /> : <CircularProgress sx={{ '--CircularProgress-size': '16px' }} />}
                </IconButton>
              </Tooltip>}
              {!!props.onTextSpeak && <Tooltip disableInteractive arrow placement='top' title='Speak'>
                <IconButton color='success' onClick={handleOpsSpeak} disabled={!couldSpeak || props.isSpeaking}>
                  {!props.isSpeaking ? <RecordVoiceOverOutlinedIcon /> : <CircularProgress sx={{ '--CircularProgress-size': '16px' }} />}
                </IconButton>
              </Tooltip>}
              {(!!props.onTextDiagram || !!props.onTextImagine || !!props.onTextSpeak) && <Divider />}

              {/* Bubble Copy */}
              <Tooltip disableInteractive arrow placement='top' title='Copy Selection'>
                <IconButton onClick={handleOpsCopy}>
                  <ContentCopyIcon />
                </IconButton>
              </Tooltip>

            </ButtonGroup>
          </ClickAwayListener>
        </Popper>
      )}


      {/* Context (Right-click) Menu */}
      {!!contextMenuAnchor && (
        <CloseablePopup
          menu anchorEl={contextMenuAnchor} onClose={closeContextMenu}
          dense
          minWidth={220}
          placement='bottom-start'
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
        </CloseablePopup>
      )}

    </Box>
  );
}
