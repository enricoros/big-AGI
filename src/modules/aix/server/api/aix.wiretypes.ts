import { z } from 'zod';

// Used to align Particles to the Typescript definitions from the frontend-side, on 'chat.fragments.ts'
import type { DMessageToolResponsePart } from '~/common/stores/chat/chat.fragments';

import { anthropicAccessSchema } from '~/modules/llms/server/anthropic/anthropic.router';
import { geminiAccessSchema } from '~/modules/llms/server/gemini/gemini.router';
import { ollamaAccessSchema } from '~/modules/llms/server/ollama/ollama.router';
import { openAIAccessSchema } from '~/modules/llms/server/openai/openai.router';


//
// Design notes:
// - [Client -> AIX API calls] This encodes the structure sent to the AIX server API calls
// - Parts: mirror the Typescript definitions from the frontend-side, on 'chat.fragments.ts'
//


// Export types
export type AixParts_DocPart = z.infer<typeof AixWire_Parts.DocPart_schema>;
export type AixParts_InlineImagePart = z.infer<typeof AixWire_Parts.InlineImagePart_schema>;
export type AixParts_MetaCacheControl = z.infer<typeof AixWire_Parts.MetaCacheControl_schema>;
export type AixParts_MetaInReferenceToPart = z.infer<typeof AixWire_Parts.MetaInReferenceToPart_schema>;

export type AixMessages_SystemMessage = z.infer<typeof AixWire_Content.SystemInstruction_schema>;
export type AixMessages_ModelMessage = z.infer<typeof AixWire_Content.ModelMessage_schema>;
export type AixMessages_ToolMessage = z.infer<typeof AixWire_Content.ToolMessage_schema>;
export type AixMessages_UserMessage = z.infer<typeof AixWire_Content.UserMessage_schema>;
export type AixMessages_ChatMessage = z.infer<typeof AixWire_Content.ChatMessage_schema>;

export type AixTools_ToolDefinition = z.infer<typeof AixWire_Tooling.Tool_schema>;
export type AixTools_FunctionCallDefinition = Extract<z.infer<typeof AixWire_Tooling.Tool_schema>, { type: 'function_call' }>;
export type AixTools_ToolsPolicy = z.infer<typeof AixWire_Tooling.ToolsPolicy_schema>;

export type AixAPI_Access = z.infer<typeof AixWire_API.Access_schema>;
export type AixAPI_Context_ChatGenerate = z.infer<typeof AixWire_API.ContextChatGenerate_schema>;
export type AixAPI_Model = z.infer<typeof AixWire_API.Model_schema>;
export type AixAPIChatGenerate_Request = z.infer<typeof AixWire_API_ChatContentGenerate.Request_schema>;


/// Input Types to AIX

export namespace OpenAPI_Schema {

  /**
   * The zod definition of an "OpenAPI 3.0.3" "Schema Object".
   * https://spec.openapis.org/oas/v3.0.3#schema-object
   *
   * 1. this is an OpenAPI Schema Object, and not a standard JSON Schema, which is
   *    ("application/schema+json", a JSON object that describes the structure of JSON data).
   * 2. this is actually a subset of the OpenAPI Schema Object, as we only need a subset
   *    of the properties for our function calling use case.
   */
  export const Object_schema = z.object({
    // allowed data types - https://ai.google.dev/api/rest/v1beta/cachedContents#Type
    type: z.enum(['string', 'number', 'integer', 'boolean', 'array', 'object']),

    // (recommended) brief description of the parameter - can contain examples - can be markdown
    description: z.string().optional(),

    // the value may be null
    nullable: z.boolean().optional(),

    // [string] possible values
    enum: z.array(z.any()).optional(),

    // [number] float, double - [integer]: int32, int64
    format: z.string().optional(),

    // [object] properties (recursively)
    properties: z.record(z.any() /* could refer to self using z.lazy().... */).optional(),
    // [object] required properties
    required: z.array(z.string()).optional(),

    // [array] schema of the items
    items: z.any().optional(), // could refer to self using z.lazy()....

    // ignore but possibly useful properties..
    // minimum: z.number().optional(),
    // maximum: z.number().optional(),
    // minLength: z.number().int().nonnegative().optional(),
    // maxLength: z.number().int().nonnegative().optional(),
    // pattern: z.string().optional(),
    // default: z.any().optional(),
    // additionalProperties: z.union([z.boolean(), jsonSchema]).optional(),
  });

}

