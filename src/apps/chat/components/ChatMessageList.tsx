import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, List } from '@mui/joy';

import type { DiagramConfig } from '~/modules/aifn/digrams/DiagramsModal';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import type { ConversationHandler } from '~/common/chats/ConversationHandler';
import { contentPartsReplaceText, createDMessage, DMessage, DMessageUserFlag, messageToggleUserFlag, singleTextOrThrow } from '~/common/stores/chat/chat.message';
import { InlineError } from '~/common/components/InlineError';
import { PreferencesTab, useOptimaLayout } from '~/common/layout/optima/useOptimaLayout';
import { ShortcutKeyName, useGlobalShortcut } from '~/common/components/useGlobalShortcut';
import { getConversation, useChatStore } from '~/common/stores/chat/store-chats';
import { useBrowserTranslationWarning } from '~/common/components/useIsBrowserTranslating';
import { useCapabilityElevenLabs } from '~/common/components/useCapabilities';
import { useEphemerals } from '~/common/chats/EphemeralsStore';
import { useScrollToBottom } from '~/common/scroll-to-bottom/useScrollToBottom';

import { ChatMessage, ChatMessageMemo } from './message/ChatMessage';
import { CleanerMessage, MessagesSelectionHeader } from './message/CleanerMessage';
import { Ephemerals } from './Ephemerals';
import { PersonaSelector } from './persona-selector/PersonaSelector';
import { useChatShowSystemMessages } from '../store-app-chat';


/**
 * A list of ChatMessages
 */
