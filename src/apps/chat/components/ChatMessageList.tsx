import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, List } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';

import { DiagramConfig } from '~/modules/aifn/digrams/DiagramsModal';
import { canUseElevenLabs, speakText } from '~/modules/elevenlabs/elevenlabs.client';
import { canUseProdia } from '~/modules/prodia/prodia.client';
import { useChatLLM } from '~/modules/llms/store-llms';

import { createDMessage, DMessage, useChatStore } from '~/common/state/store-chats';
import { openLayoutPreferences } from '~/common/layout/store-applayout';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { ChatMessage } from './message/ChatMessage';
import { CleanerMessage, MessagesSelectionHeader } from './message/CleanerMessage';
import { PersonaSelector } from './persona-selector/PersonaSelector';


/**
 * A list of ChatMessages
 */
export function ChatMessageList(props: {
  conversationId: string | null,
  isMessageSelectionMode: boolean, setIsMessageSelectionMode: (isMessageSelectionMode: boolean) => void,
  onExecuteChatHistory: (conversationId: string, history: DMessage[]) => void,
  onDiagramFromText: (diagramConfig: DiagramConfig | null) => Promise<any>,
  onImagineFromText: (conversationId: string, selectedText: string) => Promise<any>,
  sx?: SxProps
}) {

  // state
  const [isImagining, setIsImagining] = React.useState(false);
  const [isSpeaking, setIsSpeaking] = React.useState(false);
  const [selectedMessages, setSelectedMessages] = React.useState<Set<string>>(new Set());

  // external state
  const showSystemMessages = useUIPreferencesStore(state => state.showSystemMessages);
  const { messages, editMessage, deleteMessage, historyTokenCount } = useChatStore(state => {
    const conversation = state.conversations.find(conversation => conversation.id === props.conversationId);
    return {
      messages: conversation ? conversation.messages : [],
      editMessage: state.editMessage, deleteMessage: state.deleteMessage,
      historyTokenCount: conversation ? conversation.tokenCount : 0,
    };
  }, shallow);
  const { chatLLM } = useChatLLM();
  const isImaginable = canUseProdia();
  const isSpeakable = canUseElevenLabs();


  // text actions

  const handleAppendMessage = (text: string) =>
    props.conversationId && props.onExecuteChatHistory(props.conversationId, [...messages, createDMessage('user', text)]);

  const handleTextDiagram = async (messageId: string, text: string) => {
    if (props.conversationId) {
      await props.onDiagramFromText({ conversationId: props.conversationId, messageId, text });
    } else
      return Promise.reject('No conversation');
  };

  const handleTextImagine = async (text: string) => {
    if (!isImaginable) {
      openLayoutPreferences(2);
    } else if (props.conversationId) {
      setIsImagining(true);
      await props.onImagineFromText(props.conversationId, text);
      setIsImagining(false);
    } else
      return Promise.reject('No conversation');
  };

  const handleTextSpeak = async (text: string) => {
    if (!isSpeakable) {
      openLayoutPreferences(3);
    } else {
      setIsSpeaking(true);
      await speakText(text);
      setIsSpeaking(false);
    }
  };


  // message menu methods proxy

  const handleMessageDelete = (messageId: string) =>
    props.conversationId && deleteMessage(props.conversationId, messageId);

  const handleMessageEdit = (messageId: string, newText: string) =>
    props.conversationId && editMessage(props.conversationId, messageId, { text: newText }, true);

  const handleMessageRestartFrom = (messageId: string, offset: number) => {
    const truncatedHistory = messages.slice(0, messages.findIndex(m => m.id === messageId) + offset + 1);
    props.conversationId && props.onExecuteChatHistory(props.conversationId, truncatedHistory);
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
    return props.conversationId ? (
      <Box sx={props.sx || {}}>
        <PersonaSelector conversationId={props.conversationId} runExample={handleAppendMessage} />
      </Box>
    ) : null;

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
            onMessageDelete={() => handleMessageDelete(message.id)}
            onMessageEdit={newText => handleMessageEdit(message.id, newText)}
            onMessageRunFrom={(offset: number) => handleMessageRestartFrom(message.id, offset)}
            onTextDiagram={(text: string) => handleTextDiagram(message.id, text)}
            onTextImagine={handleTextImagine} onTextSpeak={handleTextSpeak}
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