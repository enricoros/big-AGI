import { z } from 'zod';


/**
 * See the latest Anthropic Typescript definitions on:
 * https://github.com/anthropics/anthropic-sdk-typescript/blob/main/src/resources/messages.ts
 *
 * ## Updates
 *
 * ### 2024-10-22
 * - ToolDefinition: added 'cache_control' and 'type' fields
 * - Request.tool_choice: added 'disable_parallel_tool_use'
 * - Request.messages: removed refine() as the sequence can now be not-alternating and starting from non-user
 *
 */
export namespace AnthropicWire_Blocks {

  /// Content parts - Input and Output

  export const _CacheControl_schema = z.object({
    type: z.literal('ephemeral'),
  });

  const _CommonBlock_schema = z.object({
    cache_control: _CacheControl_schema.optional(),
  });

  export const TextBlock_schema = _CommonBlock_schema.extend({
    type: z.literal('text'),
    text: z.string(),
  });

  export const ImageBlock_schema = _CommonBlock_schema.extend({
    type: z.literal('image'),
    source: z.object({
      type: z.literal('base64'),
      media_type: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
      data: z.string(),
    }),
  });

  export const ToolUseBlock_schema = _CommonBlock_schema.extend({
    type: z.literal('tool_use'),
    id: z.string(),
    name: z.string(),
    input: z.any(), // NOTE: formally an 'object', not any, probably relaxed for parsing
  });

  export const ToolResultBlock_schema = _CommonBlock_schema.extend({
    type: z.literal('tool_result'),
    tool_use_id: z.string(),
    // NOTE: could be a string too, but we force it to be an array for a better implementation
    content: z.array(z.union([TextBlock_schema, ImageBlock_schema])).optional(),
    is_error: z.boolean().optional(), // default: false
  });

  export function TextBlock(text: string): z.infer<typeof TextBlock_schema> {
    return { type: 'text', text };
  }

  export function ImageBlock(mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', base64: string): z.infer<typeof ImageBlock_schema> {
    return { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } };
  }

  export function ToolUseBlock(id: string, name: string, input: string | null): z.infer<typeof ToolUseBlock_schema> {
    // Anthropic Tool Invocations want the input as object, and will reject 'null' inputs for instance.
    // - ".input: Input should be a valid dictionary" - Anthropic
    // - ".input: Field required" - Anthropic
    // -> we replace 'null' and '', with {}
    return { type: 'tool_use', id, name, input: !input ? {} : JSON.parse(input) /* 2024-11-03: Anthropic requires an object in 'input' */ };
  }

  export function ToolResultBlock(tool_use_id: string, content: z.infer<typeof ToolResultBlock_schema>['content'], is_error?: boolean): z.infer<typeof ToolResultBlock_schema> {
    return { type: 'tool_result', tool_use_id, content: content?.length ? content : undefined, is_error };
  }

  export function blockSetCacheControl(block: z.infer<typeof _CommonBlock_schema>, cacheControl: z.infer<typeof _CacheControl_schema>['type']): void {
    block.cache_control = { type: cacheControl };
  }

}

export namespace AnthropicWire_Messages {

  const _ContentBlockInput_schema = z.discriminatedUnion('type', [
    AnthropicWire_Blocks.TextBlock_schema,
    AnthropicWire_Blocks.ImageBlock_schema,
    AnthropicWire_Blocks.ToolUseBlock_schema,
    AnthropicWire_Blocks.ToolResultBlock_schema,
  ]);

  export const MessageInput_schema = z.object({
    role: z.enum(['user', 'assistant']),
    content: z.array(_ContentBlockInput_schema), // NOTE: could be a string, but we force it to be an array
  });

  export const ContentBlockOutput_schema = z.discriminatedUnion('type', [
    AnthropicWire_Blocks.TextBlock_schema,
    AnthropicWire_Blocks.ToolUseBlock_schema,
  ]);

}

export namespace AnthropicWire_Tools {

  const _ToolDefinitionBase_schema = z.object({
    /** This is how the tool will be called by the model and in tool_use blocks. */
    name: z.string(),

    /** 2024-10-22: cache-control can be set on the Tools block as well. We could make use of this instead of the System Instruction blocks for prompts with longer tools. */
    cache_control: AnthropicWire_Blocks._CacheControl_schema.optional(),
  });