export namespace AixWire_Parts {

  // User Input Parts

  export const TextPart_schema = z.object({
    pt: z.literal('text'),
    text: z.string(),
  });

  // NOTE: different from DMessageImageRefPart, in that the image data is inlined rather than bein referred to
  export const InlineImagePart_schema = z.object({
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

  // Disabling inline audio for now, as it's only supported by Gemini
  // const InlineAudioPart_schema = z.object({
  //   pt: z.literal('inline_audio'),
  //   mimeType: z.enum(['audio/wav', 'audio/mp3', 'audio/aiff', 'audio/aac', 'audio/ogg', 'audio/flac']),
  //   base64: z.string(),
  // });

  // The reason of existence of a doc part, is to be encoded differently depending on
  // the target llm (e.g. xml for anthropic, markdown titled block for others, ...)
  export const DocPart_schema = z.object({
    pt: z.literal('doc'),

    // Doc Type, not to be confused the underlying data type
    // TODO: have more precise types here, probably all VND.AGI.* ?
    vdt: z.enum([
      'application/vnd.agi.code',
      'application/vnd.agi.ocr',
      'text/plain',
    ]),

    // identifier of the document, to be known to the model, as unique as possible, for the purpose of versioning
    ref: z.string(),

    // optional title of the document
    l1Title: z.string().optional(),

    // version of the document - optional because it's not guaranteed, but strongly suggested
    version: z.number().optional(),

    // inlined for now as it's only used here; in the TypeScript definition this is DMessageDataInline
    data: z.object({
      idt: z.literal('text'),
      text: z.string(),
      mimeType: z.string().optional(), // underlying data type (e.g. text/plain, or blank)
    }),

    // meta: ignored...
  });

  // Tool Call

  const _FunctionCallInvocation_schema = z.object({
    type: z.literal('function_call'),
    name: z.string(),
    args: z.string(), //.nullable(), // 2024-11-03: disabled .nullable(), as we'll use '' for no args (which some APIs weirdly don't support so we'll mock downstream as '{}')
    // _description: z.string().optional(),
    // _args_schema: z.object({}).optional(),
  });

  const _CodeExecutionInvocation_schema = z.object({
    type: z.literal('code_execution'),
    variant: z.literal('gemini_auto_inline').optional(),
    language: z.string().optional(),
    code: z.string(),
  });

  export const ToolInvocationPart_schema = z.object({
    pt: z.literal('tool_invocation'),
    id: z.string(),
    invocation: z.discriminatedUnion('type', [
      _FunctionCallInvocation_schema,
      _CodeExecutionInvocation_schema,
    ]),
  });

  // Tool Response

  const _FunctionCallResponse_schema = z.object({
    type: z.literal('function_call'),
    result: z.string(),
    _name: z.string().optional(),
  });

  const _CodeExecutionResponse_schema = z.object({
    type: z.literal('code_execution'),
    result: z.string(),
    // _variant: z.literal('gemini_auto_inline').optional(),
  });

  export const ToolResponsePart_schema = z.object({
    pt: z.literal('tool_response'),
    id: z.string(),
    response: z.discriminatedUnion('type', [
      _FunctionCallResponse_schema,
      _CodeExecutionResponse_schema,
    ]),
    error: z.string().or(z.boolean()).optional(),
    // _environment: z.enum(['upstream', 'server', 'client']).optional(),
  });

  // Metas

  export const MetaCacheControl_schema = z.object({
    pt: z.literal('meta_cache_control'),
    control: z.literal('anthropic-ephemeral'),
  });

  export const MetaInReferenceToPart_schema = z.object({
    pt: z.literal('meta_in_reference_to'),
    referTo: z.array(z.object({
      mrt: z.literal('dmsg'),
      mText: z.string(),
      mRole: z.string(),
    })),
  });

}

export namespace AixWire_Content {

  /// System Message

  export const SystemInstruction_schema = z.object({
    parts: z.array(z.discriminatedUnion('pt', [
      AixWire_Parts.TextPart_schema,
      AixWire_Parts.MetaCacheControl_schema,
    ])),
  });

  /// Chat Message

  export const UserMessage_schema = z.object({
    role: z.literal('user'),
    parts: z.array(z.discriminatedUnion('pt', [
      AixWire_Parts.TextPart_schema,
      AixWire_Parts.InlineImagePart_schema,
      AixWire_Parts.DocPart_schema,
      AixWire_Parts.MetaCacheControl_schema,
      AixWire_Parts.MetaInReferenceToPart_schema,
    ])),
  });

  export const ModelMessage_schema = z.object({
    role: z.literal('model'),
    parts: z.array(z.discriminatedUnion('pt', [
      AixWire_Parts.TextPart_schema,
      AixWire_Parts.InlineImagePart_schema,
      AixWire_Parts.ToolInvocationPart_schema,
      AixWire_Parts.MetaCacheControl_schema,
    ])),
  });

  export const ToolMessage_schema = z.object({
    role: z.literal('tool'),
    parts: z.array(z.discriminatedUnion('pt', [
      AixWire_Parts.ToolResponsePart_schema,
      AixWire_Parts.MetaCacheControl_schema,
    ])),
  });

  export const ChatMessage_schema = z.discriminatedUnion('role', [
    UserMessage_schema,
    ModelMessage_schema,
    ToolMessage_schema,
  ]);

}

export namespace AixWire_Tooling {

  /// Function Call Tool Definition

  const _FunctionCall_schema = z.object({
    /**
     * The name of the function to call. Up to 64 characters long, and can only contain letters, numbers, underscores, and hyphens.
     */
    name: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/, {
      message: 'Function name must be 1-64 characters long and contain only letters, numbers, underscores, and hyphens',
    }),
    /**
     * 3-4 sentences. Detailed description of what the tool does, when it should be used (and when not), what each parameter means, caveats and limitations.
     * - Good: "Retrieves the current stock price for a given ticker symbol. The ticker symbol must be a valid symbol for a publicly traded company on a major US stock exchange like NYSE or NASDAQ. The tool will return the latest trade price in USD. It should be used when the user asks about the current or most recent price of a specific stock. It will not provide any other information about the stock or company."
     * - Poor: "Gets the stock price for a ticker."
     */
    description: z.string(),
    /**
     *  A JSON Schema object defining the expected parameters for the function call.
     *  - Optional. If not provided, it means the Function Tool does not require any input and will be invoked without any arguments.
     *  (OpenAI + Google: parameters, Anthropic: input_schema)
     */
    input_schema: z.object({
      // type: z.literal('object'), // Note: every protocol adapter adds this in the structure, here's we're just opting to not add it
      properties: z.record(OpenAPI_Schema.Object_schema),
      required: z.array(z.string()).optional(),
    }).optional(),
  });

  const _FunctionCallTool_schema = z.object({
    type: z.literal('function_call'),
    function_call: _FunctionCall_schema,
    // domain: z.enum(['server', 'client']).optional(),
  });

  /// Code Execution Tool

  const _CodeExecutionTool_schema = z.object({
    type: z.literal('code_execution'),
    /**
     * For now we are supporting a single provider:
     * - gemini_auto_inline: Google Gemini, auto-invoked, and inline (runs the code and goes back to the model to continue the generation)
     */
    variant: z.enum(['gemini_auto_inline']),
  });

  /// Tool Definition

  /**
   * Describe 'Tools' available to the model.
   *   API for developers, this data does not get stored[1].
   *   Tools are items that require an input description and will produce an output.
   *
   * __Function Call Tools__
   * The model decides to invoke a function creates a JSON object to fill-in the
   * arguments of the function according to a developer-provided schema.
   * - [1] Note that the schema could be stored to the data as rest as part
   *       of DMessageToolCallPart messages.
   *
   * __Code Execution Tools__
   * Models of the Gemini family will emit a code exeuction Tool Call, then execute
   * the code into a sandboxed code interpreter, then emit a Tool Response with the
   * generated code and then resume execution of the code, inline.
   *
   * @example
   * [
   *  { type: 'function_call', function_call: { name: 'get_stock_price', description: 'Retrieves the current stock price for a given ticker symbol.', input_schema: { type: 'object', properties: { ticker: { type: 'string', description: 'The ticker symbol of the stock to get the price for.' } }, required: ['ticker'] } } },
   *  { type: 'code_execution', provider: 'gemini' },
   * ]
   * */
  export const Tool_schema = z.discriminatedUnion('type', [
    _FunctionCallTool_schema,
    _CodeExecutionTool_schema,
  ]);

  /// Tools Policy

  /**
   * Policy for tools that the model can use:
   * - auto: can use a tool or not (default, same as not specifying a policy)
   * - any: must use one tool at least
   * - function_call: must use a specific Function Tool
   * - none: same as not giving the model any tool [REMOVED - just give no tools]
   */
  export const ToolsPolicy_schema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('auto') }),
    z.object({ type: z.literal('any') /*, parallel: z.boolean()*/ }),
    z.object({ type: z.literal('function_call'), function_call: z.object({ name: z.string() }) }),
  ]);

}

