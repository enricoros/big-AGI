import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, List } from '@mui/joy';

import type { SystemPurposeExample } from '../../../data';

import type { DiagramConfig } from '~/modules/aifn/digrams/DiagramsModal';

import type { ConversationHandler } from '~/common/chat-overlay/ConversationHandler';
import { DConversationId, excludeSystemMessages } from '~/common/stores/chat/chat.conversation';
import { ShortcutKey, useGlobalShortcuts } from '~/common/components/shortcuts/useGlobalShortcuts';
import { convertFilesToDAttachmentFragments } from '~/common/attachment-drafts/attachment.pipeline';
import { createDMessageFromFragments, createDMessageTextContent, DMessage, DMessageId, DMessageUserFlag, DMetaReferenceItem, MESSAGE_FLAG_AIX_SKIP } from '~/common/stores/chat/chat.message';
import { createTextContentFragment, DMessageFragment, DMessageFragmentId } from '~/common/stores/chat/chat.fragments';
import { openFileForAttaching } from '~/common/components/ButtonAttachFiles';
import { optimaOpenPreferences } from '~/common/layout/optima/useOptima';
import { useBrowserTranslationWarning } from '~/common/components/useIsBrowserTranslating';
import { useCapabilityElevenLabs } from '~/common/components/useCapabilities';
import { useChatOverlayStore } from '~/common/chat-overlay/store-perchat_vanilla';
import { useChatStore } from '~/common/stores/chat/store-chats';
import { useScrollToBottom } from '~/common/scroll-to-bottom/useScrollToBottom';

import { CMLZeroConversation } from './messages-list/CMLZeroConversation';
import { ChatMessage, ChatMessageMemo } from './message/ChatMessage';
import { CleanerMessage, MessagesSelectionHeader } from './message/CleanerMessage';
import { Ephemerals } from './Ephemerals';
import { PersonaSelector } from './persona-selector/PersonaSelector';
import { useChatAutoSuggestHTMLUI, useChatShowSystemMessages } from '../store-app-chat';


const stableNoMessages: DMessage[] = [];

/**
 * A list of ChatMessages
 */
