import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { SxProps } from '@mui/joy/styles/types';
import { Avatar, Box, ButtonGroup, CircularProgress, IconButton, ListDivider, ListItem, ListItemDecorator, MenuItem, Switch, Tooltip, Typography } from '@mui/joy';
import { ClickAwayListener, Popper } from '@mui/base';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import ClearIcon from '@mui/icons-material/Clear';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DifferenceIcon from '@mui/icons-material/Difference';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import Face6Icon from '@mui/icons-material/Face6';
import ForkRightIcon from '@mui/icons-material/ForkRight';
import FormatPaintOutlinedIcon from '@mui/icons-material/FormatPaintOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import RecordVoiceOverOutlinedIcon from '@mui/icons-material/RecordVoiceOverOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import ReplyRoundedIcon from '@mui/icons-material/ReplyRounded';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import StarOutlineRoundedIcon from '@mui/icons-material/StarOutlineRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import TelegramIcon from '@mui/icons-material/Telegram';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';

import { SystemPurposeId, SystemPurposes } from '../../../../data';

import { BlocksRenderer, editBlocksSx } from '~/modules/blocks/BlocksRenderer';
import { useSanityTextDiffs } from '~/modules/blocks/RenderTextDiff';

import { ChatBeamIcon } from '~/common/components/icons/ChatBeamIcon';
import { CloseableMenu } from '~/common/components/CloseableMenu';
import { DMessage, DMessageUserFlag, messageHasUserFlag } from '~/common/state/store-chats';
import { InlineTextarea } from '~/common/components/InlineTextarea';
import { KeyStroke } from '~/common/components/KeyStroke';
import { Link } from '~/common/components/Link';
import { adjustContentScaling, themeScalingMap, themeZIndexPageBar } from '~/common/app.theme';
import { animationColorRainbow } from '~/common/util/animUtils';
import { copyToClipboard } from '~/common/util/clipboardUtils';
import { prettyBaseModel } from '~/common/util/modelUtils';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { ReplyToBubble } from './ReplyToBubble';
import { useChatShowTextDiff } from '../../store-app-chat';


// Enable the menu on text selection
const ENABLE_SELECTION_RIGHT_CLICK_MENU = false;
const ENABLE_SELECTION_TOOLBAR = true;
const SELECTION_TOOLBAR_MIN_LENGTH = 3;

// Enable the hover button to copy the whole message. The Copy button is also available in Blocks, or in the Avatar Menu.
const ENABLE_COPY_MESSAGE_OVERLAY: boolean = false;


export function messageBackground(messageRole: DMessage['role'] | string, wasEdited: boolean, isAssistantIssue: boolean): string {
  switch (messageRole) {
    case 'user':
      return 'primary.plainHoverBg'; // was .background.level1
    case 'assistant':
      return isAssistantIssue ? 'danger.softBg' : 'background.surface';
    case 'system':
      return wasEdited ? 'warning.softHoverBg' : 'neutral.softBg';
    default:
      return '#ff0000';
  }
}

const avatarIconSx = {
  width: 36,
  height: 36,
};

const personaSx: SxProps = {
  // make this stick to the top of the screen
  position: 'sticky',
  top: 0,

  // flexBasis: 0, // this won't let the item grow
  minWidth: { xs: 50, md: 64 },
  maxWidth: 80,
  textAlign: 'center',
  // layout
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};


