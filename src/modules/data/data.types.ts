/**
 * Core types for the data import system
 */

import type { DConversation } from '~/common/stores/chat/chat.conversation';


// Import Source

export type ImportSourceId = string;

export interface ImportSource {
  readonly id: ImportSourceId;
  readonly label: string;
  readonly description?: string;
  readonly vendorId: string;
}


// Import Context

export interface ImportContext {
  fileName: string;
  fileSize: number;
  fileHash: string;
  importedAt: number;
  vendorId: string;
}


// Import Result

export interface ImportResult {
  success: boolean;
  conversations: DConversation[];
  warnings: ImportWarning[];
  errors: ImportError[];
  stats: ImportStats;
  context: ImportContext;
}

export interface ImportWarning {
  type: 'unsupported-feature' | 'data-loss' | 'approximation' | 'missing-data';
  message: string;
  details?: string;
  affectedConversationIds?: string[];
}

export interface ImportError {
  type: 'parse-error' | 'validation-error' | 'transform-error' | 'conflict-error';
  message: string;
  details?: string;
  fatal: boolean;
}

export interface ImportStats {
  conversationsImported: number;
  messagesImported: number;
  foldersImported: number;
  charactersImported: number;
  unsupportedItemsSkipped: number;
}


// Conflict Resolution

export type ConflictResolutionStrategy = 'skip' | 'rename' | 'overwrite' | 'merge';

export interface ConflictInfo {
  type: 'conversation-id' | 'folder-id';
  existingId: string;
  proposedId: string;
  resolution: ConflictResolutionStrategy;
}
