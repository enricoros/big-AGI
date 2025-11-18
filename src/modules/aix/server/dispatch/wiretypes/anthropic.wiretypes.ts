import * as z from 'zod/v4';


/**
 * See the latest Anthropic Typescript definitions on:
 * - https://github.com/anthropics/anthropic-sdk-typescript/blob/main/src/resources/messages/messages.ts
 * For the latest Beta flags:
 * - https://raw.githubusercontent.com/anthropics/anthropic-sdk-typescript/refs/heads/main/src/resources/beta/beta.ts
 * - or blame: https://github.com/anthropics/anthropic-sdk-python/blame/main/src/anthropic/types/anthropic_beta_param.py
 *
 * ## Updates
 *
 * ### 2025-10-17 - MAJOR: Server Tools & 2025 API Additions
 * - ContentBlockOutput: added 9 new server tool response block types
 * - ToolDefinition: added 9 new 2025 tool types (web_search, web_fetch, memory, code_execution, etc.)
 * - Aligned all block types with official OpenAPI spec
 * - Unified common blocks (TextBlock, ThinkingBlock, RedactedThinkingBlock, Citations)
 * - Separated input-only blocks with _I suffix (ImageBlock, DocumentBlock, SearchResultBlock, ToolResultBlock)
 * - Note: cache_control is input-only and never appears in response blocks
 *
 * ### 2024-10-22
 * - ToolDefinition: added 'cache_control' and 'type' fields
 * - Request.tool_choice: added 'disable_parallel_tool_use'
 * - Request.messages: removed refine() as the sequence can now be not-alternating and starting from non-user
 *
 */
export namespace AnthropicWire_Blocks {

  /// Common Schemas

  export const _CacheControl_schema = z.object({
    type: z.literal('ephemeral'),
    ttl: z.union([z.enum(['5m', '1h']), z.string()]).optional(), // default: '5m',
  });

  /**
   * Base schema for blocks that can have cache_control.
   * Note: cache_control is INPUT-ONLY and never appears in response blocks.
   */
  const _CommonBlock_schema = z.object({
    cache_control: _CacheControl_schema.optional(),
  });

  /** Citations schema used in both input and output. Output includes a file_id field for document citations, which input will omit. */
  export const _TextBlockCitations_schema = z.discriminatedUnion('type', [
    // PDF citation (page location)
    z.object({
      type: z.literal('page_location'),
      cited_text: z.string(),
      document_index: z.number(),
      document_title: z.string().nullish(),
      start_page_number: z.number(),
      end_page_number: z.number(),
      file_id: z.string().nullish(), // Present in response only
    }),
    // Plain text citation (character location)
    z.object({
      type: z.literal('char_location'),
      cited_text: z.string(),
      document_index: z.number(),
      document_title: z.string().nullish(),
      start_char_index: z.number(),
      end_char_index: z.number(),
      file_id: z.string().nullish(), // Present in response only
    }),
    // Content block citation (content document results)
    z.object({
      type: z.literal('content_block_location'),
      cited_text: z.string(),
      document_index: z.number(),
      document_title: z.string().nullish(),
      start_block_index: z.number(),
      end_block_index: z.number(),
      file_id: z.string().nullish(), // Present in response only
    }),
    // Web search result citation - produced by the hosted web_search tool
    z.object({
      type: z.literal('web_search_result_location'),
      cited_text: z.string(),
      encrypted_index: z.string(),
      title: z.string().nullish(), // max len: 512
      url: z.string(),
    }),
    // Search result citation
    z.object({
      type: z.literal('search_result_location'),
      cited_text: z.string(),
      search_result_index: z.number(),
      source: z.string(),
      title: z.string().nullish(),
      start_block_index: z.number(),
      end_block_index: z.number(),
    }),
  ]);


  /// Common Blocks (used in both input and output)

  /** TextBlock - Used in both input and output. Different min/max length, and no cache_control on output, but too important to split */
  export const TextBlock_schema = _CommonBlock_schema.extend({
    type: z.literal('text'),
    text: z.string(), // minLength is 1 for requests, 0 for responses. max for responses is 5000000 - we keep this forward compatible
    citations: z.array(_TextBlockCitations_schema).nullish(), // nullish is okay for I/O
  });