export function makeAvatar(messageAvatar: string | null, messageRole: DMessage['role'] | string, messageOriginLLM: string | undefined, messagePurposeId: SystemPurposeId | undefined, messageSender: string, messageTyping: boolean, size: 'sm' | undefined = undefined): React.JSX.Element {
  if (typeof messageAvatar === 'string' && messageAvatar)
    return <Avatar alt={messageSender} src={messageAvatar} />;

  const mascotSx = size === 'sm' ? avatarIconSx : { width: 64, height: 64 };
  switch (messageRole) {
    case 'system':
      return <SettingsSuggestIcon sx={avatarIconSx} />;  // https://em-content.zobj.net/thumbs/120/apple/325/robot_1f916.png

    case 'user':
      return <Face6Icon sx={avatarIconSx} />;            // https://www.svgrepo.com/show/306500/openai.svg

    case 'assistant':
      // typing gif (people seem to love this, so keeping it after april fools')
      const isDownload = messageOriginLLM === 'web';
      const isTextToImage = messageOriginLLM === 'DALL·E' || messageOriginLLM === 'Prodia';
      const isReact = messageOriginLLM?.startsWith('react-');

      // animation: message typing
      if (messageTyping)
        return <Avatar
          alt={messageSender} variant='plain'
          src={isDownload ? 'https://i.giphy.com/26u6dIwIphLj8h10A.webp' // hourglass: https://i.giphy.com/TFSxpAIYz5inJGuY8f.webp, small-lq: https://i.giphy.com/131tNuGktpXGhy.webp, floppy: https://i.giphy.com/RxR1KghIie2iI.webp
            : isTextToImage ? 'https://i.giphy.com/media/5t9ujj9cMisyVjUZ0m/giphy.webp' // brush
              : isReact ? 'https://i.giphy.com/media/l44QzsOLXxcrigdgI/giphy.webp' // mind
                : 'https://i.giphy.com/media/jJxaUysjzO9ri/giphy.webp'} // typing
          sx={{ ...mascotSx, borderRadius: 'sm' }}
        />;

      // icon: text-to-image
      if (isTextToImage)
        return <FormatPaintOutlinedIcon sx={{
          ...avatarIconSx,
          animation: `${animationColorRainbow} 1s linear 2.66`,
        }} />;

      // purpose symbol (if present)
      const symbol = SystemPurposes[messagePurposeId!]?.symbol;
      if (symbol)
        return <Box sx={{
          fontSize: '24px',
          textAlign: 'center',
          width: '100%',
          minWidth: `${avatarIconSx.width}px`,
          lineHeight: `${avatarIconSx.height}px`,
        }}>
          {symbol}
        </Box>;

      // default assistant avatar
      return <SmartToyOutlinedIcon sx={avatarIconSx} />; // https://mui.com/static/images/avatar/2.jpg
  }
  return <Avatar alt={messageSender} />;
}