export function ChatMessageList(props: {
  conversationId: DConversationId | null,
  conversationHandler: ConversationHandler | null,
  capabilityHasT2I: boolean,
  chatLLMAntPromptCaching: boolean,
  chatLLMContextTokens: number | null,
  chatLLMSupportsImages: boolean,
  fitScreen: boolean,
  isMobile: boolean,
  isMessageSelectionMode: boolean,
  onConversationBranch: (conversationId: DConversationId, messageId: string, addSplitPane: boolean) => void,
  onConversationExecuteHistory: (conversationId: DConversationId) => Promise<void>,
  onConversationNew: (forceNoRecycle: boolean, isIncognito: boolean) => void,
  onTextDiagram: (diagramConfig: DiagramConfig | null) => void,
  onTextImagine: (conversationId: DConversationId, selectedText: string) => Promise<void>,
  onTextSpeak: (selectedText: string) => Promise<void>,
  setIsMessageSelectionMode: (isMessageSelectionMode: boolean) => void,
  sx?: SxProps,
}) {

  // state
  const [isImagining, setIsImagining] = React.useState(false);
  const [isSpeaking, setIsSpeaking] = React.useState(false);
  const [selectedMessages, setSelectedMessages] = React.useState<Set<string>>(new Set());

  // external state
  const { notifyBooting } = useScrollToBottom();
  const danger_experimentalHtmlWebUi = useChatAutoSuggestHTMLUI();
  const [showSystemMessages] = useChatShowSystemMessages();
  const optionalTranslationWarning = useBrowserTranslationWarning();
  const { conversationMessages, historyTokenCount } = useChatStore(useShallow(({ conversations }) => {
    const conversation = conversations.find(conversation => conversation.id === props.conversationId);
    return {
      conversationMessages: conversation ? conversation.messages : stableNoMessages,
      historyTokenCount: conversation ? conversation.tokenCount : 0,
    };
  }));
  const { _composerInReferenceToCount, ephemerals } = useChatOverlayStore(props.conversationHandler?.conversationOverlayStore ?? null, useShallow(state => ({
    _composerInReferenceToCount: state.inReferenceTo?.length ?? 0,
    ephemerals: state.ephemerals?.length ? state.ephemerals : null,
  })));
  const { mayWork: isSpeakable } = useCapabilityElevenLabs();

  // derived state
  const { conversationHandler, conversationId, capabilityHasT2I, onConversationBranch, onConversationExecuteHistory, onTextDiagram, onTextImagine, onTextSpeak } = props;
  const composerCanAddInReferenceTo = _composerInReferenceToCount < 5;
  const composerHasInReferenceto = _composerInReferenceToCount > 0;

  // text actions

  const handleRunExample = React.useCallback(async (example: SystemPurposeExample) => {
    if (!conversationId || !conversationHandler) return;

    // Simple Example Prompt (User text message)
    if (typeof example === 'string') {
      conversationHandler.messageAppend(createDMessageTextContent('user', example)); // [chat] append user:persona question
      await onConversationExecuteHistory(conversationId);
      return;
    }

    // User-Action Example Prompts (User text message + File attachments)
    switch (example.action) {
      case 'require-data-attachment':
        await openFileForAttaching(true, async (filesWithHandle) => {

          // Retrieve fully-fledged Attachment Fragments (converted/extracted, with sources, mimes, etc.) from the selected files
          const attachmentFragments = await convertFilesToDAttachmentFragments('file-open', filesWithHandle, {
            hintAddImages: props.chatLLMSupportsImages,
          });

          // Create a User message with the prompt and the attachment fragments
          if (attachmentFragments.length) {
            conversationHandler.messageAppend(createDMessageFromFragments('user', [ // [chat] append user:persona question + attachment(s)
              createTextContentFragment(example.prompt),
              ...attachmentFragments,
            ]));
            await onConversationExecuteHistory(conversationId);
          }
        });
        break;
    }
  }, [conversationHandler, conversationId, onConversationExecuteHistory, props.chatLLMSupportsImages]);

  const handleMessageContinue = React.useCallback(async (_messageId: DMessageId /* Ignored for now */) => {
    if (conversationId && conversationHandler) {
      conversationHandler.messageAppend(createDMessageTextContent('user', 'Continue')); // [chat] append user:Continue
      await onConversationExecuteHistory(conversationId);
    }
  }, [conversationHandler, conversationId, onConversationExecuteHistory]);


  // message menu methods proxy

  const handleMessageAssistantFrom = React.useCallback(async (messageId: DMessageId, offset: number) => {
    if (conversationId && conversationHandler) {
      conversationHandler.historyTruncateTo(messageId, offset);
      await onConversationExecuteHistory(conversationId);
    }
  }, [conversationHandler, conversationId, onConversationExecuteHistory]);

  const handleMessageBeam = React.useCallback(async (messageId: DMessageId) => {
    // Message option menu Beam
    if (!conversationId || !props.conversationHandler || !props.conversationHandler.isValid()) return;
    const inputHistory = props.conversationHandler.historyViewHeadOrThrow('chat-beam-message');
    if (!inputHistory.length) return;

    // TODO: replace the Persona and Auto-Cache-hint in the history?

    // truncate the history to the given message (may or may not have more after)
    const truncatedHistory = inputHistory.slice(0, inputHistory.findIndex(m => m.id === messageId) + 1);
    const lastTruncatedMessage = truncatedHistory[truncatedHistory.length - 1];
    if (!lastTruncatedMessage) return;

    // assistant: do an in-place beam
    if (lastTruncatedMessage.role === 'assistant') {
      if (truncatedHistory.length >= 2)
        props.conversationHandler.beamInvoke(truncatedHistory.slice(0, -1), [lastTruncatedMessage], lastTruncatedMessage.id);
    } else if (lastTruncatedMessage.role === 'user') {
      // user: truncate and append (but if the next message is an assistant message, import it)
      const possibleNextMessage = inputHistory[truncatedHistory.length];
      if (possibleNextMessage?.role === 'assistant')
        props.conversationHandler.beamInvoke(truncatedHistory, [possibleNextMessage], null);
      else
        props.conversationHandler.beamInvoke(truncatedHistory, [], null);
    }
  }, [conversationId, props.conversationHandler]);

  const handleMessageBranch = React.useCallback((messageId: DMessageId) => {
    conversationId && onConversationBranch(conversationId, messageId, true);
  }, [conversationId, onConversationBranch]);

  const handleMessageTruncate = React.useCallback((messageId: DMessageId) => {
    props.conversationHandler?.historyTruncateTo(messageId, 0);
  }, [props.conversationHandler]);

  const handleMessageDelete = React.useCallback((messageId: DMessageId) => {
    props.conversationHandler?.messagesDelete([messageId]);
  }, [props.conversationHandler]);

  const handleMessageAppendFragment = React.useCallback((messageId: DMessageId, fragment: DMessageFragment) => {
    props.conversationHandler?.messageFragmentAppend(messageId, fragment, false, false);
  }, [props.conversationHandler]);

  const handleMessageDeleteFragment = React.useCallback((messageId: DMessageId, fragmentId: DMessageFragmentId) => {
    props.conversationHandler?.messageFragmentDelete(messageId, fragmentId, false, true);
  }, [props.conversationHandler]);

  const handleMessageReplaceFragment = React.useCallback((messageId: DMessageId, fragmentId: DMessageFragmentId, newFragment: DMessageFragment) => {
    props.conversationHandler?.messageFragmentReplace(messageId, fragmentId, newFragment, false);
  }, [props.conversationHandler]);

  const handleMessageToggleUserFlag = React.useCallback((messageId: DMessageId, userFlag: DMessageUserFlag, _maxPerConversation?: number) => {
    props.conversationHandler?.messageToggleUserFlag(messageId, userFlag, true /* touch */);
    // Note: we don't support 'maxPerConversation' yet, which is supposed to turn off the flag from the beginning if it's too numerous
    // if (_maxPerConversation) {
    //   ...
    // }
  }, [props.conversationHandler]);

  const handleAddInReferenceTo = React.useCallback((item: DMetaReferenceItem) => {
    props.conversationHandler?.overlayActions.addInReferenceTo(item);
  }, [props.conversationHandler]);

  const handleTextDiagram = React.useCallback(async (messageId: DMessageId, text: string) => {
    conversationId && onTextDiagram({ conversationId: conversationId, messageId, text });
  }, [conversationId, onTextDiagram]);

  const handleTextImagine = React.useCallback(async (text: string) => {
    if (!capabilityHasT2I)
      return optimaOpenPreferences('draw');
    if (conversationId) {
      setIsImagining(true);
      await onTextImagine(conversationId, text);
      setIsImagining(false);
    }
  }, [capabilityHasT2I, conversationId, onTextImagine]);

  const handleTextSpeak = React.useCallback(async (text: string) => {
    if (!isSpeakable)
      return optimaOpenPreferences('voice');
    setIsSpeaking(true);
    await onTextSpeak(text);
    setIsSpeaking(false);
  }, [isSpeakable, onTextSpeak]);


  // operate on the local selection set

  const handleSelectAll = (selected: boolean) => {
    const newSelected = new Set<string>();
    if (selected)
      for (const message of conversationMessages)
        newSelected.add(message.id);
    setSelectedMessages(newSelected);
  };

  const handleSelectMessage = (messageId: DMessageId, selected: boolean) => {
    const newSelected = new Set(selectedMessages);
    selected ? newSelected.add(messageId) : newSelected.delete(messageId);
    setSelectedMessages(newSelected);
  };

  const handleSelectionDelete = React.useCallback(() => {
    props.conversationHandler?.messagesDelete(Array.from(selectedMessages));
    setSelectedMessages(new Set());
  }, [props.conversationHandler, selectedMessages]);

  const handleSelectionHide = React.useCallback(() => {
    for (let selectedMessage of Array.from(selectedMessages))
      props.conversationHandler?.messageSetUserFlag(selectedMessage, MESSAGE_FLAG_AIX_SKIP, true, true);
    setSelectedMessages(new Set());
  }, [props.conversationHandler, selectedMessages]);

  const { isMessageSelectionMode, setIsMessageSelectionMode } = props;

  useGlobalShortcuts('ChatMessageList_Selection', React.useMemo(() => !isMessageSelectionMode ? [] : [
    { key: ShortcutKey.Esc, action: () => setIsMessageSelectionMode(false), description: 'Close Cleanup', level: 10 - 1 },
  ], [isMessageSelectionMode, setIsMessageSelectionMode]));


  // text-diff functionality: only diff the last complete message, and they're similar in size

  // const { diffTargetMessage, diffPrevText } = React.useMemo(() => {
  //   const [msgB, msgA] = conversationMessages.filter(m => m.role === 'assistant').reverse();
  //   const textB = msgB ? singleTextOrThrow(msgB) : undefined;
  //   const textA = msgA ? singleTextOrThrow(msgA) : undefined;
  //   if (textB && textA && !msgB?.pendingIncomplete) {
  //     const lenA = textA.length, lenB = textB.length;
  //     if (lenA > 80 && lenB > 80 && lenA > lenB / 3 && lenB > lenA / 3)
  //       return { diffTargetMessage: msgB, diffPrevText: textA };
  //   }
  //   return { diffTargetMessage: undefined, diffPrevText: undefined };
  // }, [conversationMessages]);


  // scroll to the very bottom of a new chat
  React.useEffect(() => {
    if (conversationId)
      notifyBooting();
  }, [conversationId, notifyBooting]);


  // style memo
  const listSx: SxProps = React.useMemo(() => ({
    p: 0,
    ...props.sx,

    // fix for the double-border on the last message (one by the composer, one to the bottom of the message)
    // marginBottom: '-1px',

    // layout
    display: 'flex',
    flexDirection: 'column',
  }), [props.sx]);


  // no conversation: sine qua non
  if (!conversationId)
    return <CMLZeroConversation onConversationNew={props.onConversationNew} />;


  // no content: show the persona selector

  const filteredMessages = excludeSystemMessages(conversationMessages, showSystemMessages);


  if (!filteredMessages.length)
    return (
      <Box sx={{ ...props.sx }}>
        <PersonaSelector conversationId={conversationId} isMobile={props.isMobile} runExample={handleRunExample} />
      </Box>
    );

  return (
    <List role='chat-messages-list' sx={listSx}>

      {optionalTranslationWarning}

      {props.isMessageSelectionMode && (
        <MessagesSelectionHeader
          hasSelected={selectedMessages.size > 0}
          sumTokens={historyTokenCount}
          onClose={() => props.setIsMessageSelectionMode(false)}
          onSelectAll={handleSelectAll}
          onDeleteMessages={handleSelectionDelete}
          onHideMessages={handleSelectionHide}
        />
      )}

      {filteredMessages.map((message, idx) => {

          // Optimization: only memo complete components, or we'd be memoizing garbage
          const ChatMessageMemoOrNot = !message.pendingIncomplete ? ChatMessageMemo : ChatMessage;

          return props.isMessageSelectionMode ? (

            <CleanerMessage
              key={'sel-' + message.id}
              message={message}
              remainingTokens={props.chatLLMContextTokens ? (props.chatLLMContextTokens - historyTokenCount) : undefined}
              selected={selectedMessages.has(message.id)} onToggleSelected={handleSelectMessage}
            />

          ) : (

            <ChatMessageMemoOrNot
              key={'msg-' + message.id}
              message={message}
              // diffPreviousText={message === diffTargetMessage ? diffPrevText : undefined}
              fitScreen={props.fitScreen}
              hasInReferenceTo={composerHasInReferenceto}
              isMobile={props.isMobile}
              isBottom={idx === filteredMessages.length - 1}
              isImagining={isImagining}
              isSpeaking={isSpeaking}
              showAntPromptCaching={props.chatLLMAntPromptCaching}
              showUnsafeHtmlCode={danger_experimentalHtmlWebUi}
              onAddInReferenceTo={!composerCanAddInReferenceTo ? undefined : handleAddInReferenceTo}
              onMessageAssistantFrom={handleMessageAssistantFrom}
              onMessageBeam={handleMessageBeam}
              onMessageBranch={handleMessageBranch}
              onMessageContinue={handleMessageContinue}
              onMessageDelete={handleMessageDelete}
              onMessageFragmentAppend={handleMessageAppendFragment}
              onMessageFragmentDelete={handleMessageDeleteFragment}
              onMessageFragmentReplace={handleMessageReplaceFragment}
              onMessageToggleUserFlag={handleMessageToggleUserFlag}
              onMessageTruncate={handleMessageTruncate}
              onTextDiagram={handleTextDiagram}
              onTextImagine={capabilityHasT2I ? handleTextImagine : undefined}
              onTextSpeak={isSpeakable ? handleTextSpeak : undefined}
            />

          );
        },
      )}

      {/* Render ephemerals (sidebar ReAct output widgets) at the bottom */}
      {!!ephemerals?.length && !!conversationHandler && (
        <Ephemerals
          ephemerals={ephemerals}
          conversationHandler={conversationHandler}
          sx={{
            mt: 'auto',
            overflowY: 'auto',
          }}
        />
      )}

    </List>
  );
}