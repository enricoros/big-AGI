/**
 * Zod schemas for TypingMind export format
 * Using relaxed parsing with .passthrough() to allow schema evolution
 */

import * as z from 'zod/v4';


/**
 * Message content part (text, image, etc.)
 */
const typingMindContentPartSchema = z.object({
  type: z.string(),
  text: z.string().optional(),
  image_url: z.any().optional(),
}).passthrough();


/**
 * Message schema
 * Content can be either a string or an array of content parts
 */
const typingMindMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.union([
    z.string(),
    z.array(typingMindContentPartSchema),
  ]),
  uuid: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
}).passthrough();


/**
 * Chat/Conversation schema
 */
const typingMindChatSchema = z.object({
  chatID: z.string(),
  chatTitle: z.string().optional(),
  messages: z.array(typingMindMessageSchema),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  folderID: z.string().optional(),
  model: z.string().optional(),
}).passthrough();


/**
 * Folder schema
 */
const typingMindFolderSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().optional(),
  createdAt: z.string().optional(),
  parentID: z.string().optional(),
}).passthrough();


/**
 * User prompt schema (custom instructions)
 */
const typingMindUserPromptSchema = z.object({
  id: z.string(),
  name: z.string(),
  prompt: z.string(),
  createdAt: z.string().optional(),
}).passthrough();


/**
 * User character schema (personas)
 */
const typingMindUserCharacterSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  prompt: z.string().optional(),
  createdAt: z.string().optional(),
}).passthrough();


/**
 * Main TypingMind export schema
 */
export const typingMindExportSchema = z.object({
  data: z.object({
    chats: z.array(typingMindChatSchema),
    folders: z.array(typingMindFolderSchema).optional(),
    userPrompts: z.array(typingMindUserPromptSchema).optional(),
    userCharacters: z.array(typingMindUserCharacterSchema).optional(),
  }).passthrough(),
}).passthrough();


/**
 * TypeScript types inferred from schemas
 */
export type TypingMindExport = z.infer<typeof typingMindExportSchema>;
export type TypingMindChat = z.infer<typeof typingMindChatSchema>;
export type TypingMindMessage = z.infer<typeof typingMindMessageSchema>;
export type TypingMindFolder = z.infer<typeof typingMindFolderSchema>;
export type TypingMindUserPrompt = z.infer<typeof typingMindUserPromptSchema>;
export type TypingMindUserCharacter = z.infer<typeof typingMindUserCharacterSchema>;