  export const ThinkingBlock_schema = z.object({
    type: z.literal('thinking'),
    thinking: z.string(),
    signature: z.string().optional(),
  });

  export const RedactedThinkingBlock_schema = z.object({
    type: z.literal('redacted_thinking'),
    data: z.string(),
  });

  export const ToolUseBlock_schema = _CommonBlock_schema.extend({
    type: z.literal('tool_use'),
    id: z.string(),
    name: z.string(), // length: 1-64
    input: z.any(), // Formally an 'object', but relaxed for robust parsing, and code-enforced
  });


  /// Input-Only Blocks

  /** ImageBlock - INPUT ONLY. Never appears in output content blocks. */
  export const ImageBlock_I_schema = _CommonBlock_schema.extend({
    type: z.literal('image'),
    source: z.discriminatedUnion('type', [
      z.object({
        type: z.literal('base64'),
        media_type: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
        data: z.string(),
      }),
      z.object({
        type: z.literal('url'),
        url: z.string(),
      }),
      z.object({
        type: z.literal('file'),
        file_id: z.string(),
      }),
    ]),
  });

  /**
   * DocumentBlock - INPUT ONLY as a top-level content block.
   * NOTE: some Output Content Blocks include this same 'document' structure in their fields (e.g. WebFetchToolResultBlock),
   *       but it's not per se a top-level output content block.
   * NOTE2: in WebFetchToolResultBlock, .context is absent, and source is either Base64PDFSource or PlainTextSource only.
   */
  export const DocumentBlock_I_schema = _CommonBlock_schema.extend({
    type: z.literal('document'),
    title: z.string().nullish(), // length: 1-500
    context: z.string().nullish(), // length: 1+ -- NOT present within WebFetchToolResultBlock.content[number].content
    citations: z.object({ enabled: z.boolean() }).optional(),
    source: z.discriminatedUnion('type', [
      // Base64PDFSource
      z.object({
        type: z.literal('base64'),
        media_type: z.enum(['application/pdf']),
        data: z.string(),
      }),
      // PlainTextSource
      z.object({
        type: z.literal('text'),
        media_type: z.enum(['text/plain']),
        data: z.string(),
      }),
      // ContentBlockSource
      z.object({
        type: z.literal('content'),
        content: z.union([
          z.string(),
          z.array(z.union([z.lazy(() => TextBlock_schema), z.lazy(() => ImageBlock_I_schema)])),
        ]),
      }),
      z.object({
        type: z.literal('url'),
        url: z.string(),
      }),
      z.object({
        type: z.literal('file'),
        file_id: z.string(),
      }),
    ]),
  });

  /** SearchResultBlock - INPUT ONLY. Never appears in output content blocks. */
  export const SearchResultBlock_I_schema = _CommonBlock_schema.extend({
    type: z.literal('search_result'),
    source: z.string(),
    title: z.string(),
    content: z.array(TextBlock_schema),
    citations: z.object({ enabled: z.boolean() }).optional(),
  });

  /** ToolResultBlock - INPUT ONLY. Never appears in output content blocks. (That's why ServerToolUse exists) */
  export const ToolResultBlock_I_schema = _CommonBlock_schema.extend({
    type: z.literal('tool_result'),
    tool_use_id: z.string(),
    content: z.union([
      z.string(),
      z.array(z.union([TextBlock_schema, ImageBlock_I_schema, SearchResultBlock_I_schema, DocumentBlock_I_schema])),
    ]).optional(),
    is_error: z.boolean().optional(), // default: false
  });


  /// Server Tool Result Blocks (used in both input and output)

  /**
   * ServerToolUseBlock - Server-side tool invocation
   * Note: Beta headers may be required for some tools - check AnthropicBetaParam for current requirements
   */
  export const ServerToolUseBlock_schema = _CommonBlock_schema.extend({
    type: z.literal('server_tool_use'),
    id: z.string(), // .regex(/^srvtoolu_[a-zA-Z0-9_]+$/),
    name: z.union([
      z.enum([
        'web_search',
        'web_fetch',
        'code_execution',
        'bash_code_execution', // sub-tool of 'code_execution'
        'text_editor_code_execution', // sub-tool of 'code_execution'
      ]),
      z.string(), // forward-compatibility parsing
    ]),
    input: z.any(),
  });

