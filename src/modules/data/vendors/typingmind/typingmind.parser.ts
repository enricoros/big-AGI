/**
 * Parser for TypingMind export files
 */

import type { ParseResult } from '../vendor.types';
import type { ImportWarning } from '../../data.types';
import { typingMindExportSchema, type TypingMindExport } from './typingmind.schema';


/**
 * Parse a TypingMind export file
 */
export async function parseTypingMindFile(file: File): Promise<ParseResult> {
  const warnings: ImportWarning[] = [];

  try {
    // Read file content
    const fileContent = await file.text();

    // Parse JSON
    let jsonData: any;
    try {
      jsonData = JSON.parse(fileContent);
    } catch (parseError) {
      return {
        success: false,
        data: null,
        warnings: [],
        error: `Invalid JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
      };
    }

    // Validate against schema
    const parseResult = typingMindExportSchema.safeParse(jsonData);

    if (!parseResult.success) {
      return {
        success: false,
        data: null,
        warnings: [],
        error: `Schema validation failed: ${parseResult.error.message}`,
      };
    }

    const data = parseResult.data;

    // Add warnings for optional features
    if (data.data.folders && data.data.folders.length > 0) {
      warnings.push({
        type: 'unsupported-feature',
        message: `Found ${data.data.folders.length} folders - folder structure will be preserved`,
      });
    }

    if (data.data.userPrompts && data.data.userPrompts.length > 0) {
      warnings.push({
        type: 'unsupported-feature',
        message: `Found ${data.data.userPrompts.length} user prompts - these are not yet supported`,
      });
    }

    if (data.data.userCharacters && data.data.userCharacters.length > 0) {
      warnings.push({
        type: 'unsupported-feature',
        message: `Found ${data.data.userCharacters.length} user characters - these are not yet supported`,
      });
    }

    return {
      success: true,
      data,
      warnings,
    };

  } catch (error) {
    return {
      success: false,
      data: null,
      warnings: [],
      error: `Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}


/**
 * Validate that a file appears to be a TypingMind export
 */
export async function validateTypingMindFile(file: File): Promise<boolean> {
  try {
    // Check file extension
    if (!file.name.endsWith('.json')) {
      return false;
    }

    // Check file size (must be reasonable)
    if (file.size === 0 || file.size > 100 * 1024 * 1024) { // Max 100MB
      return false;
    }

    // Quick check: try to parse and look for TypingMind structure
    const content = await file.text();
    const json = JSON.parse(content);

    // Look for TypingMind-specific structure
    return (
      json &&
      typeof json === 'object' &&
      'data' in json &&
      json.data &&
      typeof json.data === 'object' &&
      'chats' in json.data &&
      Array.isArray(json.data.chats)
    );

  } catch {
    return false;
  }
}
