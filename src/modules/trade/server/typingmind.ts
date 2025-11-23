import { TRPCError } from '@trpc/server';
import * as z from 'zod/v4';


// TypingMind Message Content Schema
const typingMindContentBlockSchema = z.object({
  type: z.string(), // 'text', 'image_url', etc.
  text: z.string().optional(),
  image_url: z.object({
    url: z.string(),
  }).optional(),
}).passthrough(); // allow extra fields for future compatibility

// TypingMind Message Schema
const typingMindMessageSchema = z.object({
  uuid: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.union([
    z.string(), // sometimes it's just a string
    z.array(typingMindContentBlockSchema), // or array of content blocks
  ]),
  createdAt: z.string(), // ISO timestamp
  model: z.string().optional(),
  usage: z.object({
    prompt_tokens: z.number().optional(),
    completion_tokens: z.number().optional(),
    total_tokens: z.number().optional(),
  }).passthrough().optional(),
}).passthrough();

// TypingMind Chat Schema
const typingMindChatSchema = z.object({
  chatID: z.string(),
  chatTitle: z.string().optional(),
  messages: z.array(typingMindMessageSchema),
  createdAt: z.string(), // ISO timestamp
  updatedAt: z.string(), // ISO timestamp
  model: z.string().optional(),
  folderID: z.string().optional(),
}).passthrough();

// TypingMind Folder Schema (for context, but not imported)
const typingMindFolderSchema = z.object({
  id: z.string(),
  title: z.string(),
}).passthrough();

// Top-level export schema
export const typingMindExportSchema = z.object({
  data: z.object({
    chats: z.array(typingMindChatSchema),
    folders: z.array(typingMindFolderSchema).optional(),
    // other fields like userPrompts, userCharacters, etc. are ignored
  }).passthrough(),
}).passthrough();

export type TypingMindExportSchema = z.infer<typeof typingMindExportSchema>;
export type TypingMindChatSchema = z.infer<typeof typingMindChatSchema>;
export type TypingMindMessageSchema = z.infer<typeof typingMindMessageSchema>;


/**
 * Parse and validate TypingMind export JSON
 */
export function typingMindParseExport(jsonContent: string): TypingMindExportSchema {
  let jsonObject: unknown;
  try {
    jsonObject = JSON.parse(jsonContent);
  } catch (error: any) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Failed to parse JSON: ${error?.message}`,
    });
  }

  // validate with relaxed schema (passthrough allows extra fields)
  const safeJson = typingMindExportSchema.safeParse(jsonObject);
  if (!safeJson.success) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Invalid TypingMind export format: ${safeJson.error.message}`,
    });
  }

  return safeJson.data;
}


/**
 * Extract text from message content (handles both string and array formats)
 */
export function extractMessageText(content: string | z.infer<typeof typingMindContentBlockSchema>[]): string {
  if (typeof content === 'string') {
    return content;
  }

  // array of content blocks
  return content
    .map(block => {
      if (block.text) return block.text;
      if (block.image_url?.url) return `[Image: ${block.image_url.url}]`;
      return '';
    })
    .filter(Boolean)
    .join('\n');
}


/**
 * Detect image/attachment references in message content
 */
export function detectAttachmentReferences(content: string | z.infer<typeof typingMindContentBlockSchema>[]): string[] {
  const urls: string[] = [];

  if (typeof content === 'string') {
    // scan for markdown image syntax or URLs
    const imageRegex = /!\[.*?\]\((https?:\/\/[^\)]+)\)/g;
    const urlRegex = /https?:\/\/[^\s]+\.(png|jpg|jpeg|gif|webp|pdf|doc|docx)/gi;
    let match;
    while ((match = imageRegex.exec(content)) !== null) {
      urls.push(match[1]);
    }
    while ((match = urlRegex.exec(content)) !== null) {
      urls.push(match[0]);
    }
  } else {
    // array of content blocks
    content.forEach(block => {
      if (block.image_url?.url) {
        urls.push(block.image_url.url);
      }
    });
  }

  return urls;
}