  export const WebSearchToolResultBlock_schema = _CommonBlock_schema.extend({
    type: z.literal('web_search_tool_result'),
    tool_use_id: z.string(),
    content: z.union([
      z.array(z.object({
        type: z.literal('web_search_result'),
        encrypted_content: z.string(),
        title: z.string(),
        url: z.string(),
        page_age: z.string().nullish(),
      })),
      z.object({
        type: z.literal('web_search_tool_result_error'),
        error_code: z.union([
          z.enum(['invalid_tool_input', 'unavailable', 'max_uses_exceeded', 'too_many_requests', 'query_too_long']),
          z.string(), // forward-compatibility
        ]),
      }),
    ]),
  });

  export const WebFetchToolResultBlock_schema = _CommonBlock_schema.extend({
    type: z.literal('web_fetch_tool_result'),
    tool_use_id: z.string(),
    content: z.union([
      z.object({
        type: z.literal('web_fetch_result'),
        url: z.string(),
        retrieved_at: z.string().nullish(),
        content: DocumentBlock_I_schema,
      }),
      z.object({
        type: z.literal('web_fetch_tool_result_error'),
        error_code: z.union([
          z.enum(['invalid_tool_input', 'url_too_long', 'url_not_allowed', 'url_not_accessible', 'unsupported_content_type', 'too_many_requests', 'max_uses_exceeded', 'unavailable']),
          z.string(), // forward-compatibility
        ]),
      }),
    ]),
  });

  const _CodeExecutionOutputBlock_schema = z.object({
    type: z.literal('code_execution_output'),
    file_id: z.string(),
  });

  export const CodeExecutionToolResultBlock_schema = _CommonBlock_schema.extend({
    type: z.literal('code_execution_tool_result'),
    tool_use_id: z.string(),
    content: z.union([
      z.object({
        type: z.literal('code_execution_result'),
        stdout: z.string(),
        stderr: z.string(),
        return_code: z.number(),
        content: z.array(_CodeExecutionOutputBlock_schema),
      }),
      z.object({
        type: z.literal('code_execution_tool_result_error'),
        error_code: z.string(),
      }),
    ]),
  });

  const _BashCodeExecutionOutputBlock_schema = z.object({
    type: z.literal('bash_code_execution_output'),
    file_id: z.string(),
  });

  export const BashCodeExecutionToolResultBlock_schema = _CommonBlock_schema.extend({
    type: z.literal('bash_code_execution_tool_result'),
    tool_use_id: z.string(),
    content: z.union([
      z.object({
        type: z.literal('bash_code_execution_result'),
        stdout: z.string(),
        stderr: z.string(),
        return_code: z.number(),
        content: z.array(_BashCodeExecutionOutputBlock_schema),
      }),
      z.object({
        type: z.literal('bash_code_execution_tool_result_error'),
        error_code: z.string(),
      }),
    ]),
  });

  export const TextEditorCodeExecutionToolResultBlock_schema = _CommonBlock_schema.extend({
    type: z.literal('text_editor_code_execution_tool_result'),
    tool_use_id: z.string(),
    content: z.union([
      z.object({
        type: z.literal('text_editor_code_execution_view_result'),
        file_type: z.enum(['text', 'image', 'pdf']),
        content: z.string(),
        start_line: z.number().nullish(),
        num_lines: z.number().nullish(),
        total_lines: z.number().nullish(),
      }),
      z.object({
        type: z.literal('text_editor_code_execution_create_result'),
        is_file_update: z.boolean(),
      }),
      z.object({
        type: z.literal('text_editor_code_execution_str_replace_result'),
        old_start: z.number().nullish(),
        old_lines: z.number().nullish(),
        new_start: z.number().nullish(),
        new_lines: z.number().nullish(),
        lines: z.array(z.string()).nullish(),
      }),
      z.object({
        type: z.literal('text_editor_code_execution_tool_result_error'),
        error_code: z.string(),
        error_message: z.string().nullish(),
      }),
    ]),
  });

