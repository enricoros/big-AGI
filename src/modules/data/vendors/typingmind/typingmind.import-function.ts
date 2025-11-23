/**
 * High-level import function for TypingMind data
 * This is the main entry point for TypingMind imports
 */

import type { ImportResult } from '../../data.types';
import type { ImportOptions } from '../../data.import';
import { importVendorData } from '../../data.import';
import { parseTypingMindFile } from './typingmind.parser';
import { transformTypingMindToConversations } from './typingmind.transformer';


/**
 * Import TypingMind data from a file
 */
export async function importTypingMindData(
  file: File,
  options: ImportOptions = {},
): Promise<ImportResult> {
  return importVendorData(
    file,
    parseTypingMindFile,
    transformTypingMindToConversations,
    'typingmind',
    options,
  );
}
