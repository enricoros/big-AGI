/**
 * TypingMind importer - main vendor implementation
 */

import type { IDataVendor, ParseResult, TransformResult, ValidationResult } from '../vendor.types';
import type { TypingMindExport } from './typingmind.schema';

import { parseTypingMindFile, validateTypingMindFile } from './typingmind.parser';
import { transformTypingMindToConversations } from './typingmind.transformer';
import { validateTypingMindSource } from './typingmind.validator';


/**
 * TypingMind data import vendor
 */
export const TypingMindImporter: IDataVendor = {
  id: 'typingmind',
  label: 'TypingMind',
  description: 'Import conversations from TypingMind export files',

  capabilities: {
    supportsFiles: true,
    supportsUrl: false,
    supportsText: false,
  },

  async validateFile(file: File): Promise<boolean> {
    return validateTypingMindFile(file);
  },

  async parseFile(file: File): Promise<ParseResult> {
    return parseTypingMindFile(file);
  },

  async transformToConversations(parsedData: TypingMindExport): Promise<TransformResult> {
    return transformTypingMindToConversations(parsedData);
  },

  validateSource(data: TypingMindExport): ValidationResult {
    return validateTypingMindSource(data);
  },
};