  const _CustomToolDefinition_schema = _ToolDefinitionBase_schema.extend({
    /**
     * Client defined tool (non-built-in).
     * Note: we force the value to be 'custom' although the API would allow for undefined or null as well. For ease
     *       of development, we force the value to be 'custom' to use a discriminating union.
     */
    type: z.literal('custom'),  // .nullable().optional() // see note above

    /**
     * Description of what this tool does. Tool descriptions should be as detailed as possible.
     * The more information that the model has about what the tool is and how to use it, the better it will perform.
     * @see aixFunctionCallSchema
     */
    description: z.string().optional(),

    /**
     * [JSON schema](https://json-schema.org/) for this tool's input.
     *
     * This defines the shape of the `input` that your tool accepts and that the model will provide.
     */
    input_schema: z.object({
      type: z.literal('object'),
      properties: z.record(z.unknown()).nullable(),
      required: z.array(z.string()).optional(),
    }).and(z.record(z.unknown())),
  });

  const _ComputerUseTool_20241022_schema = _ToolDefinitionBase_schema.extend({
    type: z.enum(['computer_20241022']),
    name: z.literal('computer'),

    // tool configuration
    display_height_px: z.number().int(),
    display_width_px: z.number().int(),
    display_number: z.number().int().nullable().optional(),
  });

  const _BashTool_20241022_schema = _ToolDefinitionBase_schema.extend({
    type: z.enum(['bash_20241022']),
    name: z.literal('bash'),
  });

  const _TextEditor_20241022_schema = _ToolDefinitionBase_schema.extend({
    type: z.enum(['text_editor_20241022']),
    name: z.literal('str_replace_editor'),
  });

  export const ToolDefinition_schema = z.discriminatedUnion('type', [
    _CustomToolDefinition_schema,
    _ComputerUseTool_20241022_schema,
    _BashTool_20241022_schema,
    _TextEditor_20241022_schema,
  ]);

}


//
// Messages > Create
//
export namespace AnthropicWire_API_Message_Create {

  /// Request

  export type Request = z.infer<typeof Request_schema>;
  export const Request_schema = z.object({
    /**
     * (required) The maximum number of tokens to generate before stopping.
     */
    max_tokens: z.number(),

    /**
     * (required) The model to use for generating the response.
     * See [models](https://docs.anthropic.com/en/docs/models-overview) for additional details and options.
     */
    model: z.string(),

    /**
     * If you want to include a system prompt, you can use the top-level system parameter — there is no "system" role for input messages in the Messages API.
     */
    system: z.array(AnthropicWire_Blocks.TextBlock_schema).optional(),

    /**
     * (required) Input messages. - operates on alternating user and assistant conversational turns - the first message must always use the user role
     * If the final message uses the assistant role, the response content will continue immediately from the content in that message.
     * This can be used to constrain part of the model's response.
     */
    messages: z.array(AnthropicWire_Messages.MessageInput_schema),
    // 2024-10-22: Removed the refine() method, as this is not a requirement anymore for the API, since October 8th, 2024
    // .refine(
    //   (messages) => {
    //
    //     // Ensure the first message uses the user role
    //     if (messages.length === 0 || messages[0].role !== 'user')
    //       return false;
    //
    //     // Ensure messages alternate between user and assistant roles
    //     for (let i = 1; i < messages.length; i++)
    //       if (messages[i].role === messages[i - 1].role)
    //         return false;
    //
    //     return true;
    //   },
    //   { message: `messages must alternate between User and Assistant roles, starting with the User role` },
    // ),

    /**
     * How the model should use the provided tools. The model can use a specific tool, any available tool, or decide by itself.
     */
    tool_choice: z.union([
      z.object({ type: z.literal('auto'), disable_parallel_tool_use: z.boolean().optional() }),
      z.object({ type: z.literal('any'), disable_parallel_tool_use: z.boolean().optional() }),
      z.object({ type: z.literal('tool'), name: z.string(), disable_parallel_tool_use: z.boolean().optional() }),
    ]).optional(),

    /**
     * (optional) Tools that the model can use to generate the response.
     */
    tools: z.array(AnthropicWire_Tools.ToolDefinition_schema).optional(),

    /**
     * (optional) Metadata to include with the request.
     * user_id: This should be a uuid, hash value, or other opaque identifier.
     */
    metadata: z.object({
      user_id: z.string().optional(),
    }).optional(),

    /**
     * Custom text sequences that will cause the model to stop generating.
     */
    stop_sequences: z.array(z.string()).optional(),

    /**
     * Whether to incrementally stream the response using server-sent events. Default: false
     */
    stream: z.boolean().optional(),


    /**
     * Defaults to 1.0. Ranges from 0.0 to 1.0. Use temperature closer to 0.0 for analytical / multiple choice, and closer to 1.0 for creative and generative tasks.
     */
    temperature: z.number().optional(),

    /**
     * Only sample from the top K options for each subsequent token.
     * Recommended for advanced use cases only. You usually only need to use `temperature`.
     */
    top_k: z.number().optional(),

    /**
     * Use nucleus sampling.
     * Recommended for advanced use cases only. You usually only need to use `temperature`.
     * */
    top_p: z.number().optional(),
  });

