/**
 * Validation utilities for imported data
 */

import type { DConversation } from '~/common/stores/chat/chat.conversation';
import type { DMessage } from '~/common/stores/chat/chat.message';
import type { ImportError, ImportWarning } from '../data.types';


export interface ValidationResult {
  valid: boolean;
  errors: ImportError[];
  warnings: ImportWarning[];
}


/**
 * Validate a conversation structure
 */
export function validateConversation(conversation: DConversation): ValidationResult {
  const errors: ImportError[] = [];
  const warnings: ImportWarning[] = [];

  // Required fields
  if (!conversation.id) {
    errors.push({
      type: 'validation-error',
      message: 'Conversation missing required ID',
      fatal: true,
    });
  }

  if (!conversation.messages) {
    errors.push({
      type: 'validation-error',
      message: 'Conversation missing messages array',
      fatal: true,
    });
  }

  // Validate timestamps
  if (conversation.created && (conversation.created < 0 || !Number.isFinite(conversation.created))) {
    warnings.push({
      type: 'data-loss',
      message: 'Invalid created timestamp, using current time',
      affectedConversationIds: [conversation.id],
    });
  }

  // Validate messages
  if (conversation.messages && Array.isArray(conversation.messages)) {
    for (let i = 0; i < conversation.messages.length; i++) {
      const messageResult = validateMessage(conversation.messages[i], i);
      errors.push(...messageResult.errors);
      warnings.push(...messageResult.warnings);
    }
  }

  return {
    valid: errors.filter(e => e.fatal).length === 0,
    errors,
    warnings,
  };
}


/**
 * Validate a message structure
 */
export function validateMessage(message: DMessage, index: number): ValidationResult {
  const errors: ImportError[] = [];
  const warnings: ImportWarning[] = [];

  // Required fields
  if (!message.id) {
    errors.push({
      type: 'validation-error',
      message: `Message at index ${index} missing required ID`,
      fatal: true,
    });
  }

  if (!message.role || !['user', 'assistant', 'system'].includes(message.role)) {
    errors.push({
      type: 'validation-error',
      message: `Message at index ${index} has invalid role: ${message.role}`,
      fatal: true,
    });
  }

  if (!message.fragments || !Array.isArray(message.fragments)) {
    errors.push({
      type: 'validation-error',
      message: `Message at index ${index} missing fragments array`,
      fatal: true,
    });
  }

  // Validate timestamps
  if (message.created && (message.created < 0 || !Number.isFinite(message.created))) {
    warnings.push({
      type: 'data-loss',
      message: `Message at index ${index} has invalid created timestamp`,
    });
  }

  return {
    valid: errors.filter(e => e.fatal).length === 0,
    errors,
    warnings,
  };
}


/**
 * Validate all conversations in a batch
 */
export function validateConversations(conversations: DConversation[]): ValidationResult {
  const allErrors: ImportError[] = [];
  const allWarnings: ImportWarning[] = [];

  for (const conversation of conversations) {
    const result = validateConversation(conversation);
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  }

  return {
    valid: allErrors.filter(e => e.fatal).length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}


/**
 * Sanitize and repair a conversation to make it valid
 */
export function sanitizeConversation(conversation: DConversation): DConversation {
  // Ensure required fields
  if (!conversation.id) {
    conversation.id = `imported-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  if (!conversation.messages) {
    conversation.messages = [];
  }

  if (!conversation.created || conversation.created < 0) {
    conversation.created = Date.now();
  }

  if (!conversation.updated) {
    conversation.updated = conversation.created;
  }

  if (typeof conversation.tokenCount !== 'number') {
    conversation.tokenCount = 0;
  }

  // Sanitize messages
  conversation.messages = conversation.messages
    .map((msg, index) => sanitizeMessage(msg, index))
    .filter(msg => msg !== null) as DMessage[];

  return conversation;
}


/**
 * Sanitize and repair a message to make it valid
 */
function sanitizeMessage(message: DMessage, index: number): DMessage | null {
  // Skip messages with fatal errors
  if (!message || typeof message !== 'object') {
    return null;
  }

  // Ensure required fields
  if (!message.id) {
    message.id = `imported-msg-${Date.now()}-${index}`;
  }

  if (!message.role || !['user', 'assistant', 'system'].includes(message.role)) {
    message.role = 'user'; // Default to user
  }

  if (!message.fragments || !Array.isArray(message.fragments)) {
    message.fragments = [];
  }

  if (!message.created || message.created < 0) {
    message.created = Date.now();
  }

  if (typeof message.tokenCount !== 'number') {
    message.tokenCount = 0;
  }

  return message;
}
