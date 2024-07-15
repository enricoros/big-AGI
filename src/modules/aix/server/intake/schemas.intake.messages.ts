import { z } from 'zod';


// Export types
export type Intake_DocPart = z.infer<typeof dMessage_DocPart_schema>;
export type Intake_InlineImagePart = z.infer<typeof intake_InlineImagePart_schema>;
export type Intake_MetaReplyToPart = z.infer<typeof intake_MetaReplyToPart_schema>;
export type Intake_ChatMessage = z.infer<typeof intake_ChatMessage_schema>;
export type Intake_SystemMessage = z.infer<typeof intake_SystemMessage_schema>;


// Parts: mirror the Typescript definitions from the frontend-side

const dMessage_DataInline_schema = z.object({
  idt: z.literal('text'),
  text: z.string(),
  mimeType: z.string().optional(),
});

const dMessage_TextPart_schema = z.object({
  pt: z.literal('text'),
  text: z.string(),
});

const dMessage_DocPart_schema = z.object({
  pt: z.literal('doc'),

  type: z.enum([
    'application/vnd.agi.ego',
    'application/vnd.agi.ocr',
    'text/html',
    'text/markdown',
    'text/plain',
  ]),

  data: dMessage_DataInline_schema,

  // id of the document, to be known to the model
  ref: z.string(),

  // meta: ignored...
});

const dMessage_ToolCallPart_schema = z.object({
  pt: z.literal('tool_call'),
  id: z.string(),
  name: z.string(),
  args: z.record(z.any()).optional(), // flat key-value pairs object
});

const dMessage_ToolResponsePart_schema = z.object({
  pt: z.literal('tool_response'),
  id: z.string(),
  name: z.string(),
  response: z.string().optional(),
  isError: z.boolean().optional(),
});


const intake_InlineImagePart_schema = z.object({
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

const intake_MetaReplyToPart_schema = z.object({
  pt: z.literal('meta_reply_to'),
  replyTo: z.string(),
});


// Messagges

export const intake_SystemMessage_schema = z.object({
  parts: z.array(dMessage_TextPart_schema),
});

export const intake_ChatMessage_schema = z.discriminatedUnion('role', [

  // User
  z.object({
    role: z.literal('user'),
    parts: z.array(z.discriminatedUnion('pt', [
      dMessage_TextPart_schema, intake_InlineImagePart_schema, dMessage_DocPart_schema, intake_MetaReplyToPart_schema,
    ])),
  }),

  // Model
  z.object({
    role: z.literal('model'),
    parts: z.array(z.discriminatedUnion('pt', [
      dMessage_TextPart_schema, intake_InlineImagePart_schema, dMessage_ToolCallPart_schema,
    ])),
  }),

  // Tool
  z.object({
    role: z.literal('tool'),
    parts: z.array(dMessage_ToolResponsePart_schema),
  }),

]);
