import { createDConversation, DConversation } from '~/common/stores/chat/chat.conversation';
import { createDMessageTextContent, DMessage } from '~/common/stores/chat/chat.message';

import { TypingMindChat, TypingMindMessage } from './typingmind.schema';
import { extractMessageText } from './typingmind.parser';

/**
 * Convert TypingMind chat to DConversation
 */
export function convertTypingMindChatToConversation(chat: TypingMindChat): DConversation {
  const conversation = createDConversation();

  // Use the original chat ID
  conversation.id = chat.chatID;

  // Set title
  if (chat.chatTitle) {
    conversation.autoTitle = chat.chatTitle;
  } else if (chat.preview) {
    conversation.autoTitle = chat.preview;
  }

  // Set timestamps - convert ISO strings to Unix milliseconds
  if (chat.createdAt) {
    const createdDate = new Date(chat.createdAt);
    if (!isNaN(createdDate.getTime())) {
      conversation.created = createdDate.getTime();
    }
  }

  if (chat.updatedAt) {
    const updatedDate = new Date(chat.updatedAt);
    if (!isNaN(updatedDate.getTime())) {
      conversation.updated = updatedDate.getTime();
    }
  }

  // Convert messages
  conversation.messages = chat.messages
    .map(msg => convertTypingMindMessageToDMessage(msg))
    .filter((msg): msg is DMessage => msg !== null);

  return conversation;
}

/**
 * Convert TypingMind message to DMessage
 */
function convertTypingMindMessageToDMessage(message: TypingMindMessage): DMessage | null {
  // Extract text content
  const text = extractMessageText(message.content);
  if (!text || text.length === 0) {
    return null;
  }

  // Only support user and assistant roles
  if (message.role !== 'user' && message.role !== 'assistant') {
    return null;
  }

  // Create message
  const dMessage = createDMessageTextContent(message.role, text);

  // Use original UUID
  dMessage.id = message.uuid;

  // Set timestamp
  if (message.createdAt) {
    const createdDate = new Date(message.createdAt);
    if (!isNaN(createdDate.getTime())) {
      dMessage.created = createdDate.getTime();
    }
  }

  return dMessage;
}
