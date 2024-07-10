import { z } from 'zod';


// Export types
// export type AixSystemMessage = z.infer<typeof aixSystemMessageSchema>;
// export type AixChatMessage = z.infer<typeof aixChatMessageSchema>;


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
  function: z.string(),
  args: z.record(z.any()),
});

const dMessageToolResponsePartSchema = z.object({
  pt: z.literal('tool_response'),
  function: z.string(),
  response: z.record(z.any()),
});


const aixInlineImagePartSchema = z.object({
  pt: z.literal('inline_image'),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  base64: z.string(),
});

const aixMetaReplyToPartSchema = z.object({
  pt: z.literal('meta_reply_to'),
  replyTo: z.string(),
});


// Messagges

export const aixSystemMessageSchema = z.object({
  parts: z.array(dMessageTextPartSchema),
});

export const aixChatMessageSchema = z.discriminatedUnion('role', [

  // User
  z.object({
    role: z.literal('user'),
    parts: z.array(z.discriminatedUnion('pt', [
      dMessageTextPartSchema, aixInlineImagePartSchema, dMessageDocPartSchema, aixMetaReplyToPartSchema,
    ])),
  }),

  // Model
  z.object({
    role: z.literal('model'),
    parts: z.array(z.discriminatedUnion('pt', [
      dMessageTextPartSchema, dMessageToolCallPartSchema,
    ])),
  }),

  // Tool
  z.object({
    role: z.literal('tool'),
    parts: z.array(dMessageToolResponsePartSchema),
  }),

]);
