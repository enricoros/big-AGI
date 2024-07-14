import { z } from 'zod';

// See the latest Anthropic Typescript definitions on:
// https://github.com/anthropics/anthropic-sdk-typescript/blob/main/src/resources/messages.ts


// Content Blocks

const anthropicWire_TextBlock_Schema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

const anthropicWire_ImageBlock_Schema = z.object({
  type: z.literal('image'),
  source: z.object({
    type: z.literal('base64'),
    media_type: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
    data: z.string(),
  }),
});

const anthropicWire_ToolUseBlock_Schema = z.object({
  type: z.literal('tool_use'),
  id: z.string(),
  name: z.string(),
  input: z.unknown(),
});

const anthropicWire_ToolResultBlock_Schema = z.object({
  type: z.literal('tool_result'),
  tool_use_id: z.string(),
  // NOTE: could be a string too, but we force it to be an array for a better implementation
  content: z.array(z.union([anthropicWire_TextBlock_Schema, anthropicWire_ImageBlock_Schema])).optional(),
  is_error: z.boolean().optional(), // default: false
});


export function anthropicWire_TextBlock(text: string): z.infer<typeof anthropicWire_TextBlock_Schema> {
  return { type: 'text', text };
}

export function anthropicWire_ImageBlock(mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', base64: string): z.infer<typeof anthropicWire_ImageBlock_Schema> {
  return { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } };
}

export function anthropicWire_ToolUseBlock(id: string, name: string, input: unknown): z.infer<typeof anthropicWire_ToolUseBlock_Schema> {
  return { type: 'tool_use', id, name, input };
}

export function anthropicWire_ToolResultBlock(tool_use_id: string, content: z.infer<typeof anthropicWire_ToolResultBlock_Schema>['content'], is_error?: boolean): z.infer<typeof anthropicWire_ToolResultBlock_Schema> {
  return { type: 'tool_result', tool_use_id, content: content?.length ? content : undefined, is_error };
}


// Request

const anthropicWire_ContentBlockUL_Schema = z.discriminatedUnion('type', [
  anthropicWire_TextBlock_Schema,
  anthropicWire_ImageBlock_Schema,
  anthropicWire_ToolUseBlock_Schema,
  anthropicWire_ToolResultBlock_Schema,
]);

const anthropicWire_HistoryMessageUL_Schema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.array(anthropicWire_ContentBlockUL_Schema), // NOTE: could be a string, but we force it to be an array
});

const anthropicWire_ToolUL_Schema = z.object({
  name: z.string(),

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
    properties: z.record(z.unknown()).optional(),
    required: z.array(z.string()).optional(),
  }).and(z.record(z.unknown())),
});

export type AnthropicWire_MessageCreate = z.infer<typeof anthropicWire_MessageCreate_Schema>;
export const anthropicWire_MessageCreate_Schema = z.object({
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
  system: z.array(anthropicWire_TextBlock_Schema).optional(),

  /**
   * (required) Input messages. - operates on alternating user and assistant conversational turns - the first message must always use the user role
   * If the final message uses the assistant role, the response content will continue immediately from the content in that message.
   * This can be used to constrain part of the model's response.
   */
  messages: z.array(anthropicWire_HistoryMessageUL_Schema).refine(
    (messages) => {

      // Ensure the first message uses the user role
      if (messages.length === 0 || messages[0].role !== 'user')
        return false;

      // Ensure messages alternate between user and assistant roles
      for (let i = 1; i < messages.length; i++)
        if (messages[i].role === messages[i - 1].role)
          return false;

      return true;
    },
    { message: `messages must alternate between User and Assistant roles, starting with the User role` },
  ),

  /**
   * How the model should use the provided tools. The model can use a specific tool, any available tool, or decide by itself.
   */
  tool_choice: z.union([
    z.object({ type: z.literal('auto') }),
    z.object({ type: z.literal('any') }), // use one at least
    z.object({ type: z.literal('tool'), name: z.string() }),
  ]).optional(),

  /**
   * (optional) Tools that the model can use to generate the response.
   */
  tools: z.array(anthropicWire_ToolUL_Schema).optional(),

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

const anthropicWire_ContentBlockDL_Schema = z.discriminatedUnion('type', [
  anthropicWire_TextBlock_Schema,
  anthropicWire_ToolUseBlock_Schema,
]);

export type AnthropicWire_MessageResponse = z.infer<typeof anthropicWire_MessageResponse_Schema>;
export const anthropicWire_MessageResponse_Schema = z.object({
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
  content: z.array(anthropicWire_ContentBlockDL_Schema),

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
    output_tokens: z.number(),
  }),
});


// Events - Message

export const anthropicWire_MessageStartEvent_Schema = z.object({
  type: z.literal('message_start'),
  message: anthropicWire_MessageResponse_Schema,
});

export const anthropicWire_MessageStopEvent_Schema = z.object({
  type: z.literal('message_stop'),
});

export const anthropicWire_MessageDeltaEvent_Schema = z.object({
  type: z.literal('message_delta'),
  // MessageDelta
  delta: z.object({
    stop_reason: z.enum(['end_turn', 'max_tokens', 'stop_sequence', 'tool_use']).nullable(),
    stop_sequence: z.string().nullable(),
  }),
  // MessageDeltaUsage
  usage: z.object({ output_tokens: z.number() }),
});


// Events - Content Block

export const anthropicWire_ContentBlockStartEvent_Schema = z.object({
  type: z.literal('content_block_start'),
  index: z.number(),
  content_block: anthropicWire_ContentBlockDL_Schema,
});

export const anthropicWire_ContentBlockStopEvent_Schema = z.object({
  type: z.literal('content_block_stop'),
  index: z.number(),
});

export const anthropicWire_ContentBlockDeltaEvent_Schema = z.object({
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
