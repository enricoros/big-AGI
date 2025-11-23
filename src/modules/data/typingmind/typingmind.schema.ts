import * as z from 'zod/v4';

/**
 * TypingMind Export Schema
 *
 * Uses looseObject() to allow optional/unknown fields for forward compatibility.
 * The schema requires minimal fields and parses as much as possible.
 */

// Message content can be either string or array of content blocks
const typingMindMessageContentBlockSchema = z.looseObject({
  type: z.string().optional(),
  text: z.string().optional(),
}).passthrough();

const typingMindMessageContentSchema = z.union([
  z.string(), // Simple string content
  z.array(typingMindMessageContentBlockSchema), // Array of content blocks
]);

// Individual message
export const typingMindMessageSchema = z.looseObject({
  uuid: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: typingMindMessageContentSchema,
  createdAt: z.string().optional(), // ISO timestamp
}).passthrough();

// Chat/Conversation
export const typingMindChatSchema = z.looseObject({
  id: z.string().optional(),
  chatID: z.string(),
  chatTitle: z.string().optional(),
  preview: z.string().optional(),
  createdAt: z.string().optional(), // ISO timestamp
  updatedAt: z.string().optional(), // ISO timestamp
  messages: z.array(typingMindMessageSchema),
  // Other fields we don't use but allow
  folderID: z.string().optional(),
  model: z.string().optional(),
  modelInfo: z.unknown().optional(),
  linkedPlugins: z.unknown().optional(),
  chatParams: z.unknown().optional(),
  selectedMultimodelIDs: z.unknown().optional(),
  tokenUsage: z.unknown().optional(),
}).passthrough();

// Top-level export structure
export const typingMindExportSchema = z.looseObject({
  data: z.looseObject({
    chats: z.array(typingMindChatSchema),
    // Other top-level arrays we don't import
    folders: z.unknown().optional(),
    userPrompts: z.unknown().optional(),
    userCharacters: z.unknown().optional(),
    installedPlugins: z.unknown().optional(),
    promptSettings: z.unknown().optional(),
    characterSettings: z.unknown().optional(),
  }).passthrough(),
}).passthrough();

export type TypingMindExport = z.infer<typeof typingMindExportSchema>;
export type TypingMindChat = z.infer<typeof typingMindChatSchema>;
export type TypingMindMessage = z.infer<typeof typingMindMessageSchema>;