  export const MCPToolUseBlock_schema = _CommonBlock_schema.extend({
    type: z.literal('mcp_tool_use'),
    id: z.string(),
    name: z.string(),
    input: z.any(),
    server_name: z.string(),
  });

  export const MCPToolResultBlock_schema = _CommonBlock_schema.extend({
    type: z.literal('mcp_tool_result'),
    tool_use_id: z.string(),
    content: z.union([z.string(), z.array(TextBlock_schema)]).optional(),
    is_error: z.boolean().optional(),
  });

  export const ContainerUploadBlock_schema = _CommonBlock_schema.extend({
    type: z.literal('container_upload'),
    file_id: z.string(),
  });


  /// Block Constructors

  export function TextBlock(text: string): z.infer<typeof TextBlock_schema> {
    return { type: 'text', text };
  }

  export function ImageBlock(mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', base64: string): z.infer<typeof ImageBlock_I_schema> {
    return { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } };
  }

  export function ToolUseBlock(id: string, name: string, input: string | null): z.infer<typeof ToolUseBlock_schema> {
    // Anthropic Tool Invocations want the input as object, and will reject 'null' inputs for instance.
    // - ".input: Input should be a valid dictionary" - Anthropic
    // - ".input: Field required" - Anthropic
    // -> we replace 'null' and '', with {}
    return { type: 'tool_use', id, name, input: !input ? {} : JSON.parse(input) /* 2024-11-03: Anthropic requires an object in 'input' */ };
  }

  export function ToolResultBlock(tool_use_id: string, content: z.infer<typeof ToolResultBlock_I_schema>['content'], is_error?: boolean): z.infer<typeof ToolResultBlock_I_schema> {
    return { type: 'tool_result', tool_use_id, content, is_error };
  }

  export function ThinkingBlock(thinking: string, signature: string): z.infer<typeof ThinkingBlock_schema> {
    return { type: 'thinking', thinking, signature };
  }

  export function RedactedThinkingBlock(data: string): z.infer<typeof RedactedThinkingBlock_schema> {
    return { type: 'redacted_thinking', data };
  }

  export function blockSetCacheControl(block: z.infer<typeof _CommonBlock_schema>, cacheControl: z.infer<typeof _CacheControl_schema>['type']): void {
    block.cache_control = { type: cacheControl };
  }

}

export namespace AnthropicWire_Messages {
  /**
   * Input content blocks are a superset of output blocks.
   * Input content blocks as of 2025-10-17:
   * - Text, Image, Document, Search result
   * - Thinking, Redacted thinking
   * - Tool use, Tool result
   * - Server tool use, Web search tool result, Web fetch tool result
   * - Code execution tool result, Bash code execution tool result, Text editor code execution tool result
   * - MCP tool use, MCP tool result
   * - Container upload
   */
  const _ContentBlockInput_schema = z.discriminatedUnion('type', [
    // Common Blocks (both input and output)
    AnthropicWire_Blocks.TextBlock_schema,
    AnthropicWire_Blocks.ThinkingBlock_schema,
    AnthropicWire_Blocks.RedactedThinkingBlock_schema,
    AnthropicWire_Blocks.ToolUseBlock_schema,
    // Input-Only Blocks
    AnthropicWire_Blocks.ImageBlock_I_schema,
    AnthropicWire_Blocks.DocumentBlock_I_schema,
    AnthropicWire_Blocks.SearchResultBlock_I_schema,
    AnthropicWire_Blocks.ToolResultBlock_I_schema,
    // Server Tool Blocks (originates from output -> copied to input)
    AnthropicWire_Blocks.ServerToolUseBlock_schema,
    AnthropicWire_Blocks.WebSearchToolResultBlock_schema,
    AnthropicWire_Blocks.WebFetchToolResultBlock_schema,
    AnthropicWire_Blocks.CodeExecutionToolResultBlock_schema,
    AnthropicWire_Blocks.BashCodeExecutionToolResultBlock_schema,
    AnthropicWire_Blocks.TextEditorCodeExecutionToolResultBlock_schema,
    AnthropicWire_Blocks.MCPToolUseBlock_schema,
    AnthropicWire_Blocks.MCPToolResultBlock_schema,
    AnthropicWire_Blocks.ContainerUploadBlock_schema,
  ]);