  /// Response

  export type Response = z.infer<typeof Response_schema>;
  export const Response_schema = z.object({
    // Unique object identifier.
    id: z.string(),

    // For Messages, this is always "message".
    type: z.literal('message'),
    // Conversational role of the generated message. This will always be "assistant".
    role: z.literal('assistant'),
    // The model that handled the request.
    model: z.string(),

    /**
     * Content generated by the model.
     * This is an array of content blocks, each of which has a type that determines its shape. Currently, the only type in responses is "text".
     */
    content: z.array(AnthropicWire_Messages.ContentBlockOutput_schema),

    /**
     * This may be one the following values:
     *
     * "end_turn": the model reached a natural stopping point
     * "max_tokens": we exceeded the requested max_tokens or the model's maximum
     * "stop_sequence": one of your provided custom stop_sequences was generated
     * Note that these values are different than those in /v1/complete, where end_turn and stop_sequence were not differentiated.
     *
     * In non-streaming mode this value is always non-null. In streaming mode, it is null in the message_start event and non-null otherwise.
     */
    stop_reason: z.enum(['end_turn', 'max_tokens', 'stop_sequence', 'tool_use']).nullable(),
    // Which custom stop sequence was generated, if any.
    stop_sequence: z.string().nullable(),

    // Billing and rate-limit usage.
    usage: z.object({
      input_tokens: z.number(),
      cache_creation_input_tokens: z.number().optional(),
      cache_read_input_tokens: z.number().optional(),
      output_tokens: z.number(),
    }),
  });

  /// Streaming Response

  export const event_MessageStart_schema = z.object({
    type: z.literal('message_start'),
    message: Response_schema,
  });

  export const event_MessageStop_schema = z.object({
    type: z.literal('message_stop'),
  });

  export const event_MessageDelta_schema = z.object({
    type: z.literal('message_delta'),
    // MessageDelta
    delta: z.object({
      stop_reason: z.enum(['end_turn', 'max_tokens', 'stop_sequence', 'tool_use']).nullable(),
      stop_sequence: z.string().nullable(),
    }),
    // MessageDeltaUsage
    usage: z.object({ output_tokens: z.number() }),
  });

  export const event_ContentBlockStart_schema = z.object({
    type: z.literal('content_block_start'),
    index: z.number(),
    content_block: AnthropicWire_Messages.ContentBlockOutput_schema,
  });

  export const event_ContentBlockStop_schema = z.object({
    type: z.literal('content_block_stop'),
    index: z.number(),
  });

  export const event_ContentBlockDelta_schema = z.object({
    type: z.literal('content_block_delta'),
    index: z.number(),
    delta: z.union([
      z.object({
        type: z.literal('text_delta'),
        text: z.string(),
      }),
      z.object({
        type: z.literal('input_json_delta'),
        partial_json: z.string(),
      }),
    ]),
  });

}