export namespace AixWire_API {

  /// Access

  export const Access_schema = z.discriminatedUnion('dialect', [
    anthropicAccessSchema,
    geminiAccessSchema,
    ollamaAccessSchema,
    openAIAccessSchema,
  ]);

  /// Model

  export const Model_schema = z.object({
    id: z.string(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().min(1).optional(),
    topP: z.number().min(0).max(1).optional(),
    vndOaiReasoningEffort: z.enum(['low', 'medium', 'high']).optional(),
  });

  /// Context

  export const ContextChatGenerate_schema = z.object({
    method: z.literal('chat-generate'),
    name: z.enum([

      // non-streaming AI operations
      'chat-ai-summarize',
      'chat-ai-title',
      'chat-attachment-prompts',  // - id of the first fragment
      'chat-followup-diagram',
      'chat-followup-htmlui',
      'chat-react-turn',
      'draw-expand-prompt',
      'fixup-code',

      // streaming AI operations
      'ai-diagram',               // making a diagram - messageId
      'ai-flattener',             // flattening a thread - messageId of the first message
      'beam-gather',              // fusing beam rays - fusionId
      'beam-scatter',             // scattering beam rays - rayId
      'call',                     // having a phone conversation - messageId of the first message
      'conversation',             // chatting with a persona - conversationId
      'persona-extract',          // extracting a persona from texts - chainId

      // temporary (nothing is more permanent than a temporary fix that works well)
      '_DEV_',

    ]),
    ref: z.string(),
  });

  // For future use
  // export const Context_schema = z.discriminatedUnion('method', [
  //   ContextChatGenerate_schema,
  // ]);

  /// Connection options

  export const ConnectionOptions_schema = z.object({
    debugDispatchRequestbody: z.boolean().optional(),
    throttlePartTransmitter: z.number().optional(), // in ms
    // retry: z.number().optional(),
    // retryDelay: z.number().optional(),
  });

}

export namespace AixWire_API_ChatContentGenerate {

