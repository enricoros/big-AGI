/**
 * Conflict resolution for imports
 * Handles ID conflicts and provides resolution strategies
 */

import { agiUuid } from '~/common/util/idUtils';
import type { DConversation } from '~/common/stores/chat/chat.conversation';
import type { ConflictInfo, ConflictResolutionStrategy } from '../data.types';


/**
 * Detect conflicts between imported and existing conversations
 */
export function detectConflicts(
  importedConversations: DConversation[],
  existingConversations: DConversation[],
): ConflictInfo[] {
  const conflicts: ConflictInfo[] = [];
  const existingIds = new Set(existingConversations.map(c => c.id));

  for (const imported of importedConversations) {
    if (existingIds.has(imported.id)) {
      conflicts.push({
        type: 'conversation-id',
        existingId: imported.id,
        proposedId: imported.id,
        resolution: 'rename', // Default strategy
      });
    }
  }

  return conflicts;
}


/**
 * Resolve conflicts using the specified strategy
 */
export function resolveConflicts(
  importedConversations: DConversation[],
  conflicts: ConflictInfo[],
  strategy: ConflictResolutionStrategy = 'rename',
): DConversation[] {
  if (conflicts.length === 0) {
    return importedConversations;
  }

  const conflictMap = new Map(conflicts.map(c => [c.existingId, c]));

  return importedConversations.map(conversation => {
    const conflict = conflictMap.get(conversation.id);

    if (!conflict) {
      return conversation;
    }

    switch (strategy) {
      case 'rename':
        return {
          ...conversation,
          id: agiUuid('chat-dconversation'),
          autoTitle: conversation.autoTitle
            ? `${conversation.autoTitle} (imported)`
            : conversation.userTitle
              ? `${conversation.userTitle} (imported)`
              : 'Imported conversation',
        };

      case 'skip':
        // Mark for filtering later
        return null as any;

      case 'overwrite':
        // Keep the original ID, will overwrite
        return conversation;

      case 'merge':
        // For now, same as rename
        // TODO: Implement actual merge logic
        return {
          ...conversation,
          id: agiUuid('chat-dconversation'),
        };

      default:
        return conversation;
    }
  }).filter(Boolean);
}


/**
 * Check if a conversation ID already exists
 */
export function hasConflict(
  conversationId: string,
  existingConversations: DConversation[],
): boolean {
  return existingConversations.some(c => c.id === conversationId);
}


/**
 * Generate a safe ID that doesn't conflict
 */
export function generateSafeId(
  existingConversations: DConversation[],
): string {
  const existingIds = new Set(existingConversations.map(c => c.id));
  let newId: string;
  let attempts = 0;

  do {
    newId = agiUuid('chat-dconversation');
    attempts++;
  } while (existingIds.has(newId) && attempts < 100);

  return newId;
}


/**
 * Resolve all conversation ID conflicts by renaming
 */
export function resolveAllConflictsByRename(
  importedConversations: DConversation[],
  existingConversations: DConversation[],
): DConversation[] {
  const existingIds = new Set(existingConversations.map(c => c.id));

  return importedConversations.map(conversation => {
    if (existingIds.has(conversation.id)) {
      return {
        ...conversation,
        id: generateSafeId(existingConversations),
        autoTitle: conversation.autoTitle
          ? `${conversation.autoTitle} (imported)`
          : 'Imported conversation',
      };
    }
    return conversation;
  });
}
