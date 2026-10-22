import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { shallow } from 'zustand/vanilla/shallow';
import TimeAgo from 'react-timeago';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, IconButton, Tooltip, Typography } from '@mui/joy';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import MoreVertIcon from '@mui/icons-material/MoreVert';

import type { AixReattachMode } from '~/modules/aix/client/aix.client';
import type { AutoBlocksHtmlRenderVariant } from '~/modules/blocks/AutoBlocksRenderer';
import { ModelVendorAnthropic } from '~/modules/llms/vendors/anthropic/anthropic.vendor';
import { useERCDiffActions } from '~/modules/blocks/enhanced-code/ERCDiffContext';
import { vertexLinksCountInFragments, vertexLinksResolveFragments } from '~/modules/google/vertexai.client';

import { DMessage, DMessageGenerator, DMessageId, DMessageUserFlag, DMetaReferenceItem, MESSAGE_FLAG_AIX_SKIP, MESSAGE_FLAG_NOTIFY_COMPLETE, MESSAGE_FLAG_STARRED, MESSAGE_FLAG_VND_ANT_CACHE_AUTO, MESSAGE_FLAG_VND_ANT_CACHE_USER, messageFragmentsInFluxId, messageFragmentsReduceText, messageHasUserFlag, messageWasOutOfTokens } from '~/common/stores/chat/chat.message';
import { Release } from '~/common/app.release';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { adjustContentScaling, themeScalingMap } from '~/common/app.theme';
import { avatarIconSx, makeMessageAvatarIcon, messageBackground, useMessageAvatarLabel } from '~/common/util/dMessageUtils';
import { clipboardCopyDOMSelectionOrFallback, copyToClipboard } from '~/common/util/clipboardUtils';
import { createTextContentFragment, DMessageFragment, DMessageFragmentId, isContentFragment, isTextContentFragment, reorderFragmentsInSlots, updateFragmentWithEditedText } from '~/common/stores/chat/chat.fragments';
import { findFirstUserPromptFragment } from '~/common/stores/chat/chat.fragment-order';
import { useUIPreferencesStore } from '~/common/stores/store-ui';
import { useUXLabsStore } from '~/common/stores/store-ux-labs';

import { BlockOpContinue } from './BlockOpContinue';
import { BlockOpOptions } from './BlockOpOptions';
import { BlockOpResolveLinks } from './BlockOpResolveLinks';
import { BlockOpUpstreamResume } from './BlockOpUpstreamResume';
import { ChatMessageBubble } from './ChatMessageBubble';
import { ChatMessageEditAttachments } from './ChatMessageEditAttachments';
import { ChatMessageInfoPopup } from './ChatMessageInfoPopup';
import { ChatMessageMenu } from './ChatMessageMenu';
import { ChatMessageTimestamp } from './ChatMessageTimestamp';
import type { CMBuildOptions } from './render-tree/cmRenderTree.build';
import { CMRenderTreeNodes } from './render-tree/CMRenderTreeNodes';
import { InReferenceToList } from './in-reference-to/InReferenceToList';
import { useCMRenderTree } from './render-tree/useCMRenderTree';
import { useCMEditSession, useCMHostFragmentCalls } from './useCMEditSession';
import { messageAsideColumnSx, messageAvatarLabelAnimatedSx, messageAvatarLabelSx, messageEditBeamControlsTopSx, messageMobileHeaderSx, messageZenAsideColumnSx } from './ChatMessage.styles';
import { useSelHighlighterMemo } from './useSelHighlighterMemo';


// Enable the menu on text selection
const ENABLE_BUBBLE = true;
export const BUBBLE_MIN_TEXT_LENGTH = 3;

// Enable the hover button to copy the whole message. The Copy button is also available in Blocks, or in the Avatar Menu.
// const ENABLE_COPY_MESSAGE_OVERLAY: boolean = false;


export const messageSkippedSx = {
  // show a nice ghostly border (dashed?)
  border: '1px dashed',
  borderColor: 'neutral.solidBg',
  // make it look good
  filter: 'grayscale(1)',
} as const;

// Message component styles
const _styles = {
  // Message body layouts
  msgBody: {
    display: 'flex',
    alignItems: 'flex-start', // avatars at the top, and honor 'static' position
    gap: { xs: 0, md: 1 },
  },
  msgBodyReverse: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: { xs: 0, md: 1 },
    flexDirection: 'row-reverse',
  },
  msgBodyMobile: {
    display: 'flex',
  },
  // Mobile toolbar (header)
  mtIcon: {
    '--AGI-Avatar-size': '28px',
    width: 28,
    height: 28,
    flexShrink: 0,
  },
  mtLabel: {
    flex: 1,
  },
  mtLabelGenerating: {
    flex: 1,
    ...messageAvatarLabelAnimatedSx,
  },
  mtSpacer: {
    flex: 1,
  },
  mtTime: {
    color: 'text.tertiary',
    mr: 0.5,
    flexShrink: 0,
    opacity: 0.5,
  },
  mtButton: {
    flexShrink: 0,
  },
  // Avatar/menu button (pure CSS hover system)
  iconContainer: {
    display: 'flex',
    position: 'relative',
    // Hide avatar on hover/focus-within, show button
    '&:hover .avatar-icon, &:focus-within .avatar-icon': {
      opacity: 0,
    },
    '&:hover .menu-button, &:focus-within .menu-button': {
      opacity: 1,
    },
  },
  iconAvatarVisible: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    opacity: 1,
  },
  iconAvatarHidden: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    opacity: 0,
  },
  iconButtonVisible: {
    ...avatarIconSx,
    opacity: 1,
  },
  iconButtonHidden: {
    ...avatarIconSx,
    opacity: 0,
  },
} as const satisfies Record<string, SxProps>;

export const messageBodyReverseSx = _styles.msgBodyReverse;

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


export interface ChatMessageFunctionsHandle {
  beginEditTextContent: () => void;
}

export type ChatMessageTextPartEditState = { [fragmentId: DMessageFragmentId]: string };

