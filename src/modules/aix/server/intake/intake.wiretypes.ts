import { z } from 'zod';

export namespace IntakeWire_ContentParts {
  export const TextPart_schema = z.object({
    pt: z.literal('text'),
    text: z.string(),
  });

  export const DocPart_schema = z.object({
    pt: z.literal('doc'),
    type: z.enum([
      'application/vnd.agi.ego',
      'application/vnd.agi.ocr',
      'text/html',
      'text/markdown',
      'text/plain',
    ]),
    data: z.object({
      idt: z.literal('text'),
      text: z.string(),
      mimeType: z.string().optional(),
    }),
    ref: z.string(),
  });

  export const InlineImagePart_schema = z.object({
    pt: z.literal('inline_image'),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    base64: z.string(),
  });

  export const MetaReplyToPart_schema = z.object({
    pt: z.literal('meta_reply_to'),
    replyTo: z.string(),
  });

  export const ToolCallPart_schema = z.object({
    pt: z.literal('tool_call'),
    id: z.string(),
    name: z.string(),
    args: z.record(z.any()).optional(),
  });

  export const ToolResponsePart_schema = z.object({
    pt: z.literal('tool_response'),
    id: z.string(),
    name: z.string(),
    response: z.string().optional(),
    isError: z.boolean().optional(),
  });
}

export namespace IntakeWire_Messages {
  export const SystemMessage_schema = z.object({
    parts: z.array(IntakeWire_ContentParts.TextPart_schema),
  });

  export const ChatMessage_schema = z.discriminatedUnion('role', [
    z.object({
      role: z.literal('user'),
      parts: z.array(z.discriminatedUnion('pt', [
        IntakeWire_ContentParts.TextPart_schema,
        IntakeWire_ContentParts.InlineImagePart_schema,
        IntakeWire_ContentParts.DocPart_schema,
        IntakeWire_ContentParts.MetaReplyToPart_schema,
      ])),
    }),
    z.object({
      role: z.literal('model'),
      parts: z.array(z.discriminatedUnion('pt', [
        IntakeWire_ContentParts.TextPart_schema,
        IntakeWire_ContentParts.InlineImagePart_schema,
        IntakeWire_ContentParts.ToolCallPart_schema,
      ])),
    }),
    z.object({
      role: z.literal('tool'),
      parts: z.array(IntakeWire_ContentParts.ToolResponsePart_schema),
    }),
  ]);
}

export namespace IntakeWire_Tools {
  export const OpenAPISchemaObject_schema = z.object({
    type: z.enum(['string', 'number', 'integer', 'boolean', 'array', 'object']),
    description: z.string().optional(),
    nullable: z.boolean().optional(),
    enum: z.array(z.any()).optional(),
    format: z.string().optional(),
    properties: z.record(z.any()).optional(),
    required: z.array(z.string()).optional(),
    items: z.any().optional(),
  });

  export const FunctionCallInputSchema_schema = z.object({
    properties: z.record(OpenAPISchemaObject_schema),
    required: z.array(z.string()).optional(),
  });

  export const FunctionCall_schema = z.object({
    name: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
    description: z.string(),
    input_schema: FunctionCallInputSchema_schema.optional(),
  });

  export const ToolDefinition_schema = z.discriminatedUnion('type', [
    z.object({
      type: z.literal('function_call'),
      function_call: FunctionCall_schema,
    }),
    z.object({
      type: z.literal('gemini_code_interpreter'),
    }),
    z.object({
      type: z.literal('preprocessor'),
      pname: z.literal('anthropic_artifacts'),
    }),
  ]);

  export const ToolsPolicy_schema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('auto') }),
    z.object({ type: z.literal('any') }),
    z.object({
      type: z.literal('function_call'),
      function_call: z.object({ name: z.string() }),
    }),
  ]);
}

export namespace IntakeWire_API_ChatGenerate {
  export const Request_schema = z.object({
    systemMessage: IntakeWire_Messages.SystemMessage_schema.optional(),
    chatSequence: z.array(IntakeWire_Messages.ChatMessage_schema),
    tools: z.array(IntakeWire_Tools.ToolDefinition_schema).optional(),
    toolsPolicy: IntakeWire_Tools.ToolsPolicy_schema.optional(),
  });

  export const ContextChatStream_schema = z.object({
    method: z.literal('chat-stream'),
    name: z.enum(['conversation', 'ai-diagram', 'ai-flattener', 'call', 'beam-scatter', 'beam-gather', 'persona-extract']),
    ref: z.string(),
  });

  // Response schemas would go here
  // For example:
  export const Response_schema = z.object({
    // Define the response structure here
  });
}

export namespace IntakeWire_Events {
  export const IntakeEventProto_schema = z.union([
    z.object({ t: z.string() }),
    z.object({ set: z.object({ model: z.string().optional() }) }),
  ]);

  export const IntakeControlProto_schema = z.object({
    type: z.enum(['start', 'done']),
  });

  export const IntakeErrorProto_schema = z.object({
    issueId: z.enum(['dispatch-prepare', 'dispatch-fetch', 'dispatch-read', 'dispatch-parse']),
    issueText: z.string(),
  });
}