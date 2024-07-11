import { z } from 'zod';


// Export types
export type IntakeInlineImagePart = z.infer<typeof intakeInlineImagePartSchema>;
export type IntakeMetaReplyToPart = z.infer<typeof intakeMetaReplyToPartSchema>;
export type IntakeSystemMessage = z.infer<typeof intakeSystemMessageSchema>;
export type IntakeChatMessage = z.infer<typeof intakeChatMessageSchema>;


// Parts: mirror the Typescript definitions from the frontend-side

const dMessageDataInlineSchema = z.object({
  idt: z.literal('text'),
  text: z.string(),
  mimeType: z.string().optional(),
});

const dMessageTextPartSchema = z.object({
  pt: z.literal('text'),
  text: z.string(),
});

const dMessageDocPartSchema = z.object({
  pt: z.literal('doc'),

  type: z.enum([
    'application/vnd.agi.ego',
    'application/vnd.agi.ocr',
    'text/html',
    'text/markdown',
    'text/plain',
  ]),

  data: dMessageDataInlineSchema,

  // id of the document, to be known to the model
  ref: z.string(),

  // meta: ignored...
});

const dMessageToolCallPartSchema = z.object({
  pt: z.literal('tool_call'),
  id: z.string(),
  name: z.string(),
  args: z.record(z.any()).optional(),
});

const dMessageToolResponsePartSchema = z.object({
  pt: z.literal('tool_response'),
  id: z.string(),
  name: z.string(),
  response: z.string().optional(),
  isError: z.boolean().optional(),
});


const intakeInlineImagePartSchema = z.object({
  pt: z.literal('inline_image'),
  /**
   * The MIME type of the image.
   * Only using the types supported by all, while the following are supported only by a subset:
   * - image/gif: Anthropic, OpenAI
   * - image/heic, image/heif: Gemini
   */
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  base64: z.string(),
});

/* Gemini-only
const intakeInlineAudioPartSchema = z.object({
  pt: z.literal('inline_audio'),
  mimeType: z.enum(['audio/wav', 'audio/mp3', 'audio/aiff', 'audio/aac', 'audio/ogg', 'audio/flac']),
  base64: z.string(),
});*/

const intakeMetaReplyToPartSchema = z.object({
  pt: z.literal('meta_reply_to'),
  replyTo: z.string(),
});


// Messagges

export const intakeSystemMessageSchema = z.object({
  parts: z.array(dMessageTextPartSchema),
});

export const intakeChatMessageSchema = z.discriminatedUnion('role', [

  // User
  z.object({
    role: z.literal('user'),
    parts: z.array(z.discriminatedUnion('pt', [
      dMessageTextPartSchema, intakeInlineImagePartSchema, dMessageDocPartSchema, intakeMetaReplyToPartSchema,
    ])),
  }),

  // Model
  z.object({
    role: z.literal('model'),
    parts: z.array(z.discriminatedUnion('pt', [
      dMessageTextPartSchema, intakeInlineImagePartSchema, dMessageToolCallPartSchema,
    ])),
  }),

  // Tool
  z.object({
    role: z.literal('tool'),
    parts: z.array(dMessageToolResponsePartSchema),
  }),

]);
