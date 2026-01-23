import * as z from 'zod/v4';

import { OpenAIWire_Responses_Items, OpenAIWire_Responses_Tools } from './openai.wiretypes';


//
// xAI Responses API Wire Types
//
// Implementation notes:
// - xAI Responses API is similar to OpenAI Responses API but with key differences:
//   - No 'instructions' field - system content must be prepended to first user message
//   - Uses 'developer' role for system messages (only one allowed, must be first)
//   - Different server-side tools: 'web_search', 'x_search', 'code_execution'
//   - X Search is xAI-exclusive with handles and date filtering
//   - Tool calls come in single chunks (not incremental like OpenAI)
//


/// xAI-specific Tool Definitions

export namespace XAIWire_Responses_Tools {

  // `Custom function` tool - same as OpenAI

  // xAI-native hosted tool types
  const HostedToolType_schema = z.enum(['web_search', 'x_search', 'code_execution']);

  // Code Execution tool - enables server-side code execution
  const CodeExecutionTool_schema = z.object({
    type: z.literal('code_interpreter'),
    // [XAI-UNSUPPORTED] // container: z.string(),
  });

  // Web Search tool - searches the web for information
  // - [2026-01-21] compared to OpenAI's Responses default, we have allowed/excluded domains, we miss search_context_size, user_location
  const WebSearchTool_schema = z.object({
    type: z.literal('web_search'),
    // either-or:
    allowed_domains: z.array(z.string()).max(5).nullish(), // limit search to these domains (without protocol specification or subdomains)
    excluded_domains: z.array(z.string()).max(5).nullish(), // exclude these domains from search (without protocol specification or subdomains)
    enable_image_understanding: z.boolean().nullish(),
    // [XAI-UNSUPPORTED] // external_web_access: z.boolean().optional(),
    // [XAI-IGNORED] // filters: ... for OAI compatibility, but replicates the allowed/excluded domains above
    // [XAI-UNSUPPORTED] // search_context_size: z.enum(['low', 'medium', 'high']).optional(),
    // [XAI-UNSUPPORTED] // user_location: z.looseObject({}).nullish(),
  });

  // X Search tool - searches X/Twitter for social media content
  const XSearchTool_schema = z.object({
    type: z.literal('x_search'),
    allowed_x_handles: z.array(z.string()).nullish(), // filter to specific X handles
    excluded_x_handles: z.array(z.string()).nullish(), // exclude these X handles
    enable_image_understanding: z.boolean().nullish(),
    enable_video_understanding: z.boolean().nullish(),
    from_date: z.string().nullish(), // YYYY-MM-DD format
    to_date: z.string().nullish(), // YYYY-MM-DD format
  });

  // IGNORING FOR NOW - WE DON'T CARE ABOUT THESE TOOLS:
  // const FileSearchTool_schema = { type: 'file_search', ... }
  // const MCPTool_schema = { type: 'mcp', ...  }

  // Combined xAI tools
  export type Tool = z.infer<typeof Tool_schema>;
  export const Tool_schema = z.discriminatedUnion('type', [

    // custom function tools
    OpenAIWire_Responses_Tools.CustomFunctionTool_schema,

    // [extension] xAI-native hosted tools
    CodeExecutionTool_schema,
    WebSearchTool_schema,
    XSearchTool_schema,

  ]);

  // Tool choice - similar to OpenAI but with xAI tool types
  export type ToolChoice = z.infer<typeof ToolChoice_schema>;
  export const ToolChoice_schema = z.union([
    z.literal('none'),
    z.literal('auto'),
    z.literal('required'),
    z.object({
      type: z.literal('function'),
      name: z.string(),
    }),
    // [XAI-UNSUPPORTED] or at least missing from docs as of 2026-01-22
    // z.object({
    //   type: HostedToolType_schema,
    // }),
  ]);

}


/// xAI Responses API Request

export namespace XAIWire_API_Responses {

  export type Request = z.infer<typeof Request_schema>;
  export const Request_schema = z.object({

    // Model configuration
    model: z.string(),
    max_output_tokens: z.int().nullish(),
    temperature: z.number().min(0).nullish(), // default: 1, min: 0, max: 2
    top_p: z.number().min(0).nullish(), // this or temperature, not both

    // Input
    // [XAI-UNSUPPORTED] // instructions: z.string().nullish(),
    input: z.array(OpenAIWire_Responses_Items.InputItem_schema),

    // Tools
    tools: z.array(XAIWire_Responses_Tools.Tool_schema).optional(),
    tool_choice: XAIWire_Responses_Tools.ToolChoice_schema.optional(),
    parallel_tool_calls: z.boolean().nullish(),

    // configure reasoning
    // [2026-01-22] OBSOLETE - only grok-3-mini)(!)
    reasoning: z.object({
      effort: z.enum([/*'none', 'minimal',*/ 'low', 'medium', 'high' /*, 'xhigh'*/]).nullish(), // XAI: 3 levels only
      // [XAI-UNSUPPORTED] // generate_summary: z.string().nullish(),
      // [XAI-UNSUPPORTED] // summary: z.enum(['auto', 'concise', 'detailed']).nullish(), // XAI: The model shall always return 'detailed'
    }).nullish(),

    // configure search
    // [XAI-YIELD-TO-WEB_SEARCH-TOOL] // search_parameters: z.record(z.string(), z.any()).optional(), // xAI Live Search parameters - keeping flexible for API evolution

    // configure text output
    text: z.object({
      format: z.union([
        z.object({ type: z.literal('text') }),
        z.object({
          type: z.literal('json_schema'),
          name: z.string(), // [XAI] Only included for compatibility
          description: z.string().optional(), // [XAI] Only included for compatibility
          schema: z.json(),
          strict: z.boolean().nullish(), // [XAI] Only included for compatibility
        }),
      ]).optional(),
      // [XAI-MISSING] // verbosity: z.enum(['low', 'medium', 'high']).optional(), // GPT-5 verbosity control
    }).optional(),

    // State management
    store: z.boolean().nullish(), // defaults to true(!)
    previous_response_id: z.string().nullish(),

    // API options
    stream: z.boolean().nullish(),
    // [XAI-UNSUPPORTED] // background: z.boolean().nullish(),
    // [XAI-UNSUPPORTED] // truncation: z.enum(['auto', 'disabled']).nullish(),
    include: z.array(z.enum([
      // from the API doc
      'reasoning.encrypted_content', // returns an encrypted version of the reasoning tokens
      // https://docs.x.ai/docs/guides/tools/overview#specify-tool-outputs-to-return
      'code_interpreter_call.outputs', // for code_interpreter
    ])).optional(),
    user: z.string().optional(), // stable identifier for your end-users

    // Unused
    // logprobs: z.boolean().nullish(),
    // metadata: z.record(z.string(), z.any()).optional(), // set of 16 key-value pairs that can be attached to an object
    // service_tier: z.enum(['auto', 'default', 'flex', 'priority']).nullish(),
    // top_logprobs: z.int().nullish(), // requires logprobs to be true, an integer between 0 and 8 specifying the number of most likely tokens to return at each token position

  });


