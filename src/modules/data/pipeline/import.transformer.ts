/**
 * Transform utilities for converting vendor data to Big-AGI format
 */

import { agiUuid } from '~/common/util/idUtils';
import { createTextContentFragment } from '~/common/stores/chat/chat.fragments';
import type { DMessage, DMessageRole } from '~/common/stores/chat/chat.message';
import type { DConversation } from '~/common/stores/chat/chat.conversation';
import { defaultSystemPurposeId } from '../../../data';


/**
 * Convert ISO timestamp string to Unix milliseconds
 */
export function isoToUnixMs(isoString: string | number): number {
  if (typeof isoString === 'number') {
    // Already a number - check if it's seconds or milliseconds
    return isoString < 10000000000 ? isoString * 1000 : isoString;
  }

  try {
    const timestamp = new Date(isoString).getTime();
    return Number.isFinite(timestamp) ? timestamp : Date.now();
  } catch {
    return Date.now();
  }
}


/**
 * Normalize message content to text string
 * Handles both string and array formats
 */
export function normalizeMessageContent(content: unknown): string {
  // Already a string
  if (typeof content === 'string') {
    return content;
  }

  // Array of content parts
  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          return String(part.text);
        }
        if (part && typeof part === 'object' && 'type' in part && part.type === 'text' && 'text' in part) {
          return String(part.text);
        }
        return '';
      })
      .filter(text => text.length > 0)
      .join('\n\n');
  }

  // Unknown format
  return '';
}


/**
 * Create a DMessage from basic components
 */
export function createImportedMessage(
  role: DMessageRole,
  content: string,
  originalId?: string,
  createdAt?: string | number,
): DMessage {
  const message: DMessage = {
    id: originalId || agiUuid('chat-dmessage'),
    role,
    fragments: [createTextContentFragment(content)],
    tokenCount: 0,
    created: createdAt ? isoToUnixMs(createdAt) : Date.now(),
    updated: null,
  };

  return message;
}


/**
 * Create an empty DConversation with defaults
 */
export function createImportedConversation(
  title?: string,
  originalId?: string,
  createdAt?: string | number,
  updatedAt?: string | number,
): DConversation {
  const now = Date.now();

  const conversation: DConversation = {
    id: originalId || agiUuid('chat-dconversation'),
    messages: [],
    systemPurposeId: defaultSystemPurposeId,
    tokenCount: 0,
    created: createdAt ? isoToUnixMs(createdAt) : now,
    updated: updatedAt ? isoToUnixMs(updatedAt) : now,
    _abortController: null,
  };

  if (title) {
    conversation.autoTitle = title;
  }

  return conversation;
}


/**
 * Generate a unique ID that won't conflict with existing IDs
 */
export function generateNonConflictingId(
  existingIds: Set<string>,
  prefix: string = 'imported',
): string {
  let attempt = 0;
  let newId: string;

  do {
    newId = attempt === 0
      ? agiUuid('chat-dconversation')
      : `${prefix}-${Date.now()}-${attempt}`;
    attempt++;
  } while (existingIds.has(newId) && attempt < 100);

  if (attempt >= 100) {
    // Fallback: use timestamp + random
    newId = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  return newId;
}


/**
 * Deduplicate messages by ID, keeping first occurrence
 */
export function deduplicateMessages(messages: DMessage[]): DMessage[] {
  const seen = new Set<string>();
  return messages.filter(msg => {
    if (seen.has(msg.id)) {
      return false;
    }
    seen.add(msg.id);
    return true;
  });
}


/**
 * Sort messages by creation timestamp
 */
export function sortMessagesByTimestamp(messages: DMessage[]): DMessage[] {
  return [...messages].sort((a, b) => a.created - b.created);
}
