/**
 * Validator for TypingMind source data
 */

import type { ValidationResult } from '../vendor.types';
import type { TypingMindExport } from './typingmind.schema';


/**
 * Validate TypingMind source data before transformation
 */
export function validateTypingMindSource(data: TypingMindExport): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required structure
  if (!data.data) {
    errors.push('Missing data object');
    return { valid: false, errors, warnings };
  }

  if (!data.data.chats || !Array.isArray(data.data.chats)) {
    errors.push('Missing or invalid chats array');
    return { valid: false, errors, warnings };
  }

  // Check if empty
  if (data.data.chats.length === 0) {
    warnings.push('No chats found in export');
  }

  // Validate individual chats
  for (let i = 0; i < data.data.chats.length; i++) {
    const chat = data.data.chats[i];

    if (!chat.chatID) {
      errors.push(`Chat at index ${i} is missing chatID`);
    }

    if (!chat.messages || !Array.isArray(chat.messages)) {
      errors.push(`Chat ${chat.chatID || i} has invalid messages array`);
      continue;
    }

    if (chat.messages.length === 0) {
      warnings.push(`Chat ${chat.chatTitle || chat.chatID} is empty`);
    }

    // Validate messages
    for (let j = 0; j < chat.messages.length; j++) {
      const message = chat.messages[j];

      if (!message.role) {
        errors.push(`Message ${j} in chat ${chat.chatID} is missing role`);
      }

      if (!message.content) {
        warnings.push(`Message ${j} in chat ${chat.chatID} has empty content`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
