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

import { ChatMessageMemo } from './message/ChatMessage';
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
  isMessageSelectionMode: boolean, setIsMessageSelectionMode: (isMessageSelectionMode: boolean) => void,
  onConversationBranch: (conversationId: DConversationId, messageId: string) => void,
  onConversationExecuteHistory: (conversationId: DConversationId, history: DMessage[]) => Promise<void>,
  onTextDiagram: (diagramConfig: DiagramConfig | null) => void,
  onTextImagine: (conversationId: DConversationId, selectedText: string) => Promise<void>,
  onTextSpeak: (selectedText: string) => Promise<void>,
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
    conversationId && await onConversationExecuteHistory(conversationId, [...conversationMessages, createDMessage('user', text)]);
  }, [conversationId, conversationMessages, onConversationExecuteHistory]);


  // message menu methods proxy

  const handleConversationBranch = React.useCallback((messageId: string) => {
    conversationId && onConversationBranch(conversationId, messageId);
  }, [conversationId, onConversationBranch]);

  const handleConversationRestartFrom = React.useCallback(async (messageId: string, offset: number) => {
    const messages = getConversation(conversationId)?.messages;
    if (messages) {
      const truncatedHistory = messages.slice(0, messages.findIndex(m => m.id === messageId) + offset + 1);
      conversationId && await onConversationExecuteHistory(conversationId, truncatedHistory);
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


  // text-diff functionality, find the messages to diff with

  const { diffMessage, diffText } = React.useMemo(() => {
    const [msgB, msgA] = conversationMessages.filter(m => m.role === 'assistant').reverse();
    if (msgB?.text && msgA?.text && !msgB?.typing) {
      const textA = msgA.text, textB = msgB.text;
      const lenA = textA.length, lenB = textB.length;
      if (lenA > 80 && lenB > 80 && lenA > lenB / 3 && lenB > lenA / 3)
        return { diffMessage: msgB, diffText: textA };
    }
    return { diffMessage: undefined, diffText: undefined };
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

      {filteredMessages.map((message, idx, { length: count }) =>
        props.isMessageSelectionMode ? (

          <CleanerMessage
            key={'sel-' + message.id}
            message={message}
            remainingTokens={props.chatLLMContextTokens ? (props.chatLLMContextTokens - historyTokenCount) : undefined}
            selected={selectedMessages.has(message.id)} onToggleSelected={handleSelectMessage}
          />

        ) : (

          <ChatMessageMemo
            key={'msg-' + message.id}
            message={message}
            diffPreviousText={message === diffMessage ? diffText : undefined}
            isBottom={idx === count - 1}
            isImagining={isImagining} isSpeaking={isSpeaking}
            onConversationBranch={handleConversationBranch}
            onConversationRestartFrom={handleConversationRestartFrom}
            onConversationTruncate={handleConversationTruncate}
            onMessageDelete={handleMessageDelete}
            onMessageEdit={handleMessageEdit}
            onTextDiagram={handleTextDiagram}
            onTextImagine={handleTextImagine}
            onTextSpeak={handleTextSpeak}
          />

        ),
      )}

    </List>
  );
}