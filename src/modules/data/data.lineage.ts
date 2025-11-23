/**
 * Data lineage and provenance tracking for imported conversations
 * Provides import history, re-import detection, and file hash tracking
 */

import type { DConversation } from '~/common/stores/chat/chat.conversation';
import type { ImportContext } from './data.types';


// Lineage metadata stored in conversation metadata

export interface DConversationLineage {
  // Import provenance
  importSource: {
    vendorId: string;          // 'typingmind', 'chatgpt', etc.
    fileName: string;          // Original filename
    fileHash: string;          // SHA-256 hash of the file
    importedAt: number;        // Unix timestamp
  };

  // Re-import tracking
  reimportCount?: number;      // Number of times this was reimported
  lastReimportAt?: number;     // Last reimport timestamp

  // Original IDs (for conflict resolution)
  originalIds?: {
    conversationId?: string;
    chatId?: string;
    folderId?: string;
  };
}


/**
 * Calculate SHA-256 hash of a file
 */
export async function calculateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}


/**
 * Attach lineage metadata to a conversation
 */
export function attachLineage(
  conversation: DConversation,
  context: ImportContext,
  originalId?: string,
): void {
  const lineage: DConversationLineage = {
    importSource: {
      vendorId: context.vendorId,
      fileName: context.fileName,
      fileHash: context.fileHash,
      importedAt: context.importedAt,
    },
  };

  if (originalId) {
    lineage.originalIds = {
      conversationId: originalId,
    };
  }

  // Store in conversation metadata (extending the DConversation type)
  if (!(conversation as any).metadata) {
    (conversation as any).metadata = {};
  }
  (conversation as any).metadata.lineage = lineage;
}


/**
 * Get lineage metadata from a conversation
 */
export function getLineage(conversation: DConversation): DConversationLineage | null {
  return (conversation as any).metadata?.lineage || null;
}


/**
 * Check if a conversation was imported from a specific file hash
 */
export function isFromFile(conversation: DConversation, fileHash: string): boolean {
  const lineage = getLineage(conversation);
  return lineage?.importSource.fileHash === fileHash;
}


/**
 * Detect if this is a re-import of existing conversations
 */
export function detectReimport(
  existingConversations: DConversation[],
  fileHash: string,
): {
  isReimport: boolean;
  existingConversations: DConversation[];
} {
  const matches = existingConversations.filter(c => isFromFile(c, fileHash));
  return {
    isReimport: matches.length > 0,
    existingConversations: matches,
  };
}


/**
 * Update lineage for a re-import
 */
export function updateLineageForReimport(conversation: DConversation): void {
  const lineage = getLineage(conversation);
  if (!lineage) return;

  lineage.reimportCount = (lineage.reimportCount || 0) + 1;
  lineage.lastReimportAt = Date.now();
}
