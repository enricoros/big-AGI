import { TRPCError } from '@trpc/server';
import * as z from 'zod/v4';


/**
 * TypingMind Message Content Block
 * Can be a text block or other types (images, etc.)
 */
const typingMindContentBlockSchema = z.looseObject({
  type: z.string().optional(), // 'text', etc.
  text: z.string().optional(),
});

/**
 * TypingMind Message
 * Messages can have content as string OR array of content blocks
 */
const typingMindMessageSchema = z.looseObject({
  uuid: z.string().optional(),
  role: z.enum(['user', 'assistant', 'system', 'tool']).optional(),
  content: z.union([
    z.string(), // Simple string format
    z.array(typingMindContentBlockSchema), // Array of content blocks
  ]).optional(),
  createdAt: z.string().optional(), // ISO timestamp
  model: z.string().optional(),
  usage: z.any().optional(),
});

/**
 * TypingMind Chat/Conversation
 */
const typingMindChatSchema = z.looseObject({
  id: z.string().optional(),
  chatID: z.string().optional(),
  chatTitle: z.string().optional(),
  preview: z.string().optional(),
  createdAt: z.string().optional(), // ISO timestamp
  updatedAt: z.string().optional(), // ISO timestamp
  messages: z.array(typingMindMessageSchema).optional(),
  model: z.string().optional(),
  folderID: z.string().optional(),
  // Allow all other fields (plugins, settings, etc.)
});

/**
 * TypingMind Export Format
 * Top-level structure contains data object with various collections
 */
export const typingMindExportSchema = z.looseObject({
  data: z.looseObject({
    chats: z.array(typingMindChatSchema).optional(),
    folders: z.array(z.any()).optional(), // Not imported
    userPrompts: z.array(z.any()).optional(), // Not imported
    userCharacters: z.array(z.any()).optional(), // Not imported
    installedPlugins: z.array(z.any()).optional(), // Not imported
    // Allow all other fields
  }).optional(),
});

export type TypingMindExportSchema = z.infer<typeof typingMindExportSchema>;
export type TypingMindChatSchema = z.infer<typeof typingMindChatSchema>;
export type TypingMindMessageSchema = z.infer<typeof typingMindMessageSchema>;


/**
 * Extract text content from a TypingMind message
 * Handles both string content and array of content blocks
 */
export function extractMessageText(content: string | Array<{ type?: string; text?: string }> | undefined): string {
  if (!content) return '';

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


/**
 * Parse and validate a TypingMind export JSON
 */
export function typingMindParseExport(jsonString: string): TypingMindExportSchema {
  // Parse the string to JSON
  let jsonObject: unknown;
  try {
    jsonObject = JSON.parse(jsonString);
  } catch (error: any) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Failed to parse JSON: ${error?.message}`,
    });
  }

  // Validate the JSON object
  const safeJson = typingMindExportSchema.safeParse(jsonObject);
  if (!safeJson.success) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Invalid TypingMind export format: ${safeJson.error.message}`,
    });
  }

  return safeJson.data;
}
