import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, List } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';

import type { DiagramConfig } from '~/modules/aifn/digrams/DiagramsModal';

import { ShortcutKeyName, useGlobalShortcut } from '~/common/components/useGlobalShortcut';
import { InlineError } from '~/common/components/InlineError';
import { createDMessage, DConversationId, DMessage, getConversation, useChatStore } from '~/common/state/store-chats';
import { openLayoutPreferences } from '~/common/layout/store-applayout';
import { useCapabilityElevenLabs, useCapabilityProdia } from '~/common/components/useCapabilities';

import { ChatMessageMemo } from './message/ChatMessage';
import { CleanerMessage, MessagesSelectionHeader } from './message/CleanerMessage';
import { PersonaSelector } from './persona-selector/PersonaSelector';
import { useChatShowSystemMessages } from '../store-app-chat';


/**
 * A list of ChatMessages
 */
export function ChatMessageList(props: {
  conversationId: DConversationId | null,
  chatLLMContextTokens?: number,
  isMessageSelectionMode: boolean, setIsMessageSelectionMode: (isMessageSelectionMode: boolean) => void,
  onConversationBranch: (conversationId: DConversationId, messageId: string) => void,
  onConversationExecuteHistory: (conversationId: DConversationId, history: DMessage[]) => void,
  onTextDiagram: (diagramConfig: DiagramConfig | null) => Promise<any>,
  onTextImagine: (conversationId: DConversationId, selectedText: string) => Promise<any>,
  onTextSpeak: (selectedText: string) => Promise<any>,
  sx?: SxProps,
}) {

  // state
  const [isImagining, setIsImagining] = React.useState(false);
  const [isSpeaking, setIsSpeaking] = React.useState(false);
  const [selectedMessages, setSelectedMessages] = React.useState<Set<string>>(new Set());

  // external state
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
  const { mayWork: isImaginable } = useCapabilityProdia();
  const { mayWork: isSpeakable } = useCapabilityElevenLabs();

  // derived state
  const { conversationId, onConversationBranch, onConversationExecuteHistory, onTextDiagram, onTextImagine, onTextSpeak } = props;


  // text actions

  const handleRunExample = (text: string) =>
    conversationId && onConversationExecuteHistory(conversationId, [...conversationMessages, createDMessage('user', text)]);


  // message menu methods proxy

  const handleConversationBranch = React.useCallback((messageId: string) => {
    conversationId && onConversationBranch(conversationId, messageId);
  }, [conversationId, onConversationBranch]);

  const handleConversationRestartFrom = React.useCallback((messageId: string, offset: number) => {
    const messages = getConversation(conversationId)?.messages;
    if (messages) {
      const truncatedHistory = messages.slice(0, messages.findIndex(m => m.id === messageId) + offset + 1);
      conversationId && onConversationExecuteHistory(conversationId, truncatedHistory);
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
    conversationId && await onTextDiagram({ conversationId: conversationId, messageId, text });
  }, [conversationId, onTextDiagram]);

  const handleTextImagine = React.useCallback(async (text: string) => {
    if (!isImaginable)
      return openLayoutPreferences(2);
    if (conversationId) {
      setIsImagining(true);
      await onTextImagine(conversationId, text);
      setIsImagining(false);
    }
  }, [conversationId, isImaginable, onTextImagine]);

  const handleTextSpeak = React.useCallback(async (text: string) => {
    if (!isSpeakable)
      return openLayoutPreferences(3);
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

  // no content: show the persona selector

  const filteredMessages = conversationMessages
    .filter(m => m.role !== 'system' || showSystemMessages) // hide the System message if the user choses to
    .reverse(); // 'reverse' is because flexDirection: 'column-reverse' to auto-snap-to-bottom

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
      display: 'flex', flexDirection: 'column-reverse',
      // fix for the double-border on the last message (one by the composer, one to the bottom of the message)
      // marginBottom: '-1px',
    }}>

      {filteredMessages.map((message, idx) =>
        props.isMessageSelectionMode ? (

          <CleanerMessage
            key={'sel-' + message.id}
            message={message}
            isBottom={idx === 0} remainingTokens={(props.chatLLMContextTokens || 0) - historyTokenCount}
            selected={selectedMessages.has(message.id)} onToggleSelected={handleSelectMessage}
          />

        ) : (

          <ChatMessageMemo
            key={'msg-' + message.id}
            message={message}
            diffPreviousText={message === diffMessage ? diffText : undefined}
            isBottom={idx === 0}
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

      {/* Header at the bottom because of 'row-reverse' */}
      {props.isMessageSelectionMode && (
        <MessagesSelectionHeader
          hasSelected={selectedMessages.size > 0}
          isBottom={filteredMessages.length === 0}
          sumTokens={historyTokenCount}
          onClose={() => props.setIsMessageSelectionMode(false)}
          onSelectAll={handleSelectAll}
          onDeleteMessages={handleSelectionDelete}
        />
      )}

    </List>
  );
}