export function ChatMessageList(props: {
  conversationId: DConversationId | null,
  conversationHandler: ConversationHandler | null,
  capabilityHasT2I: boolean,
  chatLLMContextTokens: number | null,
  fitScreen: boolean,
  isMessageSelectionMode: boolean,
  onConversationBranch: (conversationId: DConversationId, messageId: string) => void,
  onConversationExecuteHistory: (conversationId: DConversationId, history: DMessage[]) => Promise<void>,
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
  const { openPreferencesTab } = useOptimaLayout();
  const [showSystemMessages] = useChatShowSystemMessages();
  const optionalTranslationWarning = useBrowserTranslationWarning();
  const { conversationMessages, historyTokenCount, editMessage, deleteMessage, setMessages } = useChatStore(useShallow(state => {
    const conversation = state.conversations.find(conversation => conversation.id === props.conversationId);
    return {
      conversationMessages: conversation ? conversation.messages : [],
      historyTokenCount: conversation ? conversation.tokenCount : 0,
      deleteMessage: state.deleteMessage,
      editMessage: state.editMessage,
      setMessages: state.setMessages,
    };
  }));
  const ephemerals = useEphemerals(props.conversationHandler);
  const { mayWork: isSpeakable } = useCapabilityElevenLabs();

  // derived state
  const { conversationId, capabilityHasT2I, onConversationBranch, onConversationExecuteHistory, onTextDiagram, onTextImagine, onTextSpeak } = props;


  // text actions

  const handleRunExample = React.useCallback(async (examplePrompt: string) => {
    conversationId && await onConversationExecuteHistory(conversationId, [...conversationMessages, createDMessage('user', examplePrompt)]); // [chat] append user:persona question
  }, [conversationId, conversationMessages, onConversationExecuteHistory]);


  // message menu methods proxy

  const handleMessageAssistantFrom = React.useCallback(async (messageId: string, offset: number) => {
    const messages = getConversation(conversationId)?.messages;
    if (messages) {
      const truncatedHistory = messages.slice(0, messages.findIndex(m => m.id === messageId) + offset + 1);
      conversationId && await onConversationExecuteHistory(conversationId, truncatedHistory);
    }
  }, [conversationId, onConversationExecuteHistory]);

  const handleMessageBeam = React.useCallback(async (messageId: string) => {
    // Right-click menu Beam
    if (!conversationId || !props.conversationHandler) return;
    const messages = getConversation(conversationId)?.messages;
    if (messages?.length) {
      const truncatedHistory = messages.slice(0, messages.findIndex(m => m.id === messageId) + 1);
      const lastMessage = truncatedHistory[truncatedHistory.length - 1];
      if (lastMessage) {
        // assistant: do an in-place beam
        if (lastMessage.role === 'assistant') {
          if (truncatedHistory.length >= 2)
            props.conversationHandler.beamInvoke(truncatedHistory.slice(0, -1), [lastMessage], lastMessage.id);
        } else {
          // user: truncate and append (but if the next message is an assistant message, import it)
          const nextMessage = messages[truncatedHistory.length];
          if (nextMessage?.role === 'assistant')
            props.conversationHandler.beamInvoke(truncatedHistory, [nextMessage], null);
          else
            props.conversationHandler.beamInvoke(truncatedHistory, [], null);
        }
      }
    }
  }, [conversationId, props.conversationHandler]);

  const handleMessageBranch = React.useCallback((messageId: string) => {
    conversationId && onConversationBranch(conversationId, messageId);
  }, [conversationId, onConversationBranch]);

  const handleMessageTruncate = React.useCallback((messageId: string) => {
    const messages = getConversation(conversationId)?.messages;
    if (conversationId && messages) {
      const truncatedHistory = messages.slice(0, messages.findIndex(m => m.id === messageId) + 1);
      setMessages(conversationId, truncatedHistory);
    }
  }, [conversationId, setMessages]);

  const handleMessageDelete = React.useCallback((messageId: string) => {
    conversationId && deleteMessage(conversationId, messageId);
  }, [conversationId, deleteMessage]);

  const handleMessageEdit = React.useCallback((messageId: string, newText: string /* FIXME: contents instead of text */) => {
    conversationId && editMessage(conversationId, messageId, (message): Partial<DMessage> => ({
      content: contentPartsReplaceText(message.content, newText),
    }), true);
  }, [conversationId, editMessage]);

  const handleMessageToggleUserFlag = React.useCallback((messageId: string, userFlag: DMessageUserFlag) => {
    conversationId && editMessage(conversationId, messageId, (message) => ({
      userFlags: messageToggleUserFlag(message, userFlag),
    }), false);
  }, [conversationId, editMessage]);

  const handleReplyTo = React.useCallback((_messageId: string, text: string) => {
    props.conversationHandler?.getOverlayStore().getState().setReplyToText(text);
  }, [props.conversationHandler]);

  const handleTextDiagram = React.useCallback(async (messageId: string, text: string) => {
    conversationId && onTextDiagram({ conversationId: conversationId, messageId, text });
  }, [conversationId, onTextDiagram]);

  const handleTextImagine = React.useCallback(async (text: string) => {
    if (!capabilityHasT2I)
      return openPreferencesTab(PreferencesTab.Draw);
    if (conversationId) {
      setIsImagining(true);
      await onTextImagine(conversationId, text);
      setIsImagining(false);
    }
  }, [capabilityHasT2I, conversationId, onTextImagine, openPreferencesTab]);

  const handleTextSpeak = React.useCallback(async (text: string) => {
    if (!isSpeakable)
      return openPreferencesTab(PreferencesTab.Voice);
    setIsSpeaking(true);
    await onTextSpeak(text);
    setIsSpeaking(false);
  }, [isSpeakable, onTextSpeak, openPreferencesTab]);


  // operate on the local selection set

  const handleSelectAll = (selected: boolean) => {
    const newSelected = new Set<string>();
    if (selected)
      for (const message of conversationMessages)
        newSelected.add(message.id);
    setSelectedMessages(newSelected);
  };

  const handleSelectMessage = (messageId: string, selected: boolean) => {
    const newSelected = new Set(selectedMessages);
    selected ? newSelected.add(messageId) : newSelected.delete(messageId);
    setSelectedMessages(newSelected);
  };

  const handleSelectionDelete = () => {
    if (conversationId)
      for (const selectedMessage of selectedMessages)
        deleteMessage(conversationId, selectedMessage);
    setSelectedMessages(new Set());
  };

  useGlobalShortcut(props.isMessageSelectionMode && ShortcutKeyName.Esc, false, false, false, () => {
    props.setIsMessageSelectionMode(false);
  });


  // text-diff functionality: only diff the last complete message, and they're similar in size

  const { diffTargetMessage, diffPrevText } = React.useMemo(() => {
    const [msgB, msgA] = conversationMessages.filter(m => m.role === 'assistant').reverse();
    const textB = msgB ? singleTextOrThrow(msgB) : undefined;
    const textA = msgA ? singleTextOrThrow(msgA) : undefined;
    if (textB && textA && !msgB?.pendingIncomplete) {
      const lenA = textA.length, lenB = textB.length;
      if (lenA > 80 && lenB > 80 && lenA > lenB / 3 && lenB > lenA / 3)
        return { diffTargetMessage: msgB, diffPrevText: textA };
    }
    return { diffTargetMessage: undefined, diffPrevText: undefined };
  }, [conversationMessages]);


  // scroll to the very bottom of a new chat
  React.useEffect(() => {
    if (conversationId)
      notifyBooting();
  }, [conversationId, notifyBooting]);


  // no content: show the persona selector

  const filteredMessages = conversationMessages
    .filter(m => m.role !== 'system' || showSystemMessages); // hide the System message if the user choses to


  if (!filteredMessages.length)
    return (
      <Box sx={{ ...props.sx }}>
        {conversationId
          ? <PersonaSelector conversationId={conversationId} runExample={handleRunExample} />
          : <InlineError severity='info' error='Select a conversation' sx={{ m: 2 }} />}
      </Box>
    );

  return (
    <List sx={{
      p: 0,
      ...(props.sx || {}),

      // fix for the double-border on the last message (one by the composer, one to the bottom of the message)
      // marginBottom: '-1px',

      // layout
      display: 'flex',
      flexDirection: 'column',
    }}>

      {optionalTranslationWarning}

      {props.isMessageSelectionMode && (
        <MessagesSelectionHeader
          hasSelected={selectedMessages.size > 0}
          sumTokens={historyTokenCount}
          onClose={() => props.setIsMessageSelectionMode(false)}
          onSelectAll={handleSelectAll}
          onDeleteMessages={handleSelectionDelete}
        />
      )}

      {filteredMessages.map((message, idx, { length: count }) => {

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
              diffPreviousText={message === diffTargetMessage ? diffPrevText : undefined}
              fitScreen={props.fitScreen}
              isBottom={idx === count - 1}
              isImagining={isImagining}
              isSpeaking={isSpeaking}
              onMessageAssistantFrom={handleMessageAssistantFrom}
              onMessageBeam={handleMessageBeam}
              onMessageBranch={handleMessageBranch}
              onMessageDelete={handleMessageDelete}
              onMessageEdit={handleMessageEdit}
              onMessageToggleUserFlag={handleMessageToggleUserFlag}
              onMessageTruncate={handleMessageTruncate}
              // onReplyTo={handleReplyTo}
              onTextDiagram={handleTextDiagram}
              onTextImagine={capabilityHasT2I ? handleTextImagine : undefined}
              onTextSpeak={isSpeakable ? handleTextSpeak : undefined}
            />

          );
        },
      )}

      {!!ephemerals.length && (
        <Ephemerals
          ephemerals={ephemerals}
          conversationId={props.conversationId}
          sx={{
            mt: 'auto',
            overflowY: 'auto',
            minHeight: 64,
          }}
        />
      )}

    </List>
  );
}