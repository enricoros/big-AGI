/**
 * Base types for data import vendors
 */

import type { DConversation } from '~/common/stores/chat/chat.conversation';
import type { ImportResult, ImportWarning } from '../data.types';


/**
 * Vendor ID - unique identifier for each import source
 */
export type VendorId = 'typingmind' | 'chatgpt' | 'bigagi';


/**
 * Base interface for all data import vendors
 */
export interface IDataVendor {
  // Vendor metadata
  readonly id: VendorId;
  readonly label: string;
  readonly description: string;

  // Capabilities
  readonly capabilities: {
    supportsFiles: boolean;
    supportsUrl: boolean;
    supportsText: boolean;
  };

  // File validation
  validateFile?(file: File): Promise<boolean>;

  // Parse and transform
  parseFile(file: File): Promise<ParseResult>;
  transformToConversations(parsedData: any): Promise<TransformResult>;

  // Optional: validate source data before transformation
  validateSource?(data: any): ValidationResult;
}


/**
 * Result of parsing a file
 */
export interface ParseResult {
  success: boolean;
  data: any;
  warnings: ImportWarning[];
  error?: string;
}


/**
 * Result of transforming parsed data to conversations
 */
export interface TransformResult {
  conversations: DConversation[];
  warnings: ImportWarning[];
  unsupportedFeatures: string[];
}


/**
 * Result of validating source data
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