  /// Request

  export const Request_schema = z.object({
    systemMessage: AixWire_Content.SystemInstruction_schema.nullable(),
    chatSequence: z.array(AixWire_Content.ChatMessage_schema),
    tools: z.array(AixWire_Tooling.Tool_schema).optional(),
    toolsPolicy: AixWire_Tooling.ToolsPolicy_schema.optional(),
  });

  /// Response - Events Stream

  // const AixEventProto_schema = z.union([
  //   z.object({ t: z.string() }),
  //   z.object({ set: z.object({ model: z.string().optional() }) }),
  // ]);
  //
  // const AixControlProto_schema = z.object({
  //   type: z.enum(['start', 'done']),
  // });
  //
  // const AixErrorProto_schema = z.object({
  //   issueId: z.enum(['dispatch-prepare', 'dispatch-fetch', 'dispatch-read', 'dispatch-parse']),
  //   issueText: z.string(),
  // });

}


///  Output Types from AIX

/**
 * This is the protocol for both the control objects sent by the tRPC streaming procedures,
 * and the thePartTransmitter/PartReassembler.
 *
 * VITAL: when transmitting anything that's "undefined", leave it out of the
 * object rather than setting it as 'undefined' as 'superjson' will mess it up
 * and tRPC decoding will be broken (very important!)
 */
export namespace AixWire_Particles {