function explainErrorInMessage(text: string, isAssistant: boolean, modelId?: string) {
  const isAssistantError = isAssistant && (text.startsWith('[Issue] ') || text.startsWith('[OpenAI Issue]'));
  let errorMessage: React.JSX.Element | null = null;
  if (!isAssistantError)
    return { errorMessage, isAssistantError };

  // [OpenAI] "Service Temporarily Unavailable (503)", {"code":503,"message":"Service Unavailable.","param":null,"type":"cf_service_unavailable"}
  if (text.includes('"cf_service_unavailable"')) {
    errorMessage = <>
      The OpenAI servers appear to be having trouble at the moment. Kindly follow
      the <Link noLinkStyle href='https://status.openai.com/' target='_blank'>OpenAI Status</Link> page
      for up to date information, and at your option try again.
    </>;
  }
  // ...
  else if (text.startsWith('OpenAI API error: 429 Too Many Requests')) {
    // TODO: retry at the api/chat level a few times instead of showing this error
    errorMessage = <>
      The model appears to be occupied at the moment. Kindly select <b>GPT-3.5 Turbo</b>,
      or give it another go by selecting <b>Run again</b> from the message menu.
    </>;
  } else if (text.includes('"model_not_found"')) {
    // note that "model_not_found" is different than "The model `gpt-xyz` does not exist" message
    errorMessage = <>
      The API key appears to be unauthorized for {modelId || 'this model'}. You can change to <b>GPT-3.5
      Turbo</b> and simultaneously <Link noLinkStyle href='https://openai.com/waitlist/gpt-4-api' target='_blank'>request
      access</Link> to the desired model.
    </>;
  } else if (text.includes('"context_length_exceeded"')) {
    // TODO: propose to summarize or split the input?
    const pattern = /maximum context length is (\d+) tokens.+resulted in (\d+) tokens/;
    const match = pattern.exec(text);
    const usedText = match ? <b>{parseInt(match[2] || '0').toLocaleString()} tokens &gt; {parseInt(match[1] || '0').toLocaleString()}</b> : '';
    errorMessage = <>
      This thread <b>surpasses the maximum size</b> allowed for {modelId || 'this model'}. {usedText}.
      Please consider removing some earlier messages from the conversation, start a new conversation,
      choose a model with larger context, or submit a shorter new message.
      {!usedText && ` -- ${text}`}
    </>;
  }
  // [OpenAI] {"error":{"message":"Incorrect API key provided: ...","type":"invalid_request_error","param":null,"code":"invalid_api_key"}}
  else if (text.includes('"invalid_api_key"')) {
    errorMessage = <>
      The API key appears to be incorrect or to have expired.
      Please <Link noLinkStyle href='https://platform.openai.com/account/api-keys' target='_blank'>check your
      API key</Link> and update it in <b>Models</b>.
    </>;
  } else if (text.includes('"insufficient_quota"')) {
    errorMessage = <>
      The API key appears to have <b>insufficient quota</b>. Please
      check <Link noLinkStyle href='https://platform.openai.com/account/usage' target='_blank'>your usage</Link> and
      make sure the usage is under <Link noLinkStyle href='https://platform.openai.com/account/billing/limits' target='_blank'>the limits</Link>.
    </>;
  }
  // else
  //  errorMessage = <>{text || 'Unknown error'}</>;

  return { errorMessage, isAssistantError };
}


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
  isBottom?: boolean,
  isImagining?: boolean,
  isSpeaking?: boolean,
  showAvatar?: boolean, // auto if undefined
  showBlocksDate?: boolean,
  showUnsafeHtml?: boolean,
  adjustContentScaling?: number,
  topDecorator?: React.ReactNode,
  onMessageAssistantFrom?: (messageId: string, offset: number) => Promise<void>,
  onMessageBeam?: (messageId: string) => Promise<void>,
  onMessageBranch?: (messageId: string) => void,
  onMessageDelete?: (messageId: string) => void,
  onMessageEdit?: (messageId: string, text: string) => void,
  onMessageToggleUserFlag?: (messageId: string, flag: DMessageUserFlag) => void,
  onMessageTruncate?: (messageId: string) => void,
  onReplyTo?: (messageId: string, selectedText: string) => void,
  onTextDiagram?: (messageId: string, text: string) => Promise<void>
  onTextImagine?: (text: string) => Promise<void>
  onTextSpeak?: (text: string) => Promise<void>
  sx?: SxProps,
}) {

  // state
  const blocksRendererRef = React.useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = React.useState(false);
  const [opsMenuAnchor, setOpsMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [selMenuAnchor, setSelMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [selToolbarAnchor, setSelToolbarAnchor] = React.useState<HTMLElement | null>(null);
  const [selText, setSelText] = React.useState<string | null>(null);
  const [isEditing, setIsEditing] = React.useState(false);

  // external state
  const { showAvatar, contentScaling, doubleClickToEdit, renderMarkdown } = useUIPreferencesStore(useShallow(state => ({
    showAvatar: props.showAvatar !== undefined ? props.showAvatar : state.zenMode !== 'cleaner',
    contentScaling: adjustContentScaling(state.contentScaling, props.adjustContentScaling),
    doubleClickToEdit: state.doubleClickToEdit,
    renderMarkdown: state.renderMarkdown,
  })));
  const [showDiff, setShowDiff] = useChatShowTextDiff();
  const textDiffs = useSanityTextDiffs(props.message.text, props.diffPreviousText, showDiff);

  // derived state
  const {
    id: messageId,
    text: messageText,
    sender: messageSender,
    avatar: messageAvatar,
    typing: messageTyping,
    role: messageRole,
    purposeId: messagePurposeId,
    originLLM: messageOriginLLM,
    metadata: messageMetadata,
    created: messageCreated,
    updated: messageUpdated,
  } = props.message;

  const isUserStarred = messageHasUserFlag(props.message, 'starred');

  const fromAssistant = messageRole === 'assistant';
  const fromSystem = messageRole === 'system';
  const wasEdited = !!messageUpdated;

  const textSel = selText ? selText : messageText;
  // WARNING: if you get an issue here, you're downgrading from the new Big-AGI 2 data format to 1.x.
  const isSpecialT2I = textSel.startsWith('https://images.prodia.xyz/') || textSel.startsWith('/draw ') || textSel.startsWith('/imagine ') || textSel.startsWith('/img ');
  const couldDiagram = textSel.length >= 100 && !isSpecialT2I;
  const couldImagine = textSel.length >= 3 && !isSpecialT2I;
  const couldSpeak = couldImagine;


  const handleTextEdited = (editedText: string) => {
    setIsEditing(false);
    if (props.onMessageEdit && editedText?.trim() && editedText !== messageText)
      props.onMessageEdit(messageId, editedText);
  };


  // Operations Menu

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
    closeSelectionMenu();
    closeToolbar();
  };

  const handleOpsEdit = React.useCallback((e: React.MouseEvent) => {
    if (messageTyping && !isEditing) return; // don't allow editing while typing
    setIsEditing(!isEditing);
    e.preventDefault();
    handleCloseOpsMenu();
  }, [handleCloseOpsMenu, isEditing, messageTyping]);

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
      closeSelectionMenu();
      closeToolbar();
    }
  };

  const handleOpsImagine = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (props.onTextImagine) {
      await props.onTextImagine(textSel);
      handleCloseOpsMenu();
      closeSelectionMenu();
      closeToolbar();
    }
  };

  const handleOpsReplyTo = (e: React.MouseEvent) => {
    e.preventDefault();
    if (props.onReplyTo && textSel.trim().length >= SELECTION_TOOLBAR_MIN_LENGTH) {
      props.onReplyTo(messageId, textSel.trim());
      handleCloseOpsMenu();
      closeSelectionMenu();
      closeToolbar();
    }
  };

  const handleOpsSpeak = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (props.onTextSpeak) {
      await props.onTextSpeak(textSel);
      handleCloseOpsMenu();
      closeSelectionMenu();
      closeToolbar();
    }
  };

  const handleOpsTruncate = (_e: React.MouseEvent) => {
    props.onMessageTruncate?.(messageId);
    handleCloseOpsMenu();
  };

  const handleOpsDelete = (_e: React.MouseEvent) => {
    props.onMessageDelete?.(messageId);
  };


  // Selection Menu

  const removeSelectionAnchor = React.useCallback(() => {
    if (selMenuAnchor) {
      try {
        document.body.removeChild(selMenuAnchor);
      } catch (e) {
        // ignore...
      }
    }
  }, [selMenuAnchor]);

  const openSelectionMenu = React.useCallback((event: MouseEvent, selectedText: string) => {
    event.stopPropagation();
    event.preventDefault();

    // remove any stray anchor
    removeSelectionAnchor();

    // create a temporary fixed anchor element to position the menu
    const anchorEl = document.createElement('div');
    anchorEl.style.position = 'fixed';
    anchorEl.style.left = `${event.clientX}px`;
    anchorEl.style.top = `${event.clientY}px`;
    document.body.appendChild(anchorEl);

    setSelMenuAnchor(anchorEl);
    setSelText(selectedText);
  }, [removeSelectionAnchor]);

  const closeSelectionMenu = React.useCallback(() => {
    // window.getSelection()?.removeAllRanges?.();
    removeSelectionAnchor();
    setSelMenuAnchor(null);
    setSelText(null);
  }, [removeSelectionAnchor]);

  const handleContextMenu = React.useCallback((event: MouseEvent) => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const selectedText = range.toString().trim();
      if (selectedText.length > 0)
        openSelectionMenu(event, selectedText);
    }
  }, [openSelectionMenu]);


  // Selection Toolbar

  const closeToolbar = React.useCallback((anchorEl?: HTMLElement) => {
    window.getSelection()?.removeAllRanges?.();
    try {
      const anchor = anchorEl || selToolbarAnchor;
      anchor && document.body.removeChild(anchor);
    } catch (e) {
      // ignore...
    }
    setSelToolbarAnchor(null);
    setSelText(null);
  }, [selToolbarAnchor]);

  const handleOpenToolbar = React.useCallback((_event: MouseEvent) => {
    // check for selection
    const selection = window.getSelection();
    if (!selection || selection.rangeCount <= 0) return;

    // check for enought selection
    const selectionText = selection.toString().trim();
    if (selectionText.length < SELECTION_TOOLBAR_MIN_LENGTH) return;

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
        closeToolbar(anchorEl);
        document.removeEventListener('selectionchange', closeOnUnselect);
      }
    };
    document.addEventListener('selectionchange', closeOnUnselect);

    setSelToolbarAnchor(anchorEl);
    setSelText(selectionText);
  }, [closeToolbar]);


  // Blocks renderer

  const handleBlocksContextMenu = React.useCallback((event: React.MouseEvent) => {
    handleContextMenu(event.nativeEvent);
  }, [handleContextMenu]);

  const handleBlocksDoubleClick = React.useCallback((event: React.MouseEvent) => {
    doubleClickToEdit && props.onMessageEdit && handleOpsEdit(event);
  }, [doubleClickToEdit, handleOpsEdit, props.onMessageEdit]);

  const handleBlocksMouseUp = React.useCallback((event: React.MouseEvent) => {
    handleOpenToolbar(event.nativeEvent);
  }, [handleOpenToolbar]);


  // prettier upstream errors
  const { isAssistantError, errorMessage } = React.useMemo(
    () => explainErrorInMessage(messageText, fromAssistant, messageOriginLLM),
    [messageText, fromAssistant, messageOriginLLM],
  );

  // style
  const backgroundColor = messageBackground(messageRole, wasEdited, isAssistantError && !errorMessage);

  // avatar
  const avatarEl: React.JSX.Element | null = React.useMemo(
    () => showAvatar ? makeAvatar(messageAvatar, messageRole, messageOriginLLM, messagePurposeId, messageSender, messageTyping) : null,
    [messageAvatar, messageOriginLLM, messagePurposeId, messageRole, messageSender, messageTyping, showAvatar],
  );


  return (
    <ListItem
      role='chat-message'
      onMouseUp={(ENABLE_SELECTION_TOOLBAR && !fromSystem && !isAssistantError) ? handleBlocksMouseUp : undefined}
      sx={{
        // style
        backgroundColor: backgroundColor,
        px: { xs: 1, md: themeScalingMap[contentScaling]?.chatMessagePadding ?? 2 },
        py: themeScalingMap[contentScaling]?.chatMessagePadding ?? 2,

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
    >

      {/* (Optional) underlayed top decorator */}
      {props.topDecorator}

      {/* Message Row: Avatar, Blocks (1 text -> blocksRenderer) */}
      <Box sx={{
        display: 'flex',
        flexDirection: !fromAssistant ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
        gap: { xs: 0, md: 1 },
      }}>

        {/* Avatar (Persona) */}
        {showAvatar && (
          <Box sx={personaSx}>

            {/* Persona Avatar or Menu Button */}
            <Box
              onClick={handleOpsMenuToggle}
              onContextMenu={handleOpsMenuToggle}
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
              sx={{ display: 'flex' }}
            >
              {(isHovering || opsMenuAnchor) ? (
                <IconButton variant={opsMenuAnchor ? 'solid' : 'soft'} color={(fromAssistant || fromSystem) ? 'neutral' : 'primary'} sx={avatarIconSx}>
                  <MoreVertIcon />
                </IconButton>
              ) : (
                avatarEl
              )}
            </Box>

            {/* Assistant model name */}
            {fromAssistant && (
              <Tooltip arrow title={messageTyping ? null : (messageOriginLLM || 'unk-model')} variant='solid'>
                <Typography level='body-xs' sx={{
                  overflowWrap: 'anywhere',
                  ...(messageTyping ? { animation: `${animationColorRainbow} 5s linear infinite` } : {}),
                }}>
                  {prettyBaseModel(messageOriginLLM)}
                </Typography>
              </Tooltip>
            )}

          </Box>
        )}


        {/* Edit / Blocks */}
        {isEditing ? (

          <InlineTextarea
            initialText={messageText} onEdit={handleTextEdited}
            sx={editBlocksSx}
          />

        ) : (

          <BlocksRenderer
            ref={blocksRendererRef}
            text={messageText}
            fromRole={messageRole}
            contentScaling={contentScaling}
            errorMessage={errorMessage}
            fitScreen={props.fitScreen}
            isBottom={props.isBottom}
            renderTextAsMarkdown={renderMarkdown}
            renderTextDiff={textDiffs || undefined}
            showDate={props.showBlocksDate === true ? messageUpdated || messageCreated || undefined : undefined}
            showUnsafeHtml={props.showUnsafeHtml}
            wasUserEdited={wasEdited}
            onContextMenu={(props.onMessageEdit && ENABLE_SELECTION_RIGHT_CLICK_MENU) ? handleBlocksContextMenu : undefined}
            onDoubleClick={(props.onMessageEdit && doubleClickToEdit) ? handleBlocksDoubleClick : undefined}
            optiAllowMemo={messageTyping}
          />

        )}

      </Box>

      {/* Reply-To Bubble */}
      {!!messageMetadata?.inReplyToText && <ReplyToBubble inlineMessage replyToText={messageMetadata.inReplyToText} className='reply-to-bubble' />}


      {/* Overlay copy icon */}
      {ENABLE_COPY_MESSAGE_OVERLAY && !fromSystem && !isEditing && (
        <Tooltip title={messageTyping ? null : (fromAssistant ? 'Copy message' : 'Copy input')} variant='solid'>
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


      {/* Operations Menu (3 dots) */}
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
            {!!props.onMessageEdit && (
              <MenuItem variant='plain' disabled={messageTyping} onClick={handleOpsEdit} sx={{ flex: 1 }}>
                <ListItemDecorator><EditRoundedIcon /></ListItemDecorator>
                {isEditing ? 'Discard' : 'Edit'}
                {/*{!isEditing && <span style={{ opacity: 0.5, marginLeft: '8px' }}>{doubleClickToEdit ? '(double-click)' : ''}</span>}*/}
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
                {isUserStarred
                  ? <StarRoundedIcon color='primary' sx={{ fontSize: 'xl2' }} />
                  : <StarOutlineRoundedIcon sx={{ fontSize: 'xl2' }} />
                }
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
              <ListItemDecorator><ClearIcon /></ListItemDecorator>
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
                  : <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'space-between', gap: 1 }}>Retry<KeyStroke combo='Ctrl + Shift + G' /></Box>}
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


      {/* Selection Toolbar */}
      {ENABLE_SELECTION_TOOLBAR && !!selToolbarAnchor && (
        <Popper placement='top-start' open anchorEl={selToolbarAnchor} slotProps={{
          root: { style: { zIndex: themeZIndexPageBar + 1 } },
        }}>
          <ClickAwayListener onClickAway={() => closeToolbar()}>
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
              {!!props.onReplyTo && fromAssistant && <Tooltip disableInteractive arrow placement='top' title='Reply'>
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
              {/*{!!props.onTextImagine && <Tooltip disableInteractive arrow placement='top' title='Auto-Draw'>*/}
              {/*  <IconButton onClick={handleOpsImagine} disabled={!couldImagine || props.isImagining}>*/}
              {/*    {!props.isImagining ? <FormatPaintOutlinedIcon /> : <CircularProgress sx={{ '--CircularProgress-size': '16px' }} />}*/}
              {/*  </IconButton>*/}
              {/*</Tooltip>}*/}
              {!!props.onTextSpeak && <Tooltip disableInteractive arrow placement='top' title='Speak'>
                <IconButton onClick={handleOpsSpeak} disabled={!couldSpeak || props.isSpeaking}>
                  {!props.isSpeaking ? <RecordVoiceOverOutlinedIcon /> : <CircularProgress sx={{ '--CircularProgress-size': '16px' }} />}
                </IconButton>
              </Tooltip>}
            </ButtonGroup>
          </ClickAwayListener>
        </Popper>
      )}


      {/* Selection (Contextual) Menu */}
      {!!selMenuAnchor && (
        <CloseableMenu
          dense placement='bottom-start'
          open anchorEl={selMenuAnchor} onClose={closeSelectionMenu}
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
