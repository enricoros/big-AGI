import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, List } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';

import type { DiagramConfig } from '~/modules/aifn/digrams/DiagramsModal';

import { InlineError } from '~/common/components/InlineError';
import { PreferencesTab, useOptimaLayout } from '~/common/layout/optima/useOptimaLayout';
import { ShortcutKeyName, useGlobalShortcut } from '~/common/components/useGlobalShortcut';
import { createDMessage, DConversationId, DMessage, getConversation, useChatStore } from '~/common/state/store-chats';
import { useCapabilityElevenLabs } from '~/common/components/useCapabilities';

import { ChatMessage, ChatMessageMemo } from './message/ChatMessage';
import { CleanerMessage, MessagesSelectionHeader } from './message/CleanerMessage';
import { PersonaSelector } from './persona-selector/PersonaSelector';
import { useChatShowSystemMessages } from '../store-app-chat';
import { useScrollToBottom } from './scroll-to-bottom/useScrollToBottom';


/**
 * A list of ChatMessages
 */
export function ChatMessageList(props: {
  conversationId: DConversationId | null,
  capabilityHasT2I: boolean,
  chatLLMContextTokens: number | null,
  isMessageSelectionMode: boolean,
  isMobile: boolean,
  onConversationBranch: (conversationId: DConversationId, messageId: string) => void,
  onConversationExecuteHistory: (conversationId: DConversationId, history: DMessage[], chatEffectBestOf: boolean) => Promise<void>,
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
  const { conversationMessages, historyTokenCount, editMessage, deleteMessage, setMessages } = useChatStore(state => {
    const conversation = state.conversations.find(conversation => conversation.id === props.conversationId);
    return {
      conversationMessages: conversation ? conversation.messages : [],
      historyTokenCount: conversation ? conversation.tokenCount : 0,
      deleteMessage: state.deleteMessage,
      editMessage: state.editMessage,
      setMessages: state.setMessages,
    };
  }, shallow);
  const { mayWork: isSpeakable } = useCapabilityElevenLabs();

  // derived state
  const { conversationId, capabilityHasT2I, onConversationBranch, onConversationExecuteHistory, onTextDiagram, onTextImagine, onTextSpeak } = props;


  // text actions

  const handleRunExample = React.useCallback(async (text: string) => {
    conversationId && await onConversationExecuteHistory(conversationId, [...conversationMessages, createDMessage('user', text)], false);
  }, [conversationId, conversationMessages, onConversationExecuteHistory]);


  // message menu methods proxy

  const handleConversationBranch = React.useCallback((messageId: string) => {
    conversationId && onConversationBranch(conversationId, messageId);
  }, [conversationId, onConversationBranch]);

  const handleConversationRestartFrom = React.useCallback(async (messageId: string, offset: number, chatEffectBestOf: boolean) => {
    const messages = getConversation(conversationId)?.messages;
    if (messages) {
      const truncatedHistory = messages.slice(0, messages.findIndex(m => m.id === messageId) + offset + 1);
      conversationId && await onConversationExecuteHistory(conversationId, truncatedHistory, chatEffectBestOf);
    }
  }, [conversationId, onConversationExecuteHistory]);

  const handleConversationTruncate = React.useCallback((messageId: string) => {
    const messages = getConversation(conversationId)?.messages;
    if (conversationId && messages) {
      const truncatedHistory = messages.slice(0, messages.findIndex(m => m.id === messageId) + 1);
      setMessages(conversationId, truncatedHistory);
    }
  }, [conversationId, setMessages]);

  const handleMessageDelete = React.useCallback((messageId: string) => {
    conversationId && deleteMessage(conversationId, messageId);
  }, [conversationId, deleteMessage]);

  const handleMessageEdit = React.useCallback((messageId: string, newText: string) => {
    conversationId && editMessage(conversationId, messageId, { text: newText }, true);
  }, [conversationId, editMessage]);

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


  // text-diff functionality: only diff the last message and when it's complete (not typing), and they're similar in size

  const { diffTargetMessage, diffPrevText } = React.useMemo(() => {
    const [msgB, msgA] = conversationMessages.filter(m => m.role === 'assistant').reverse();
    if (msgB?.text && msgA?.text && !msgB?.typing) {
      const textA = msgA.text, textB = msgB.text;
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
      p: 0, ...(props.sx || {}),
      // this makes sure that the the window is scrolled to the bottom (column-reverse)
      display: 'flex',
      flexDirection: 'column',
      // fix for the double-border on the last message (one by the composer, one to the bottom of the message)
      // marginBottom: '-1px',
    }}>

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

          // Optimization: if the component is going to change (e.g. the message is typing), we don't want to memoize it to not throw garbage in memory
          const ChatMessageMemoOrNot = message.typing ? ChatMessage : ChatMessageMemo;

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
              isBottom={idx === count - 1}
              isImagining={isImagining}
              isMobile={props.isMobile}
              isSpeaking={isSpeaking}
              onConversationBranch={handleConversationBranch}
              onConversationRestartFrom={handleConversationRestartFrom}
              onConversationTruncate={handleConversationTruncate}
              onMessageDelete={handleMessageDelete}
              onMessageEdit={handleMessageEdit}
              onTextDiagram={handleTextDiagram}
              onTextImagine={handleTextImagine}
              onTextSpeak={handleTextSpeak}
            />

          );
        },
      )}

    </List>
  );
}