  /** Unified particle representation for outputs of chatGenerate */
  export type ChatGenerateOp =
    | ChatControlOp
    | TextParticleOp
    | PartParticleOp;


  // ChatControl

  type ChatControlOp =
  // | { cg: 'start' } // not really used for now
    | { cg: 'end', reason: CGEndReason, tokenStopReason: GCTokenStopReason }
    | { cg: 'issue', issueId: CGIssueId, issueText: string }
    | { cg: 'set-metrics', metrics: CGSelectMetrics }
    | { cg: 'set-model', name: string }
    | { cg: '_debugRequest', security: 'dev-env', request: { url: string, headers: string, body: string } }; // may generalize this in the future

  export type CGEndReason =     // the reason for the end of the chat generation
    | 'abort-client'            // user aborted before the end of stream
    | 'done-dialect'            // OpenAI signals the '[DONE]' event, or Anthropic sensds the 'message_stop' event
    | 'done-dispatch-aborted'   // this shall never see the light of day, as it was a reaction to the intake being aborted first
    | 'done-dispatch-closed'    // dispatch connection closed
    | 'issue-dialect'           // [1] ended because a dispatch encountered an issue, such as out-of-tokens, recitation, etc.
    | 'issue-rpc';              // [2] ended because of an issue

  export type CGIssueId =
    | 'dialect-issue'           // [1] when end reason = 'issue-dialect'
    | 'dispatch-prepare'        // [2] when end reason = 'issue-rpc', 4 phases of GC dispatch
    | 'dispatch-fetch'          // [2] "
    | 'dispatch-read'           // [2] "
    | 'dispatch-parse'          // [2] "
    | 'client-read';            // the aix client encountered an unexpected error (e.g. tRPC)

  export type GCTokenStopReason =
    | 'ok'                      // clean, including reaching 'stop sequences'
    | 'ok-tool_invocations'     // clean & tool invocations
    // premature:
    | 'cg-issue'                // [1][2] chat-generation issue (see CGIssueId)
    | 'client-abort-signal'     // the client aborted - likely a user/auto initiation
    | 'filter-content'          // content filter (e.g. profanity)
    | 'filter-recitation'       // recitation filter (e.g. recitation)
    | 'out-of-tokens';          // got out of tokens

  /**
   * NOTE: break compatbility with this D-stored-type only when we'll
   * start to need backwards-incompatible Particle->Reassembler flexibility,
   * which can't be just extended in the D-stored-type.
   *
   * We are now duplicating this, to force the type checker to reveal any discrepancies.
   */
  export type CGSelectMetrics = {
    // T = milliseconds
    TIn?: number,         // Portion of Input tokens which is new (not cached)
    TCacheRead?: number,
    TCacheWrite?: number,
    TOut?: number,
    TOutR?: number,       // Portion of TOut that was used for reasoning (e.g. not for output)
    // TOutA?: number,    // Portion of TOut that was used for Audio

    // dt = milliseconds
    dtStart?: number,
    dtInner?: number,
    dtAll?: number,

    // v = Tokens/s
    vTOutInner?: number,  // TOut / dtInner
  };

  // TextParticle / PartParticle - keep in line with the DMessage*Part counterparts

  export type TextParticleOp =
    | { t: string }; // special: incremental text, but with a more optimized/succinct representation compared to { p: 't_', i_t: string }

  export type PartParticleOp =
  // | { p: 'ii', mimeType: string, i_b64?: string /* never undefined */ }
  // | { p: '_ii', i_b64: string }
  // | { p: 'di', type: string, ref: string, l1Title: string, i_text?: string /* never undefined */ }
  // | { p: '_di', i_text: string }
    | { p: 'fci', id: string, name: string, i_args?: string /* never undefined */ }
    | { p: '_fci', _args: string }
    | { p: 'cei', id: string, language: string, code: string, author: 'gemini_auto_inline' }
    | { p: 'cer', id: string, error: DMessageToolResponsePart['error'], result: string, executor: 'gemini_auto_inline', environment: DMessageToolResponsePart['environment'] };

}
