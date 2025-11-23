import { TRPCError } from '@trpc/server';

import { typingMindExportSchema, TypingMindExport } from './typingmind.schema';

/**
 * Parse and validate a TypingMind export JSON string
 */
export function parseTypingMindExport(jsonString: string): TypingMindExport {
  // Parse JSON
  let jsonObject: unknown;
  try {
    jsonObject = JSON.parse(jsonString);
  } catch (error: any) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Invalid JSON: ${error?.message || 'Parse error'}`,
    });
  }

  // Validate with Zod schema
  const result = typingMindExportSchema.safeParse(jsonObject);
  if (!result.success) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Invalid TypingMind export format: ${result.error.message}`,
    });
  }

  return result.data;
}

/**
 * Extract text content from TypingMind message content
 * Handles both string and array formats
 */
export function extractMessageText(content: string | Array<{ type?: string; text?: string }>): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map(block => block.text || '')
      .filter(text => text.length > 0)
      .join('\n');
  }

  return '';
}