// CSS owns hover/focus; this named boundary makes the memo visible in React Profiler.
const CMDesktopAvatar = React.memo(function CMDesktopAvatar(props: {
  icon: React.ReactNode,
  label: React.ReactNode,
  tooltip: React.ReactNode,
  zenMode: boolean,
  pending: boolean,
  menuOpen: boolean,
  menuColor: React.ComponentProps<typeof IconButton>['color'],
  onClick: (event: React.MouseEvent<HTMLElement>) => void,
  onContextMenu: (event: React.MouseEvent<HTMLElement>) => void,
}) {
  return (
    <Box sx={props.zenMode ? messageZenAsideColumnSx : messageAsideColumnSx}>

      {/* Persona Avatar or Menu Button */}
      <Box sx={_styles.iconContainer}>
        {/* Avatar Icon - shown by default */}
        {props.icon != null && (
          <Box
            className='avatar-icon'
            onClick={props.onClick}
            onContextMenu={props.onContextMenu}
            sx={props.menuOpen ? _styles.iconAvatarHidden : _styles.iconAvatarVisible}
          >
            {props.icon}
          </Box>
        )}

        {/* Menu Button - hidden by default, shown on hover/focus */}
        <IconButton
          className='menu-button'
          size='sm'
          variant={props.menuOpen ? 'solid' : props.zenMode ? 'plain' : 'soft'}
          color={props.menuColor}
          onClick={props.onClick}
          onContextMenu={props.onContextMenu}
          sx={(props.menuOpen || props.icon == null) ? _styles.iconButtonVisible : _styles.iconButtonHidden}
        >
          <MoreVertIcon />
        </IconButton>
      </Box>

      {/* Assistant (llm/function) name */}
      {props.label != null && (
        <TooltipOutlined asLargePane enableInteractive title={props.tooltip} placement='bottom-start'>
          <Typography level='body-xs' sx={(props.pending && !Release.Features.LIGHTER_ANIMATIONS) ? messageAvatarLabelAnimatedSx : messageAvatarLabelSx}>
            {props.label}
          </Typography>
        </TooltipOutlined>
      )}

    </Box>
  );
});


const CMMobileHeader = React.memo(function CMMobileHeader(props: {
  icon: React.ReactNode,
  label: React.ReactNode,
  timestamp: number | null,
  pending: boolean,
  showSpacer: boolean,
  backgroundColor: string,
  menuVariant: React.ComponentProps<typeof IconButton>['variant'],
  menuColor: React.ComponentProps<typeof IconButton>['color'],
  onHeaderClick: (event: React.MouseEvent<HTMLElement>) => void,
  onClick: (event: React.MouseEvent<HTMLElement>) => void,
  onContextMenu: (event: React.MouseEvent<HTMLElement>) => void,
  onEditApply: (() => void) | undefined,
  editApplyDisabled: boolean,
  onEditCancel: () => void,
}) {
  return (
    <Box bgcolor={props.backgroundColor} onClick={props.onHeaderClick} sx={messageMobileHeaderSx}>

      {/* Avatar (assistant/system) */}
      {props.icon != null && (
        <Box sx={_styles.mtIcon}>
          {props.icon}
        </Box>
      )}

      {/* Model name / label */}
      {props.label != null && (
        <Typography level='body-xs' className='agi-ellipsize' sx={(props.pending && !Release.Features.LIGHTER_ANIMATIONS) ? _styles.mtLabelGenerating : _styles.mtLabel}>
          {props.label}
        </Typography>
      )}

      {/* Spacer */}
      {props.showSpacer && <Box sx={_styles.mtSpacer} />}

      {/* TimeAgo for user messages (right-aligned) */}
      {props.timestamp && (
        <Typography level='body-xs' sx={_styles.mtTime}>
          <TimeAgo date={props.timestamp} />
        </Typography>
      )}

      {/* Edit buttons (when editing) */}
      {props.onEditApply && <>
        <Button size='sm' color='neutral' variant='plain' onClick={props.onEditCancel} startDecorator={<CloseRoundedIcon />} sx={_styles.mtButton}>
          Cancel
        </Button>
        <Button size='sm' color='warning' disabled={props.editApplyDisabled} onClick={props.onEditApply} startDecorator={<CheckRoundedIcon />} sx={_styles.mtButton} style={{ minWidth: 100 }}>
          Done
        </Button>
      </>}

      {/* Menu button (always visible on mobile) */}
      {!props.onEditApply && (
        <IconButton
          // size='sm'
          variant={props.menuVariant}
          color={props.menuColor}
          onClick={props.onClick}
          onContextMenu={props.onContextMenu}
          sx={_styles.mtButton}
        >
          <MoreVertIcon sx={{ fontSize: 'xl' }} />
        </IconButton>
      )}
    </Box>
  );
});


export const ChatMessageMemo = React.memo(ChatMessage);

/**
 * For the chat list: memoized while complete, re-rendered every chunk while pending, and one component
 * type at every position, so completion never remounts the message. Not for hosts whose messages stay pending.
 */
export const ChatMessageStreamingMemo = React.memo(ChatMessage, (prev, next) =>
  // prev too: a completion that clears the flag on the same object leaves the props shallow-equal, and must still render once
  !prev.message.pendingIncomplete && !next.message.pendingIncomplete && shallow(prev, next),
);

/**
 * The Message component is a customizable chat message UI component that supports
 * different roles (user, assistant, and system), text editing, syntax highlighting,
 * and code execution using Sandpack for TypeScript, JavaScript, and HTML code blocks.
 * The component also provides options for copying code to clipboard and expanding
 * or collapsing long user messages.
 *
 */
