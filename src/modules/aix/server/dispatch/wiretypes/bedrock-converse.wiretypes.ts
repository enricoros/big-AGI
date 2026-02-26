import * as z from 'zod/v4';


/**
 * AWS Bedrock Converse API wire types.
 *
 * Reference: https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html
 *            https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ConverseStream.html
 *
 * Supports: text, images, tool use/results. Leaves out: audio, video, reasoningConfig, guardrails.
 */


// --- Content Blocks ---

export namespace BedrockConverseWire_Blocks {

  export const TextBlock_schema = z.object({
    text: z.string(),
  });

  export const ImageBlock_schema = z.object({
    image: z.object({
      format: z.enum(['png', 'jpeg', 'gif', 'webp']),
      source: z.object({
        bytes: z.string(), // base64-encoded
      }),
    }),
  });

  export const ToolUseBlock_schema = z.object({
    toolUse: z.object({
      toolUseId: z.string(),
      name: z.string(),
      input: z.any(), // JSON object
    }),
  });

  export const ToolResultBlock_schema = z.object({
    toolResult: z.object({
      toolUseId: z.string(),
      content: z.array(z.union([
        TextBlock_schema,
        ImageBlock_schema,
      ])),
      status: z.enum(['success', 'error']).optional(),
    }),
  });

  /** Union of all content block types for messages */
  export const ContentBlock_schema = z.union([
    TextBlock_schema,
    ImageBlock_schema,
    ToolUseBlock_schema,
    ToolResultBlock_schema,
  ]);

}


// --- Messages ---

export namespace BedrockConverseWire_Messages {

  export const Message_schema = z.object({
    role: z.enum(['user', 'assistant']),
    content: z.array(BedrockConverseWire_Blocks.ContentBlock_schema),
  });

}


// --- API Request/Response ---

export namespace BedrockConverseWire_API {

  // System content (text-only)
  const SystemContent_schema = BedrockConverseWire_Blocks.TextBlock_schema;

  // Inference configuration
  const InferenceConfig_schema = z.object({
    maxTokens: z.number().optional(),
    temperature: z.number().optional(),
    topP: z.number().optional(),
    // stopSequences: z.array(z.string()).optional(),
  });

  // Tool configuration
  const ToolConfig_schema = z.object({
    tools: z.array(z.object({
      toolSpec: z.object({
        name: z.string(),
        description: z.string().optional(),
        inputSchema: z.object({
          json: z.any(), // JSON Schema object
        }),
      }),
    })),
    toolChoice: z.union([
      z.object({ auto: z.object({}) }),
      z.object({ any: z.object({}) }),
      z.object({ tool: z.object({ name: z.string() }) }),
    ]).optional(),
  });

  /// Request

  export type Request = z.infer<typeof Request_schema>;
  export const Request_schema = z.object({
    system: z.array(SystemContent_schema).optional(),
    messages: z.array(BedrockConverseWire_Messages.Message_schema),
    inferenceConfig: InferenceConfig_schema.optional(),
    toolConfig: ToolConfig_schema.optional(),
  });


  /// Non-Streaming Response

  const _ResponseUsage_schema = z.object({
    inputTokens: z.number(),
    outputTokens: z.number(),
    totalTokens: z.number().optional(),
    // cacheDetails: ...
    cacheReadInputTokens: z.number().optional(),
    cacheWriteInputTokens: z.number().optional(),
  });

  const _ResponseMetrics_schema = z.object({
    latencyMs: z.number(),
  });

  export type Response = z.infer<typeof Response_schema>;
  export const Response_schema = z.object({
    output: z.object({
      message: BedrockConverseWire_Messages.Message_schema,
    }),
    stopReason: z.enum(['end_turn', 'tool_use', 'max_tokens', 'stop_sequence', 'guardrail_intervened', 'content_filtered']).or(z.string()),
    usage: _ResponseUsage_schema,
    metrics: _ResponseMetrics_schema.optional(),
  });


  /// Streaming Events

  export const event_MessageStart_schema = z.object({
    role: z.string(),
  });

  const _event_ContentBlockBase_schema = z.object({
    contentBlockIndex: z.number(),
  });

  export const event_ContentBlockStart_schema = _event_ContentBlockBase_schema.extend({
    start: z.union([
      z.object({ toolUse: z.object({ toolUseId: z.string(), name: z.string() }) }),
      z.object({}), // text blocks have empty start
    ]),
  });

  export const event_ContentBlockDelta_schema = _event_ContentBlockBase_schema.extend({
    delta: z.union([
      z.object({ text: z.string() }),
      z.object({ toolUse: z.object({ input: z.string() }) }),
    ]),
  });

  export const event_ContentBlockStop_schema = _event_ContentBlockBase_schema;

  export const event_MessageStop_schema = z.object({
    stopReason: z.enum(['end_turn', 'tool_use', 'max_tokens', 'stop_sequence', 'guardrail_intervened', 'content_filtered']).or(z.string()),
  });

  export const event_Metadata_schema = z.object({
    usage: _ResponseUsage_schema,
    metrics: _ResponseMetrics_schema.optional(),
  });

}
