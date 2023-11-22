import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, List } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';

import { DiagramConfig } from '~/modules/aifn/digrams/DiagramsModal';
import { useChatLLM } from '~/modules/llms/store-llms';

import { ShortcutKeyName, useGlobalShortcut } from '~/common/components/useGlobalShortcut';
import { InlineError } from '~/common/components/InlineError';
import { createDMessage, DConversationId, DMessage, useChatStore } from '~/common/state/store-chats';
import { openLayoutPreferences } from '~/common/layout/store-applayout';
import { useCapabilityElevenLabs, useCapabilityProdia } from '~/common/components/useCapabilities';

import { ChatMessage } from './message/ChatMessage';
import { CleanerMessage, MessagesSelectionHeader } from './message/CleanerMessage';
import { PersonaSelector } from './persona-selector/PersonaSelector';
import { useChatShowSystemMessages } from '../store-app-chat';


/**
 * A list of ChatMessages
 */
export function ChatMessageList(props: {
  conversationId: DConversationId | null,
  isMessageSelectionMode: boolean, setIsMessageSelectionMode: (isMessageSelectionMode: boolean) => void,
  onConversationBranch: (conversationId: DConversationId, messageId: string) => void,
  onConversationExecuteHistory: (conversationId: DConversationId, history: DMessage[]) => void,
  onTextDiagram: (diagramConfig: DiagramConfig | null) => Promise<any>,
  onTextImagine: (conversationId: DConversationId, selectedText: string) => Promise<any>,
  onTextSpeak: (selectedText: string) => Promise<any>,
  sx?: SxProps
}) {

  // state
  const [isImagining, setIsImagining] = React.useState(false);
  const [isSpeaking, setIsSpeaking] = React.useState(false);
  const [selectedMessages, setSelectedMessages] = React.useState<Set<string>>(new Set());

  // external state
  const [showSystemMessages] = useChatShowSystemMessages();
  const { messages, editMessage, deleteMessage, historyTokenCount } = useChatStore(state => {
    const conversation = state.conversations.find(conversation => conversation.id === props.conversationId);
    return {
      messages: conversation ? conversation.messages : [],
      editMessage: state.editMessage, deleteMessage: state.deleteMessage,
      historyTokenCount: conversation ? conversation.tokenCount : 0,
    };
  }, shallow);
  const { chatLLM } = useChatLLM();
  const { mayWork: isImaginable } = useCapabilityProdia();
  const { mayWork: isSpeakable } = useCapabilityElevenLabs();


  // text actions

  const handleRunExample = (text: string) =>
    props.conversationId && props.onConversationExecuteHistory(props.conversationId, [...messages, createDMessage('user', text)]);


  // message menu methods proxy

  const handleConversationBranch = (messageId: string) => {
    props.conversationId && props.onConversationBranch(props.conversationId, messageId);
  };

  const handleConversationRestartFrom = (messageId: string, offset: number) => {
    const truncatedHistory = messages.slice(0, messages.findIndex(m => m.id === messageId) + offset + 1);
    props.conversationId && props.onConversationExecuteHistory(props.conversationId, truncatedHistory);
  };

  const handleMessageDelete = (messageId: string) =>
    props.conversationId && deleteMessage(props.conversationId, messageId);

  const handleMessageEdit = (messageId: string, newText: string) =>
    props.conversationId && editMessage(props.conversationId, messageId, { text: newText }, true);

  const handleTextDiagram = async (messageId: string, text: string) => {
    if (props.conversationId) {
      await props.onTextDiagram({ conversationId: props.conversationId, messageId, text });
    } else
      return Promise.reject('No conversation');
  };

  const handleTextImagine = async (text: string) => {
    if (!isImaginable) {
      openLayoutPreferences(2);
    } else if (props.conversationId) {
      setIsImagining(true);
      await props.onTextImagine(props.conversationId, text);
      setIsImagining(false);
    } else
      return Promise.reject('No conversation');
  };

  const handleTextSpeak = async (text: string) => {
    if (!isSpeakable) {
      openLayoutPreferences(3);
    } else {
      setIsSpeaking(true);
      await props.onTextSpeak(text);
      setIsSpeaking(false);
    }
  };


  // operate on the local selection set

  const handleSelectAll = (selected: boolean) => {
    const newSelected = new Set<string>();
    if (selected)
      for (const message of messages)
        newSelected.add(message.id);
    setSelectedMessages(newSelected);
  };

  const handleSelectMessage = (messageId: string, selected: boolean) => {
    const newSelected = new Set(selectedMessages);
    selected ? newSelected.add(messageId) : newSelected.delete(messageId);
    setSelectedMessages(newSelected);
  };

  const handleSelectionDelete = () => {
    if (props.conversationId)
      for (const selectedMessage of selectedMessages)
        deleteMessage(props.conversationId, selectedMessage);
    setSelectedMessages(new Set());
  };

  useGlobalShortcut(props.isMessageSelectionMode && ShortcutKeyName.Esc, false, false, false, () => {
    props.setIsMessageSelectionMode(false);
  });


  // text-diff functionality, find the messages to diff with

  const { diffMessage, diffText } = React.useMemo(() => {
    const [msgB, msgA] = messages.filter(m => m.role === 'assistant').reverse();
    if (msgB?.text && msgA?.text && !msgB?.typing) {
      const textA = msgA.text, textB = msgB.text;
      const lenA = textA.length, lenB = textB.length;
      if (lenA > 80 && lenB > 80 && lenA > lenB / 3 && lenB > lenA / 3)
        return { diffMessage: msgB, diffText: textA };
    }
    return { diffMessage: undefined, diffText: undefined };
  }, [messages]);

  // no content: show the persona selector

  const filteredMessages = messages
    .filter(m => m.role !== 'system' || showSystemMessages) // hide the System message if the user choses to
    .reverse(); // 'reverse' is because flexDirection: 'column-reverse' to auto-snap-to-bottom

  // when there are no messages, show the purpose selector
  if (!filteredMessages.length)
    return (
      <Box sx={{ ...props.sx }}>
        {props.conversationId
          ? <PersonaSelector conversationId={props.conversationId} runExample={handleRunExample} />
          : <InlineError severity='info' error='Select an active conversation for this window' sx={{ m: 2 }} />}
      </Box>
    );

  return (
    <List sx={{
      p: 0, ...(props.sx || {}),
      // this makes sure that the the window is scrolled to the bottom (column-reverse)
      display: 'flex', flexDirection: 'column-reverse',
      // fix for the double-border on the last message (one by the composer, one to the bottom of the message)
      marginBottom: '-1px',
    }}>

      {filteredMessages.map((message, idx) =>
        props.isMessageSelectionMode ? (

          <CleanerMessage
            key={'sel-' + message.id}
            message={message}
            isBottom={idx === 0} remainingTokens={(chatLLM ? chatLLM.contextTokens : 0) - historyTokenCount}
            selected={selectedMessages.has(message.id)} onToggleSelected={handleSelectMessage}
          />

        ) : (

          <ChatMessage
            key={'msg-' + message.id}
            message={message}
            diffPreviousText={message === diffMessage ? diffText : undefined}
            isBottom={idx === 0}
            isImagining={isImagining} isSpeaking={isSpeaking}
            onConversationBranch={handleConversationBranch}
            onConversationRestartFrom={handleConversationRestartFrom}
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