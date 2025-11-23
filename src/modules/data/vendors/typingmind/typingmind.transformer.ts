/**
 * Transform TypingMind data to Big-AGI format
 */

import type { DConversation } from '~/common/stores/chat/chat.conversation';
import type { DMessage, DMessageRole } from '~/common/stores/chat/chat.message';
import type { TransformResult } from '../vendor.types';
import type { ImportWarning } from '../../data.types';
import type { TypingMindExport, TypingMindChat, TypingMindMessage } from './typingmind.schema';

import { createImportedConversation, createImportedMessage, normalizeMessageContent } from '../../pipeline/import.transformer';
import { deduplicateMessages, sortMessagesByTimestamp } from '../../pipeline/import.transformer';


/**
 * Transform TypingMind export to Big-AGI conversations
 */
export async function transformTypingMindToConversations(
  data: TypingMindExport,
): Promise<TransformResult> {
  const warnings: ImportWarning[] = [];
  const unsupportedFeatures: string[] = [];
  const conversations: DConversation[] = [];

  // Track unsupported features
  if (data.data.userPrompts?.length) {
    unsupportedFeatures.push('Custom user prompts');
  }
  if (data.data.userCharacters?.length) {
    unsupportedFeatures.push('User characters/personas');
  }

  // Transform chats
  for (const chat of data.data.chats) {
    try {
      const conversation = transformTypingMindChat(chat, warnings);
      if (conversation && conversation.messages.length > 0) {
        conversations.push(conversation);
      } else {
        warnings.push({
          type: 'data-loss',
          message: `Skipped empty chat: ${chat.chatTitle || chat.chatID}`,
        });
      }
    } catch (error) {
      warnings.push({
        type: 'data-loss',
        message: `Failed to transform chat ${chat.chatID}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  return {
    conversations,
    warnings,
    unsupportedFeatures,
  };
}


/**
 * Transform a single TypingMind chat to a DConversation
 */
function transformTypingMindChat(
  chat: TypingMindChat,
  warnings: ImportWarning[],
): DConversation {
  // Create conversation
  const conversation = createImportedConversation(
    chat.chatTitle || 'Untitled Chat',
    chat.chatID,
    chat.createdAt,
    chat.updatedAt,
  );

  // Transform messages
  const messages: DMessage[] = [];
  for (const tmMessage of chat.messages) {
    try {
      const message = transformTypingMindMessage(tmMessage);
      if (message) {
        messages.push(message);
      }
    } catch (error) {
      warnings.push({
        type: 'data-loss',
        message: `Failed to transform message in chat ${chat.chatID}`,
        affectedConversationIds: [chat.chatID],
      });
    }
  }

  // Deduplicate and sort messages
  conversation.messages = sortMessagesByTimestamp(deduplicateMessages(messages));

  // Store folder reference in metadata if present
  if (chat.folderID) {
    if (!(conversation as any).metadata) {
      (conversation as any).metadata = {};
    }
    (conversation as any).metadata.typingmind = {
      folderId: chat.folderID,
      model: chat.model,
    };
  }

  return conversation;
}


/**
 * Transform a single TypingMind message to a DMessage
 */
function transformTypingMindMessage(tmMessage: TypingMindMessage): DMessage | null {
  // Normalize content
  const content = normalizeMessageContent(tmMessage.content);

  if (!content || content.trim().length === 0) {
    return null;
  }

  // Map role
  const role: DMessageRole = tmMessage.role === 'system'
    ? 'system'
    : tmMessage.role === 'assistant'
      ? 'assistant'
      : 'user';

  // Create message
  const message = createImportedMessage(
    role,
    content,
    tmMessage.uuid,
    tmMessage.createdAt,
  );

  return message;
}


/**
 * Get statistics about the transform
 */
export function getTransformStats(result: TransformResult) {
  const totalMessages = result.conversations.reduce(
    (sum, conv) => sum + conv.messages.length,
    0,
  );

  return {
    conversationsImported: result.conversations.length,
    messagesImported: totalMessages,
    foldersImported: 0, // Not yet supported
    charactersImported: result.conversations.reduce(
      (sum, conv) => sum + conv.messages.reduce(
        (msgSum, msg) => msgSum + msg.fragments.reduce(
          (fragSum, frag) => fragSum + ((frag as any).part?.text?.length || 0),
          0,
        ),
        0,
      ),
      0,
    ),
    unsupportedItemsSkipped: result.unsupportedFeatures.length,
  };
}