  export const MessageInput_schema = z.object({
    role: z.enum(['user', 'assistant']),
    content: z.array(_ContentBlockInput_schema), // NOTE: could be a string (see below), but we force it to be an array
    // content: z.union([z.string(), z.array(_ContentBlockInput_schema)]),
  });

  /**
   * Output content blocks are generated by the model.
   * Output content blocks as of 2025-10-17:
   * - Text
   * - Thinking, Redacted thinking
   * - Tool use
   * - Server tool use, Web search tool result, Web fetch tool result
   * - Code execution tool result, Bash code execution tool result, Text editor code execution tool result
   * - MCP tool use, MCP tool result
   * - Container upload
   */
  export const ContentBlockOutput_schema = z.discriminatedUnion('type', [
    // Common Blocks (both input and output)
    AnthropicWire_Blocks.TextBlock_schema,
    AnthropicWire_Blocks.ThinkingBlock_schema,
    AnthropicWire_Blocks.RedactedThinkingBlock_schema,
    AnthropicWire_Blocks.ToolUseBlock_schema,
    // Server Tool Blocks (originate here)
    AnthropicWire_Blocks.ServerToolUseBlock_schema,
    AnthropicWire_Blocks.WebSearchToolResultBlock_schema,
    AnthropicWire_Blocks.WebFetchToolResultBlock_schema,
    AnthropicWire_Blocks.CodeExecutionToolResultBlock_schema,
    AnthropicWire_Blocks.BashCodeExecutionToolResultBlock_schema,
    AnthropicWire_Blocks.TextEditorCodeExecutionToolResultBlock_schema,
    AnthropicWire_Blocks.MCPToolUseBlock_schema,
    AnthropicWire_Blocks.MCPToolResultBlock_schema,
    AnthropicWire_Blocks.ContainerUploadBlock_schema,
  ]);
}

export namespace AnthropicWire_Skills {

  // Container parameters for request
  export const ContainerParams_schema = z.object({
    /**
     * Optional. Container ID to reuse existing container
     */
    id: z.string().nullish(),
    skills: z.array(z.object({
      skill_id: z.string(), // max 64 chars - not enforced here
      type: z.enum(['anthropic', 'custom']),
      version: z.literal('latest').or(z.string()).optional(),
    })).nullish(), // max 8 skills - we don't enforce this here
  });

  // Container information in response
  export const Container_schema = z.object({
    /** Container identifier */
    id: z.string(),
    /** ISO 8601 timestamp when the container will expire */
    expires_at: z.string(),
    /** Skills that were loaded in the container */
    skills: z.array(z.object({
      skill_id: z.string(),
      type: z.enum(['anthropic', 'custom']),
      version: z.string(), // loaded version
    })).nullish(),
  });

}

export namespace AnthropicWire_Tools {

  const _ToolDefinitionBase_schema = z.object({
    /** This is how the tool will be called by the model and in tool_use blocks. */
    name: z.string(),

    /** 2024-10-22: cache-control can be set on the Tools block as well. We could make use of this instead of the System Instruction blocks for prompts with longer tools. */
    cache_control: AnthropicWire_Blocks._CacheControl_schema.nullish(),
  });

  const _CustomToolDefinition_schema = _ToolDefinitionBase_schema.extend({
    /**
     * Client defined tool (non-built-in).
     * Note: we force the value to be 'custom' although the API would allow for undefined or null as well. For ease
     *       of development, we force the value to be 'custom' to use a discriminating union.
     */
    type: z.literal('custom'),  // ..nullish() // see note above

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
    input_schema: z.looseObject({
      type: z.literal('object'),
      properties: z.record(z.string(), z.any()).nullish(), // FC-DEF params schema - WAS: z.json().nullable(),
      required: z.array(z.string()).optional(), // 2025-02-24: seems to be removed; we may still have this, but it may also be within the 'properties' object
    }),
  });