export function ChatMessage(props: {
  actionsRef?: React.Ref<ChatMessageFunctionsHandle>,
  message: DMessage,
  // diffPreviousText?: string, // DISABLE: unused, was the text from the former messages to delta between them
  fitScreen: boolean,
  hasInReferenceTo?: boolean;
  isMobile: boolean,
  isBottom?: boolean,
  isImagining?: boolean,
  isSpeaking?: boolean,
  hideAvatar?: boolean,
  blocksStretch?: boolean, // overrides 'messageFullWidth'
  showTimestamp?: boolean,
  showAntPromptCaching?: boolean,
  showBlocksDate?: boolean,
  htmlRenderVariant?: AutoBlocksHtmlRenderVariant,
  adjustContentScaling?: number,
  topDecorator?: React.ReactNode,
  onAddInReferenceTo?: (item: DMetaReferenceItem) => void,
  onMessageAssistantFrom?: (messageId: string, offset: number) => Promise<void>,
  onMessageBeam?: (messageId: string) => Promise<void>,
  onMessageBranch?: (messageId: string) => void,
  onMessageContinue?: (messageId: string, continueText: null | string) => void,
  onMessageUpstreamResume?: (generator: DMessageGenerator, messageId: string, mode: AixReattachMode) => Promise<void>,
  onMessageUpstreamDetach?: (messageId: string) => void,
  onMessageUpstreamDelete?: (generator: DMessageGenerator, messageId: string) => Promise<void>,
  upstreamResumeMode?: AixReattachMode, // set by parent while a resume is in flight on this message
  onMessageDelete?: (messageId: string) => void,
  onMessageFragmentsReplace?: (messageId: DMessageId, fragments: DMessageFragment[]) => void, // the one write, per edit or single operation; without it the message is read-only
  onMessageToggleUserFlag?: (messageId: string, flag: DMessageUserFlag, maxPerConversation?: number) => void,
  onMessageTruncate?: (messageId: string) => void,
  onReattachAsFile?: (file: File) => void,
  onTextDiagram?: (messageId: string, text: string) => Promise<void>,
  onTextImagine?: (text: string) => Promise<void>,
  onTextSpeak?: (text: string) => Promise<void>,
  sx?: SxProps,
}) {

  // state
  const blocksRendererRef = React.useRef<HTMLDivElement>(null);
  const [selText, setSelText] = React.useState<string | null>(null);
  const [bubbleAnchor, setBubbleAnchor] = React.useState<HTMLElement | null>(null);
  const [opsMenuAnchor, setOpsMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [showInfoModal, setShowInfoModal] = React.useState(false);
  const [userMarkdownFlipped, setUserMarkdownFlipped] = React.useState(false); // 'View as text/markdown', this message only, not saved

  // latest-message ref: lets stable callbacks read the current message without putting it in deps
  const messageRef = React.useRef(props.message);
  messageRef.current = props.message;

  // external state
  const { adjContentScaling, devsUISymbolHighlight, disableMarkdown, doubleClickToEdit, messageFullWidth, uiComplexityMode } = useUIPreferencesStore(useShallow(state => ({
    adjContentScaling: adjustContentScaling(state.contentScaling, props.adjustContentScaling),
    devsUISymbolHighlight: state.devsUISymbolHighlight,
    disableMarkdown: state.disableMarkdown,
    doubleClickToEdit: state.doubleClickToEdit,
    messageFullWidth: state.messageFullWidth,
    uiComplexityMode: state.complexityMode,
  })));
  const _setContextHighlightText = useERCDiffActions()?.setContextHighlightText;
  const setContextHighlightText = devsUISymbolHighlight ? _setContextHighlightText : undefined;
  const { labsUngroupedFragments, labsUserMarkdown } = useUXLabsStore(useShallow(state => ({
    labsUngroupedFragments: state.labsUngroupedFragments,
    labsUserMarkdown: state.labsUserMarkdown,
  })));


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
  const userMarkdown = labsUserMarkdown !== userMarkdownFlipped;
  const messageHasBeenEdited = !!messageUpdated;
  const msgGenOutOfTokens = messageWasOutOfTokens(messageGenerator);

  const isUserMessageSkipped = messageHasUserFlag(props.message, MESSAGE_FLAG_AIX_SKIP);
  const isUserStarred = messageHasUserFlag(props.message, MESSAGE_FLAG_STARRED);
  const isUserNotifyComplete = messageHasUserFlag(props.message, MESSAGE_FLAG_NOTIFY_COMPLETE);
  const isVndAndCacheAuto = !!props.showAntPromptCaching && messageHasUserFlag(props.message, MESSAGE_FLAG_VND_ANT_CACHE_AUTO);
  const isVndAndCacheUser = !!props.showAntPromptCaching && messageHasUserFlag(props.message, MESSAGE_FLAG_VND_ANT_CACHE_USER);

  // Text editing state (handlers below): a working copy of the fragments, shown by the render tree in edit mode
  const { onMessageFragmentsReplace } = props;
  const { onMessageFragmentDelete, onMessageFragmentReplace } = useCMHostFragmentCalls(messageRef, onMessageFragmentsReplace);
  const { editable: editableFragments, editedFragmentIds, drafts: editDrafts, draftsBusy, update: editFragments, apply: editApply, begin: handleEditsBegin, cancel: handleEditsCancel } =
    useCMEditSession(messageId, messageFragments, !!messagePendingIncomplete, onMessageFragmentsReplace);
  const isEditingText = !!editableFragments;
  const canEditText = !!onMessageFragmentsReplace && !messagePendingIncomplete;

  // Options interceptor: a trailing option list on the last text block becomes continuation buttons
  const lookForOptions = props.onMessageContinue !== undefined && props.isBottom === true && !msgGenOutOfTokens && fromAssistant && !messagePendingIncomplete && !isEditingText && uiComplexityMode !== 'minimal' && false;

  // Render tree: fragments grouped into nodes in message order, citations first; stable across streaming appends
  const renderTreeOptions = React.useMemo((): CMBuildOptions => ({ trailingOptions: lookForOptions, ungrouped: labsUngroupedFragments }), [labsUngroupedFragments, lookForOptions]);
  const renderTree = useCMRenderTree(editableFragments ?? messageFragments, isEditingText && canEditText ? 'edit' : 'view', renderTreeOptions);
  const { trailingOptions } = renderTree;

  // Activity follows the raw stream order, independent of display filtering and injected layout.
  const inFluxFragmentId = React.useMemo(() => messageFragmentsInFluxId(messageFragments, !!messagePendingIncomplete), [messageFragments, messagePendingIncomplete]);

  const fragmentFlattenedText = React.useMemo(() => messageFragmentsReduceText(messageFragments), [messageFragments]);
  const userPromptText = React.useMemo(() => findFirstUserPromptFragment(messageFragments)?.part.text ?? '', [messageFragments]);
  const contentFragments = React.useMemo(() => messageFragments.filter(isContentFragment), [messageFragments]);
  const handleHighlightSelText = useSelHighlighterMemo(messageId, selText, contentFragments, fromAssistant, onMessageFragmentReplace);

  // [#1114] Vertex AI grounding redirect links present in this message (skip the scan while streaming - the button is gated on completion anyway)
  const vertexLinksCount = React.useMemo(() => {
    return fromAssistant && !messagePendingIncomplete ? vertexLinksCountInFragments(messageFragments) : 0;
  }, [fromAssistant, messagePendingIncomplete, messageFragments]);

  const textSubject = selText ? selText : fragmentFlattenedText;
  const t2iSubject = selText ?? userPromptText;
  const isSpecialT2I = t2iSubject.startsWith('/draw ') || t2iSubject.startsWith('/imagine ') || t2iSubject.startsWith('/img ');
  const couldDiagram = textSubject.length >= 100 && !isSpecialT2I;
  const couldImagine = textSubject.length >= 3 && !isSpecialT2I;
  const couldSpeak = couldImagine;

  const userCommandApprox = !fromUser ? false
    : userPromptText.startsWith('/draw ') ? 'draw'
      : userPromptText.startsWith('/react ') ? 'react'
        : false;


  // TODO: fix the diffing
  // const wordsDiff = useWordsDifference(textSubject, props.diffPreviousText, showDiff);


  const { onMessageAssistantFrom, onMessageDelete, onMessageContinue, onMessageToggleUserFlag, onMessageUpstreamResume, onMessageUpstreamDetach, onMessageUpstreamDelete } = props;

  const handleFragmentNew = React.useCallback(() => {
    editFragments(fragments => [...fragments, createTextContentFragment('')]);
  }, [editFragments]);

  const handleFragmentDelete = React.useCallback((fragmentId: DMessageFragmentId) => {
    if (isEditingText) editFragments(fragments => fragments.filter(fragment => fragment.fId !== fragmentId));
    else onMessageFragmentDelete?.(messageId, fragmentId);
  }, [editFragments, isEditingText, messageId, onMessageFragmentDelete]);

  const handleFragmentReplace = React.useCallback((fragmentId: DMessageFragmentId, newFragment: DMessageFragment) => {
    if (isEditingText) editFragments(fragments => fragments.map(fragment => fragment.fId !== fragmentId ? fragment : newFragment.fId === fragmentId ? newFragment : { ...newFragment, fId: fragmentId }));
    else onMessageFragmentReplace?.(messageId, fragmentId, newFragment);
  }, [editFragments, isEditingText, messageId, onMessageFragmentReplace]);

  const handleFragmentsReorder = React.useCallback((reorderedIds: DMessageFragmentId[]) => {
    editFragments(fragments => reorderFragmentsInSlots(fragments, reorderedIds));
  }, [editFragments]);

  const handleResolveVertexLinks = React.useCallback(async () => {
    const outcome = await vertexLinksResolveFragments(messageFragments);
    switch (outcome.status) {
      case 'resolved':
        for (const { fragmentId, newFragment } of outcome.resolution.changedFragments)
          onMessageFragmentReplace?.(messageId, fragmentId, newFragment);
        return undefined; // success
      case 'unresolved':
        return 'Links may have expired'; // aged out (no retry hint - retrying won't help)
      case 'failed':
        return 'Could not resolve - retry'; // transient: network/timeout
      case 'none':
        return undefined; // nothing to resolve (button shouldn't be showing)
    }
  }, [messageFragments, messageId, onMessageFragmentReplace]);

  const handleMessageContinue = React.useCallback((continueText: null | string) => {
    onMessageContinue?.(messageId, continueText);
  }, [messageId, onMessageContinue]);

  const handleUpstreamResume = React.useCallback((mode: AixReattachMode) => {
    if (!messageGenerator) return;
    return onMessageUpstreamResume?.(messageGenerator, messageId, mode);
  }, [messageGenerator, messageId, onMessageUpstreamResume]);

  const handleUpstreamDetach = React.useCallback(() => {
    onMessageUpstreamDetach?.(messageId);
  }, [messageId, onMessageUpstreamDetach]);

  const handleUpstreamDelete = React.useCallback(() => {
    if (!messageGenerator) return;
    return onMessageUpstreamDelete?.(messageGenerator, messageId);
  }, [messageGenerator, messageId, onMessageUpstreamDelete]);

  const handleMessageDelete = React.useCallback(() => {
    onMessageDelete?.(messageId);
  }, [messageId, onMessageDelete]);

  const handleMessageUserFlagToggle = React.useCallback((flag: DMessageUserFlag, maxPerConversation?: number) => {
    onMessageToggleUserFlag?.(messageId, flag, maxPerConversation);
  }, [messageId, onMessageToggleUserFlag]);


  // Text Editing

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
    // 1. store the edited copy, new attachments taken in; edit mode stays while attachments convert
    if (!await editApply())
      return;

    // 2. if the user pressed Ctrl, we begin a regeneration from here
    if (withControl && onMessageAssistantFrom)
      await onMessageAssistantFrom(messageId, 0);
  }, [editApply, messageId, onMessageAssistantFrom]);

  const handleEditsApplyClicked = React.useCallback(() => handleApplyAllEdits(false), [handleApplyAllEdits]);

  const handleEditSetText = React.useCallback((fragmentId: DMessageFragmentId, editedText: string, applyNow: boolean) => {
    if (applyNow)
      handleApplyEdit(fragmentId, editedText);
    else
      editFragments(fragments => fragments.map(fragment => fragment.fId !== fragmentId ? fragment : updateFragmentWithEditedText(fragment, editedText) ?? fragment));
  }, [editFragments, handleApplyEdit]);


  /// Bubble ///

  const closeBubble = React.useCallback((anchorEl?: HTMLElement, options?: { clearSelection?: boolean }) => {
    // NOTE - we used to have this always on, which would remove the highlighted text, but it's fired too much and in particular
    // it was corrupting the extension of text selection (http://github.com/enricoros/big-AGI/issues/788)
    //
    // However the likely expected user behavior here is to keep the selection, hence by default we don't clear it
    if (options?.clearSelection)
      window.getSelection()?.removeAllRanges?.();
    try {
      const anchor = anchorEl || bubbleAnchor;
      anchor && document.body.removeChild(anchor);
    } catch (e) {
      // ignore...
    }
    setBubbleAnchor(null);
    setSelText(null);
    setContextHighlightText?.(null);
  }, [bubbleAnchor, setContextHighlightText]);

  // restore blocksRendererRef
  const handleOpenBubble = React.useCallback((_event?: MouseEvent | null) => {
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
    anchorEl.style.top = !props.isMobile ? `${firstRect.top + window.scrollY}px` : `${firstRect.top + window.scrollY - 45}px`;
    if (props.isMobile)
      anchorEl.style.zIndex = '99999';  // Higher z-index to compete with native UI

    document.body.appendChild(anchorEl);
    anchorEl.setAttribute('role', 'dialog');

    // auto-close logic on unselect
    const closeOnUnselect = () => {
      const selection = window.getSelection();
      if (!selection || selection.toString().trim() === '') {
        closeBubble(anchorEl, { clearSelection: false });
        document.removeEventListener('selectionchange', closeOnUnselect);
      }
    };
    document.addEventListener('selectionchange', closeOnUnselect);

    setBubbleAnchor(anchorEl);
    setSelText(selectionText); /* TODO: operate on the underlying content, not the rendered text */
    setContextHighlightText?.(selectionText);
  }, [closeBubble, props.isMobile, setContextHighlightText]);

  const handleBubbleClickAway = React.useCallback((event?: MouseEvent | TouchEvent /* DOM, not React */) => {
    if (!event?.shiftKey)
      closeBubble();
  }, [closeBubble]);


  /// Message Menu (3 dots) ///

  const {
    onMessageBeam, onMessageBranch, onMessageTruncate, onAddInReferenceTo,
    onTextDiagram, onTextImagine, onTextSpeak,
  } = props;

  const handleOpsMenuToggle = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault(); // added for the Right mouse click (to prevent the menu)
    !!event.currentTarget && setOpsMenuAnchor(event.currentTarget);
  }, []);

  const handleOpsMenuClose = React.useCallback(() => setOpsMenuAnchor(null), []);

  const handleAvatarClick = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    // [DEBUG][PROD] shift+click to dump the DMessage
    event.shiftKey && console.log('message', messageRef.current); // [DEV-PRINT]
    handleOpsMenuToggle(event);
  }, [handleOpsMenuToggle]);

  // Mobile: tap the sticky header (avatar/label area) to scroll message top into view
  const handleMobileHeaderTap = React.useCallback((event: React.MouseEvent) => {
    // [DEBUG][PROD] shift+click to dump the DMessage (parity with desktop handleAvatarClick)
    event.shiftKey && console.log('message', messageRef.current); // [DEV-PRINT]
    // Don't interfere with buttons (menu, edit) - only handle taps on the header background, avatar, or label
    if ((event.target as HTMLElement).closest('button')) return;
    const messageEl = (event.currentTarget as HTMLElement).closest('[role="chat-message"]');
    messageEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleOpsShowInfo = React.useCallback(() => {
    setOpsMenuAnchor(null);
    setShowInfoModal(true);
  }, []);

  const handleInfoClose = React.useCallback(() => setShowInfoModal(false), []);

  const handleOpsAssistantFrom = React.useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    if (onMessageAssistantFrom) {
      handleOpsMenuClose();
      await onMessageAssistantFrom(messageId, fromAssistant ? -1 : 0);
    }
  }, [fromAssistant, handleOpsMenuClose, messageId, onMessageAssistantFrom]);

  const handleOpsBeamFrom = React.useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    if (onMessageBeam) {
      handleOpsMenuClose();
      await onMessageBeam(messageId);
    }
  }, [handleOpsMenuClose, messageId, onMessageBeam]);

  const handleOpsBranchFrom = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (onMessageBranch) {
      e.stopPropagation(); // to try to not steal the focus from the branched conversation
      onMessageBranch(messageId);
      handleOpsMenuClose();
    }
  }, [handleOpsMenuClose, messageId, onMessageBranch]);

  const handleOpsMessageCopySrc = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    // copy full source text (ops menu) - bypasses DOM, always gets pre-collapsed content
    copyToClipboard(fragmentFlattenedText, 'Message');
    handleOpsMenuClose();
  }, [fragmentFlattenedText, handleOpsMenuClose]);

  const handleBubbleCopyDOM = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    // copy cleaned DOM selection (bubble) - rich text for pasting into Google Docs, etc.
    clipboardCopyDOMSelectionOrFallback(blocksRendererRef.current, textSubject, 'Selection');
    handleOpsMenuClose();
    closeBubble();
  }, [closeBubble, handleOpsMenuClose, textSubject]);

  const handleOpsMessageEditToggle = React.useCallback((e: React.MouseEvent) => {
    if (messagePendingIncomplete && !isEditingText) return; // don't allow editing while incomplete
    if (isEditingText) handleEditsCancel();
    else handleEditsBegin();
    e.preventDefault();
    handleOpsMenuClose();
  }, [handleOpsMenuClose, handleEditsBegin, handleEditsCancel, isEditingText, messagePendingIncomplete]);

  const handleOpsMessageViewToggle = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setUserMarkdownFlipped(flipped => !flipped);
    handleOpsMenuClose();
  }, [handleOpsMenuClose]);

  const handleOpsMessageTruncate = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onMessageTruncate?.(messageId);
    handleOpsMenuClose();
  }, [handleOpsMenuClose, messageId, onMessageTruncate]);

  const handleOpsTextDiagram = React.useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    if (onTextDiagram) {
      await onTextDiagram(messageId, textSubject.trim());
      handleOpsMenuClose();
      closeBubble();
    }
  }, [closeBubble, handleOpsMenuClose, messageId, onTextDiagram, textSubject]);

  const handleOpsTextImagine = React.useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    if (onTextImagine) {
      await onTextImagine(textSubject.trim());
      handleOpsMenuClose();
      closeBubble();
    }
  }, [closeBubble, handleOpsMenuClose, onTextImagine, textSubject]);

  const handleOpsTextSpeak = React.useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    if (onTextSpeak) {
      await onTextSpeak(textSubject.trim());
      handleOpsMenuClose();
      closeBubble();
    }
  }, [closeBubble, handleOpsMenuClose, onTextSpeak, textSubject]);


  const handleOpsAddInReferenceTo = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (onAddInReferenceTo && textSubject.trim().length >= BUBBLE_MIN_TEXT_LENGTH) {
      onAddInReferenceTo({ mrt: 'dmsg', mText: textSubject.trim(), mRole: messageRole /*, messageId*/ });
      handleOpsMenuClose();
      closeBubble();
    }
  }, [closeBubble, handleOpsMenuClose, messageRole, onAddInReferenceTo, textSubject]);


  // Expose actions handle for parent components
  React.useImperativeHandle(props.actionsRef, () => ({
    beginEditTextContent: () => {
      if (!isEditingText && onMessageFragmentsReplace && !messagePendingIncomplete)
        handleEditsBegin();
    },
  }), [handleEditsBegin, isEditingText, messagePendingIncomplete, onMessageFragmentsReplace]);


  // Blocks renderer

  const handleBlocksDoubleClick = React.useCallback((event: React.MouseEvent) => {
    if ((doubleClickToEdit || event.shiftKey) && onMessageFragmentsReplace)
      handleOpsMessageEditToggle(event);
  }, [doubleClickToEdit, handleOpsMessageEditToggle, onMessageFragmentsReplace]);

  const handleBlocksMouseUp = React.useCallback((event: React.MouseEvent) => {
    // https://github.com/enricoros/big-AGI/issues/788
    // If shift is pressed, it's a selection extension attempt. Let the browser handle it.
    if (event.shiftKey)
      return;
    handleOpenBubble(event.nativeEvent);
  }, [handleOpenBubble]);

  const handleBlocksTouchEnd = React.useCallback((event: React.TouchEvent) => {
    if (event.shiftKey) return; // just to match the flow

    // on mobile, allow for text-selection events to process, then open
    setTimeout(() => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length >= BUBBLE_MIN_TEXT_LENGTH)
        handleOpenBubble(null);
    }, 300);
  }, [handleOpenBubble]);


  const handleRenderedTextEdit = React.useCallback((fragmentId: DMessageFragmentId, editedText: string, applyNow: boolean) => {
    // Restore hidden options before saving or checking for deletion. Full-text editing is untrimmed.
    const sourceText = applyNow && trailingOptions?.fragmentId === fragmentId ? editedText + trailingOptions.suffix : editedText;
    handleEditSetText(fragmentId, sourceText, applyNow);
  }, [handleEditSetText, trailingOptions]);


  // style
  const backgroundColor = messageBackground(messageRole, userCommandApprox, messageHasBeenEdited, false /*isAssistantError && !errorMessage*/, msgGenOutOfTokens);

  const listItemSx: SxProps = React.useMemo(() => ({
    // vars
    // '--AGI-overlay-start-opacity': uiComplexityMode === 'extra' ? 0.1 : 0, // disabled - looks worse

    // style
    backgroundColor: backgroundColor,
    px: { xs: 1, md: themeScalingMap[adjContentScaling]?.chatMessagePadding ?? 2 },
    py: themeScalingMap[adjContentScaling]?.chatMessagePadding ?? 2,
    // filter: 'url(#agi-futuristic-glow)',

    // style: omit border if set externally
    ...(!('borderBottom' in (props.sx || {})) && !props.isBottom && {
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
  }), [adjContentScaling, backgroundColor, isEditingText, isUserMessageSkipped, isUserStarred, isVndAndCacheAuto, isVndAndCacheUser, props.isBottom, props.sx, uiComplexityMode]);


  // avatar icon & label & tooltip

  const zenMode = uiComplexityMode === 'minimal';

  const showAvatarIcon = !props.hideAvatar && !zenMode;
  const messageGeneratorName = messageGenerator?.name;
  const messageAvatarIcon = React.useMemo(
    () => !showAvatarIcon ? null : makeMessageAvatarIcon(uiComplexityMode, messageRole, messageGeneratorName, messagePurposeId, !!messagePendingIncomplete, isUserMessageSkipped, isUserNotifyComplete, true),
    [isUserMessageSkipped, isUserNotifyComplete, messageGeneratorName, messagePendingIncomplete, messagePurposeId, messageRole, showAvatarIcon, uiComplexityMode],
  );

  const { label: messageAvatarLabel, tooltip: messageAvatarTooltip } = useMessageAvatarLabel(props.message, uiComplexityMode);
  const avatarMenuColor = (fromAssistant || fromSystem || zenMode) ? 'neutral' : userCommandApprox === 'draw' ? 'warning' : userCommandApprox === 'react' ? 'success' : 'primary';

  return (
    <Box
      component='li'
      role='chat-message'
      tabIndex={-1 /* for shortcuts navigation */}
      onMouseUp={(ENABLE_BUBBLE && !fromSystem /*&& !isAssistantError*/) ? handleBlocksMouseUp : undefined}
      onTouchEnd={(ENABLE_BUBBLE && !fromSystem /*&& !isAssistantError*/) ? handleBlocksTouchEnd : undefined}
      sx={listItemSx}
      // className={messagePendingIncomplete ? 'agi-border-4' /* CSS Effect while in progress */ : undefined}
    >

      {/* (Optional) top decorator */}
      {props.topDecorator}


      {/* Mobile: Compact sticky header (tap avatar/label area to scroll message into view) */}
      {props.isMobile && !props.hideAvatar && (
        <CMMobileHeader
          icon={fromUser ? null : messageAvatarIcon}
          label={fromAssistant && !zenMode ? messageAvatarLabel : null}
          timestamp={fromUser ? messageUpdated || messageCreated : null}
          pending={!!messagePendingIncomplete}
          showSpacer={fromUser || fromSystem}
          backgroundColor={backgroundColor}
          menuVariant={opsMenuAnchor ? 'solid' : (zenMode || fromAssistant || fromSystem) ? 'plain' : 'soft'}
          menuColor={avatarMenuColor}
          onHeaderClick={handleMobileHeaderTap}
          onClick={handleAvatarClick}
          onContextMenu={handleOpsMenuToggle}
          onEditApply={isEditingText ? handleEditsApplyClicked : undefined}
          editApplyDisabled={draftsBusy}
          onEditCancel={handleEditsCancel}
        />
      )}

      {/* Mobile: Edit controls when header is hidden (e.g., Beam mode) */}
      {props.isMobile && !!props.hideAvatar && isEditingText && (
        <Box bgcolor={backgroundColor} sx={messageEditBeamControlsTopSx}>
          <Button size='sm' color='neutral' variant='plain' onClick={handleEditsCancel} startDecorator={<CloseRoundedIcon />} sx={_styles.mtButton}>
            Cancel
          </Button>
          <Button size='sm' color='warning' disabled={draftsBusy} onClick={handleEditsApplyClicked} startDecorator={<CheckRoundedIcon />} sx={_styles.mtButton} style={{ minWidth: 100 }}>
            Done
          </Button>
        </Box>
      )}

      {/* Message Row: Aside, Fragment[][], Aside2 (Desktop) or Full-width (Mobile) */}
      <Box
        role={undefined /* aside | message | ops */}
        sx={props.isMobile ? _styles.msgBodyMobile : ((fromAssistant && !isEditingText) ? _styles.msgBody : _styles.msgBodyReverse)}
      >

        {/* [start-Avatar] Avatar (Persona) - Desktop only */}
        {!props.isMobile && !props.hideAvatar && !isEditingText && (
          <CMDesktopAvatar
            icon={messageAvatarIcon}
            label={fromAssistant && !zenMode ? messageAvatarLabel : null}
            tooltip={messageAvatarTooltip}
            zenMode={zenMode}
            pending={!!messagePendingIncomplete}
            menuOpen={!!opsMenuAnchor}
            menuColor={avatarMenuColor}
            onClick={handleAvatarClick}
            onContextMenu={handleOpsMenuToggle}
          />
        )}

        {/* [start-Edit] Fragments Edit: Apply - Desktop only */}
        {!props.isMobile && isEditingText && (
          <Box sx={messageAsideColumnSx} className='msg-edit-button'>
            <Tooltip arrow disableInteractive placement='top-end' title='Apply Text Edits'>
              <IconButton size='sm' variant='solid' color='warning' disabled={draftsBusy} onClick={handleEditsApplyClicked}>
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

          {/* Render tree: citations first, then content and attachments in message order */}
          <CMRenderTreeNodes
            tree={renderTree}
            inFluxFragmentId={inFluxFragmentId}
            showEmptyNotice={!messageFragments.length && !messagePendingIncomplete}
            showAddText={isEditingText && !!onMessageFragmentsReplace && !editableFragments?.some(isTextContentFragment)}

            contentScaling={adjContentScaling}
            uiComplexityMode={uiComplexityMode}
            blocksStretch={props.blocksStretch ?? messageFullWidth}
            fitScreen={props.fitScreen}
            isMobile={props.isMobile}
            messageRole={messageRole}
            messageGeneratorLlmId={messageGenerator?.mgt === 'aix' ? messageGenerator.aix?.mId : undefined}
            messagePendingIncomplete={messagePendingIncomplete}
            disableMarkdownText={disableMarkdown || (fromUser && !userMarkdown) /* user messages: plain text, unless Labs or this message's menu says markdown */}
            disableMarkdownDocuments={disableMarkdown}
            htmlRenderVariant={props.htmlRenderVariant}

            editedFragmentIds={editedFragmentIds}
            setEditedText={canEditText ? handleRenderedTextEdit : undefined}
            onEditsApply={handleApplyAllEdits}
            onEditsCancel={handleEditsCancel}

            onFragmentAddBlank={!onMessageFragmentsReplace ? undefined : handleFragmentNew}
            onFragmentDelete={!onMessageFragmentsReplace ? undefined : handleFragmentDelete}
            onFragmentReplace={!onMessageFragmentsReplace ? undefined : handleFragmentReplace}
            onFragmentsReorder={!onMessageFragmentsReplace ? undefined : handleFragmentsReorder}
            onMessageDelete={!onMessageDelete ? undefined : handleMessageDelete}

            onDoubleClick={(onMessageFragmentsReplace /*&& doubleClickToEdit disabled, as we may have shift too */) ? handleBlocksDoubleClick : undefined}
            onReattachAsFile={props.onReattachAsFile}
          />

          {/* [#1114] Resolve Vertex AI grounding redirect links in place */}
          {vertexLinksCount >= 1 && !messagePendingIncomplete && !isEditingText && !!onMessageFragmentsReplace && (
            <BlockOpResolveLinks
              contentScaling={adjContentScaling}
              linksCount={vertexLinksCount}
              onResolve={handleResolveVertexLinks}
            />
          )}

          {/* [Edit Mode] Add new attachments */}
          {!!editDrafts && !fromAssistant && !!onMessageFragmentsReplace && (
            <ChatMessageEditAttachments
              attachmentDraftsStoreApi={editDrafts}
              isMobile={props.isMobile}
            />
          )}

          {/* Continue... */}
          {props.isBottom && fromAssistant && msgGenOutOfTokens && !!onMessageContinue && (
            <BlockOpContinue
              contentScaling={adjContentScaling}
              messageRole={messageRole}
              onContinue={handleMessageContinue}
            />
          )}

          {/* Upstream Resume - shows whenever there's a stored handle (incl. post-reload, and while streaming so Stop can cancel the upstream run) */}
          {props.isBottom && fromAssistant && messageGenerator?.upstreamHandle && (!!onMessageUpstreamResume || !!onMessageUpstreamDelete) && (
            <BlockOpUpstreamResume
              upstreamHandle={messageGenerator.upstreamHandle}
              pending={messagePendingIncomplete}
              inFlightMode={props.upstreamResumeMode}
              onResume={onMessageUpstreamResume ? handleUpstreamResume : undefined}
              onDetach={onMessageUpstreamDetach ? handleUpstreamDetach : undefined}
              onDelete={onMessageUpstreamDelete ? handleUpstreamDelete : undefined}
            />
          )}

          {/* Continue Options... */}
          {!!trailingOptions && !!onMessageContinue && (
            <BlockOpOptions
              contentScaling={adjContentScaling}
              options={trailingOptions.options}
              onContinue={handleMessageContinue}
            />
          )}

          {props.showTimestamp && !zenMode && !isEditingText && (
            <ChatMessageTimestamp message={props.message} onShowInfo={handleOpsShowInfo} />
          )}

          {/* Char & Word count */}
          {/*{!zenMode && !isEditingText && !messagePendingIncomplete && fragmentFlattenedText.length > 0 && (*/}
          {/*  <Typography level='body-xs' sx={{ mx: 1.5, mt: 0.5, textAlign: fromAssistant ? 'left' : 'right', opacity: 0.5 }}>*/}
          {/*    {fragmentFlattenedText.length.toLocaleString()} chars · {(fragmentFlattenedText.match(/\S+/g) || []).length.toLocaleString()} words*/}
          {/*  </Typography>*/}
          {/*)}*/}

        </Box>


        {/* [end-Edit] Fragments Edit: Cancel - Desktop only */}
        {!props.isMobile && isEditingText && (
          <Box sx={messageAsideColumnSx} className='msg-edit-button'>
            <Tooltip arrow disableInteractive placement='top-start' title='Discard Edits'>
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
      {/*{ENABLE_COPY_MESSAGE_OVERLAY && !fromSystem && !isEditingText && (*/}
      {/*  <Tooltip title={messagePendingIncomplete ? null : (fromAssistant ? 'Copy message' : 'Copy input')} variant='solid'>*/}
      {/*    <IconButton*/}
      {/*      variant='outlined' onClick={handleOpsMessageCopySrc}*/}
      {/*      sx={{*/}
      {/*        position: 'absolute', ...(fromAssistant ? { right: { xs: 12, md: 28 } } : { left: { xs: 12, md: 28 } }), zIndex: 10,*/}
      {/*        opacity: 0, transition: 'opacity 0.16s cubic-bezier(.17,.84,.44,1)',*/}
      {/*      }}>*/}
      {/*      <ContentCopyIcon />*/}
      {/*    </IconButton>*/}
      {/*  </Tooltip>*/}
      {/*)}*/}


      {/* Message Operations Menu (3 dots) */}
      {!!opsMenuAnchor && (
        <ChatMessageMenu
          anchor={opsMenuAnchor}
          onClose={handleOpsMenuClose}

          isMobile={props.isMobile}
          isBottom={!!props.isBottom}
          fromAssistant={fromAssistant}
          fromSystem={fromSystem}
          canTextDiagram={couldDiagram}
          canTextImagine={couldImagine}
          canTextSpeak={couldSpeak}
          isEditingText={isEditingText}
          isPendingIncomplete={!!messagePendingIncomplete}
          isTextImagining={!!props.isImagining}
          isUserMessageSkipped={isUserMessageSkipped}
          isUserNotifyComplete={isUserNotifyComplete}
          userNotifyCompleteLlmId={(messageGenerator?.mgt === 'aix' ? messageGenerator.aix?.mId : undefined) ?? null}
          isUserStarred={isUserStarred}
          isViewMarkdown={userMarkdown}
          isVndAndCacheAuto={isVndAndCacheAuto}
          isVndAndCacheUser={isVndAndCacheUser}
          showVndAntCaching={uiComplexityMode === 'extra' && !!props.showAntPromptCaching && !isUserMessageSkipped}

          onMessageDelete={!onMessageDelete ? undefined : handleMessageDelete}
          onMessageUserFlagToggle={!onMessageToggleUserFlag ? undefined : handleMessageUserFlagToggle}
          onOpsAssistantFrom={!onMessageAssistantFrom ? undefined : handleOpsAssistantFrom}
          onOpsBeamFrom={!onMessageBeam ? undefined : handleOpsBeamFrom}
          onOpsBranchFrom={!onMessageBranch ? undefined : handleOpsBranchFrom}
          onOpsMessageCopySrc={handleOpsMessageCopySrc}
          onOpsMessageEditToggle={!onMessageFragmentsReplace ? undefined : handleOpsMessageEditToggle}
          onOpsMessageTruncate={!onMessageTruncate ? undefined : handleOpsMessageTruncate}
          onOpsMessageViewToggle={!fromUser ? undefined : handleOpsMessageViewToggle}
          onOpsShowInfo={handleOpsShowInfo}
          onOpsTextDiagram={!onTextDiagram ? undefined : handleOpsTextDiagram}
          onOpsTextImagine={!onTextImagine ? undefined : handleOpsTextImagine}
          onOpsTextSpeak={!onTextSpeak ? undefined : handleOpsTextSpeak}
        />
      )}


      {/* Bubble Over Toolbar */}
      {ENABLE_BUBBLE && !!bubbleAnchor && (
        <ChatMessageBubble
          anchorEl={bubbleAnchor}
          onClose={handleBubbleClickAway}
          selText={selText}
          fromAssistant={fromAssistant}
          hasInReferenceTo={!!props.hasInReferenceTo /* 1+ */}
          onReferenceTo={!onAddInReferenceTo ? undefined : handleOpsAddInReferenceTo}
          onHighlight={handleHighlightSelText}
          onImagine={!onTextImagine ? undefined : handleOpsTextImagine}
          onSpeak={!onTextSpeak ? undefined : handleOpsTextSpeak}
          onDiagram={!onTextDiagram ? undefined : handleOpsTextDiagram}
          isImagining={!!props.isImagining}
          isSpeaking={props.isSpeaking}
          couldImagine={couldImagine}
          couldSpeak={couldSpeak}
          couldDiagram={couldDiagram}
          onCopy={handleBubbleCopyDOM}
        />
      )}


      {/* Message Info Modal */}
      {showInfoModal && (
        <ChatMessageInfoPopup
          open
          onClose={handleInfoClose}
          message={props.message}
        />
      )}

    </Box>
  );
}