  /// Response - same structure as OpenAI Responses API
  //
  // export type Response = z.infer<typeof Response_schema>;
  // export const Response_schema = z.object({
  //   object: z.literal('response'),
  //   id: z.string(),
  //   created_at: z.number(),
  //   status: z.enum(['completed', 'failed', 'in_progress', 'cancelled', 'queued', 'incomplete']),
  //   incomplete_details: z.object({
  //     reason: z.union([z.enum(['max_output_tokens']), z.string()]),
  //   }).nullish(),
  //   error: z.object({ code: z.string(), message: z.string() }).nullish(),
  //   model: z.string(),
  //   output: z.array(OpenAIWire_Responses_Items.OutputItem_schema),
  //   usage: z.object({
  //     input_tokens: z.number(),
  //     input_tokens_details: z.object({
  //       cached_tokens: z.number().optional(),
  //     }).optional(),
  //     output_tokens: z.number(),
  //     output_tokens_details: z.object({
  //       reasoning_tokens: z.number().optional(),
  //     }).optional(),
  //     total_tokens: z.number(),
  //   }).nullish(),
  //   background: z.boolean().optional(),
  //   store: z.boolean().optional(),
  // });
  //
  //
  // /// Streaming Events - reuse OpenAI's where compatible, extend for xAI-specific
  //
  // // Note: xAI streaming events follow the same pattern as OpenAI Responses API
  // // with additional x_search_call events. We can mostly reuse the OpenAI parser
  // // with extensions for xAI-specific tool events.
  //
  // const _BaseEvent_schema = z.object({
  //   sequence_number: z.number(),
  // });
  //
  // const _OutputIndexedEvent_schema = _BaseEvent_schema.extend({
  //   output_index: z.number(),
  //   item_id: z.string(),
  // });
  //
  // // X Search specific events
  // export const XSearchCallInProgress_schema = _OutputIndexedEvent_schema.extend({
  //   type: z.literal('response.x_search_call.in_progress'),
  // });
  //
  // export const XSearchCallSearching_schema = _OutputIndexedEvent_schema.extend({
  //   type: z.literal('response.x_search_call.searching'),
  // });
  //
  // export const XSearchCallCompleted_schema = _OutputIndexedEvent_schema.extend({
  //   type: z.literal('response.x_search_call.completed'),
  // });
  //
  // // Code Execution specific events
  // export const CodeExecutionCallInProgress_schema = _OutputIndexedEvent_schema.extend({
  //   type: z.literal('response.code_execution_call.in_progress'),
  // });
  //
  // export const CodeExecutionCallExecuting_schema = _OutputIndexedEvent_schema.extend({
  //   type: z.literal('response.code_execution_call.executing'),
  // });
  //
  // export const CodeExecutionCallCompleted_schema = _OutputIndexedEvent_schema.extend({
  //   type: z.literal('response.code_execution_call.completed'),
  // });
  //
  // // X Search output item (extension of OutputItem_schema for xAI)
  // export const OutputXSearchCallItem_schema = z.object({
  //   type: z.literal('x_search_call'),
  //   id: z.string(),
  //   status: z.enum(['searching', 'in_progress', 'completed', 'incomplete']).optional(),
  //   action: z.object({
  //     type: z.literal('search'),
  //     query: z.string().optional(),
  //     sources: z.array(z.object({
  //       type: z.literal('post').optional(),
  //       url: z.string(),
  //       handle: z.string().optional(),
  //       text: z.string().optional(),
  //       timestamp: z.string().optional(),
  //     })).optional(),
  //   }).optional(),
  // });
  //
  // // Code Execution output item
  // export const OutputCodeExecutionCallItem_schema = z.object({
  //   type: z.literal('code_interpreter_call'),
  //   id: z.string(),
  //   status: z.enum(['executing', 'in_progress', 'completed', 'incomplete']).optional(),
  //   language: z.string().optional(),
  //   code: z.string().optional(),
  //   result: z.string().optional(),
  //   error: z.string().optional(),
  // });

}