  // Latest Tool Versions (sorted alphabetically by tool name)
  // Deprecated versions (removed):
  // - bash_20241022 -> bash_20250124
  // - code_execution_20250522 (legacy, python only) -> code_execution_20250825 (bash and many programming languages)
  // - computer_20241022 -> computer_20250124
  // - text_editor_20241022, text_editor_20250124, text_editor_20250429 -> text_editor_20250728

  const _BashTool_20250124_schema = _ToolDefinitionBase_schema.extend({
    type: z.literal('bash_20250124'),
    name: z.literal('bash'),
  });

  /**
   * Current (No support for the legacy code_execution_20250522): Supports Bash commands, file operations, and multiple languages. Requires beta header: "code-execution-2025-08-25"
   *
   * When this tool is provided, Claude automatically gains access to two sub-tools:
   * - 'bash_code_execution': Run shell commands
   * - 'text_editor_code_execution': View, create, and edit files, including writing code
   */
  const _CodeExecutionTool_20250825_schema = _ToolDefinitionBase_schema.extend({
    type: z.literal('code_execution_20250825'),
    name: z.literal('code_execution'),
  });

  /** Requires beta header: "computer-use-2025-01-24" */
  const _ComputerUseTool_20250124_schema = _ToolDefinitionBase_schema.extend({
    type: z.literal('computer_20250124'),
    name: z.literal('computer'),
    display_height_px: z.number(),
    display_width_px: z.number(),
    display_number: z.number().nullish(),
  });

  const _MemoryTool_20250818_schema = _ToolDefinitionBase_schema.extend({
    type: z.literal('memory_20250818'),
    name: z.literal('memory'),
  });

  const _TextEditor_20250728_schema = _ToolDefinitionBase_schema.extend({
    type: z.literal('text_editor_20250728'),
    name: z.literal('str_replace_based_edit_tool'),
    max_characters: z.number().nullish(),
  });

  const _WebFetchTool_20250910_schema = _ToolDefinitionBase_schema.extend({
    type: z.literal('web_fetch_20250910'),
    name: z.literal('web_fetch'),
    allowed_domains: z.array(z.string()).nullish(),
    blocked_domains: z.array(z.string()).nullish(),
    citations: z.object({ enabled: z.boolean() }).nullish(),
    max_content_tokens: z.number().nullish(),
    max_uses: z.number().nullish(),
  });

  const _WebSearchTool_20250305_schema = _ToolDefinitionBase_schema.extend({
    type: z.literal('web_search_20250305'),
    name: z.literal('web_search'),
    allowed_domains: z.array(z.string()).nullish(),
    blocked_domains: z.array(z.string()).nullish(),
    max_uses: z.number().nullish(),
    user_location: z.any().nullish(), // UserLocation schema
  });

  export const ToolDefinition_schema = z.discriminatedUnion('type', [
    // Client-side tools
    _CustomToolDefinition_schema,
    // Hosted tool definitions & Hosted Tools
    _BashTool_20250124_schema,
    _CodeExecutionTool_20250825_schema,
    _ComputerUseTool_20250124_schema,
    _MemoryTool_20250818_schema,
    _TextEditor_20250728_schema,
    _WebFetchTool_20250910_schema,
    _WebSearchTool_20250305_schema,
  ]);

}


//
// Messages > Create
//
export namespace AnthropicWire_API_Message_Create {

  /// Shared Schemas

  /**
   * Stop reason values that indicate why Claude stopped generating.
   * - 'end_turn': the model reached a natural stopping point
   * - 'max_tokens': exceeded the requested max_tokens limit
   * - 'stop_sequence': one of the custom stop_sequences was generated
   * - 'tool_use': the model wants to use a tool
   * - 'pause_turn': paused for server tools (e.g. web search)
   * - 'refusal': Claude refused due to safety concerns
   * - 'model_context_window_exceeded': hit the model's context window limit
   */
  const StopReason_schema = z.enum([
    'end_turn',
    'max_tokens',
    'stop_sequence',
    'tool_use',
    'pause_turn',
    'refusal',
    'model_context_window_exceeded',
  ]);

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
     * Container configuration for code execution tools.
     * Can be a container ID string to reuse, or a ContainerParams object to configure.
     */
    container: z.union([
      z.string(),
      AnthropicWire_Skills.ContainerParams_schema,
    ]).nullish(),

    /**
     * Context management configuration.
     * Controls how Claude manages context across requests (e.g., clearing tool results).
     */
    context_management: z.object({
      edits: z.array(z.any()).optional(), // ClearToolUses20250919 and future edit types
    }).nullish(),

    mcp_servers: z.array(z.object({
      type: z.literal('url'),
      url: z.string(),
      name: z.string(),
      authorization_token: z.string().nullish(),
      tool_configuration: z.any().nullish(),
    })).optional(),

    service_tier: z.enum(['auto', 'standard_only']).optional(),

    /**
     * If you want to include a system prompt, you can use the top-level system parameter — there is no "system" role for input messages in the Messages API.
     */
    system: z.array(AnthropicWire_Blocks.TextBlock_schema).optional(), // NOTE: we force ourselves to always write the array representation
    // system: z.union([z.string(), z.array(AnthropicWire_Blocks.TextBlock_schema)]).optional(),

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
      z.object({ type: z.literal('none') }),
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
      user_id: z.string().nullish(),
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
     * When enabled, responses include thinking content blocks showing Claude's thinking process before the final answer.
     */
    thinking: z.union([
      // Requires a minimum budget of 1,024 tokens and counts towards your max_tokens limit.
      z.object({
        type: z.literal('enabled'),
        budget_tokens: z.number(),
      }),
      // having this for completeness, but seems like it's not needed / can be omitted
      z.object({ type: z.literal('disabled') }),
    ]).optional(),

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
     * OUTPUT Content generated by the model.
     * This is an array of content blocks, each of which has a type that determines its shape. Currently, the only type in responses is "text".
     */
    content: z.array(AnthropicWire_Messages.ContentBlockOutput_schema),

    /**
     * The reason why Claude stopped generating.
     * In non-streaming mode this value is always non-null. In streaming mode, it is null in the message_start event and non-null otherwise.
     */
    stop_reason: StopReason_schema.nullable(),
    // Which custom stop sequence was generated, if any.
    stop_sequence: z.string().nullable(),

    /**
     * Billing and rate-limit usage.
     * Token counts represent the underlying cost to Anthropic's systems.
     */
    usage: z.object({
      input_tokens: z.number(),
      output_tokens: z.number(),
      cache_creation_input_tokens: z.number().nullish(),
      cache_read_input_tokens: z.number().nullish(),
      cache_creation: z.object({
        ephemeral_1h_input_tokens: z.number(),
        ephemeral_5m_input_tokens: z.number(),
      }).nullish(),
      server_tool_use: z.object({
        web_fetch_requests: z.number(),
        web_search_requests: z.number(),
      }).nullish(),
      service_tier: z.enum(['standard', 'priority', 'batch']).nullish(),
    }),

    /**
     * Context management response.
     * Information about context management strategies applied during the request.
     */
    context_management: z.object({
      applied_edits: z.array(z.object({
        type: z.string(), // e.g., 'clear_tool_uses_20250919'
        cleared_tool_uses: z.number().optional(),
        cleared_input_tokens: z.number().optional(),
      })).optional(),
    }).nullish(),

    /**
     * Container information.
     * Non-null if a container tool (e.g., code execution) was used.
     */
    container: AnthropicWire_Skills.Container_schema.nullish(),
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
      stop_reason: StopReason_schema.nullable(),
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
      z.object({
        type: z.literal('thinking_delta'),
        thinking: z.string(),
      }),
      z.object({
        type: z.literal('signature_delta'),
        signature: z.string(),
      }),
      z.object({
        // created by the hosted web_search tool, at least, in which case the citation is: Extract<typeof _TextBlockCitations_schema, { type: 'web_search_result_location' }>
        type: z.literal('citations_delta'),
        citation: AnthropicWire_Blocks._TextBlockCitations_schema,
      }),
    ]),
  });

}
