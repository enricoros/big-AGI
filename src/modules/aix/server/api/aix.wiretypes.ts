import * as z from 'zod/v4';

// Used to align Particles to the Typescript definitions from the frontend-side, on 'chat.fragments.ts'
import type { DMessageToolResponsePart } from '~/common/stores/chat/chat.fragments';

import { anthropicAccessSchema } from '~/modules/llms/server/anthropic/anthropic.access';
import { geminiAccessSchema } from '~/modules/llms/server/gemini/gemini.access';
import { ollamaAccessSchema } from '~/modules/llms/server/ollama/ollama.access';
import { openAIAccessSchema } from '~/modules/llms/server/openai/openai.access';


//
// Design notes:
// - [Client -> AIX API calls] This encodes the structure sent to the AIX server API calls
// - Parts: mirror the Typescript definitions from the frontend-side, on 'chat.fragments.ts'
//


// Export types
export type AixParts_DocPart = z.infer<typeof AixWire_Parts.DocPart_schema>;
export type AixParts_InlineAudioPart = z.infer<typeof AixWire_Parts.InlineAudioPart_schema>;
export type AixParts_InlineImagePart = z.infer<typeof AixWire_Parts.InlineImagePart_schema>;
export type AixParts_ModelAuxPart = z.infer<typeof AixWire_Parts.ModelAuxPart_schema>;
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
export type AixAPI_ResumeHandle = z.infer<typeof AixWire_API.ResumeHandle_schema>;
export type AixAPI_ConnectionOptions_ChatGenerate = z.infer<typeof AixWire_API.ConnectionOptionsChatGenerate_schema>;
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
    properties: z.record(z.string(), z.any() /* could refer to self using z.lazy().... */).optional(),
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

  /** Parts that come from the model shall inherit this, so they can echo-back vendor data */
  const _BasePart_schema = z.object({

    /** DMessageFragment.vendorState <- model-generated, vendor-specific opaque state (protocol continuity, not content) */
    _vnd: z.object({
      gemini: z.object({
        thoughtSignature: z.string().optional(),
      }).optional(),
    }).optional(),
    // _vnd: z.record(z.string(), z.unknown()).optional(),

  });


  // User Input Parts

  export const TextPart_schema = _BasePart_schema.extend({
    pt: z.literal('text'),
    text: z.string(),
  });

  export const InlineAudioPart_schema = _BasePart_schema.extend({
    pt: z.literal('inline_audio'),
    /**
     * Minimal audio format support for browser compatibility:
     * - audio/wav: Most compatible, converted from Gemini PCM
     * - audio/mp3: Widely supported, efficient
     * - audio/ogg: Open format, good compression
     */
    mimeType: z.enum(['audio/wav', 'audio/mp3']), // was (['audio/wav', 'audio/mp3', 'audio/aiff', 'audio/aac', 'audio/ogg', 'audio/flac'])
    base64: z.string(),
    // sampleRate: z.number().optional(), // for PCM formats
    // channels: z.number().optional(),   // for PCM formats
    // durationMs: z.number().optional(),
  });

  // NOTE: different from DMessageImageRefPart, in that the image data is inlined rather than being referred to
  export const InlineImagePart_schema = _BasePart_schema.extend({
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

  export const ToolInvocationPart_schema = _BasePart_schema.extend({
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

  export const ToolResponsePart_schema = _BasePart_schema.extend({
    pt: z.literal('tool_response'),
    id: z.string(),
    response: z.discriminatedUnion('type', [
      _FunctionCallResponse_schema,
      _CodeExecutionResponse_schema,
    ]),
    error: z.string().or(z.boolean()).optional(),
    // _environment: z.enum(['upstream', 'server', 'client']).optional(),
  });

  // Model Auxiliary Part (for thinking blocks)

  // NOTE: not a _BasePart_schema for now, may become if we put the vndAnt attributes there
  export const ModelAuxPart_schema = z.object({
    pt: z.literal('ma'),
    aType: z.literal('reasoning'),
    aText: z.string(),
    textSignature: z.string().optional(),
    redactedData: z.array(z.string()).optional(),
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
      AixWire_Parts.DocPart_schema, // Jan 10, 2025: added support for Docs in AIX system
      AixWire_Parts.InlineImagePart_schema, // Sept 12, 2025: added support for Inline Images in AIX system
      AixWire_Parts.MetaCacheControl_schema,
    ])),
  });

  /// Chat Message

  export const UserMessage_schema = z.object({
    role: z.literal('user'),
    parts: z.array(z.discriminatedUnion('pt', [
      AixWire_Parts.TextPart_schema,
      // AixWire_Parts.InlineAudioPart_schema,
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
      AixWire_Parts.InlineAudioPart_schema,
      AixWire_Parts.InlineImagePart_schema,
      AixWire_Parts.ToolInvocationPart_schema,
      AixWire_Parts.ModelAuxPart_schema,
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
      properties: z.record(z.string(), OpenAPI_Schema.Object_schema),
      required: z.array(z.string()).optional(),
    }).optional(),

    /**
     * WARNING: Anthropic-ONLY for now - support for "Programmatic Tool Calling" - 2 new fields:
     * - allowed_callers: which contexts can invoke this tool, where 'direct' is the model itself, and 'code_execution' is when invoked from a container, and even both
     * - input_examples: array of example input objects that demonstrate format conventions, nested object population, etc.
     */
    allowed_callers: z.array(z.enum(['direct', 'code_execution'])).optional(),
    input_examples: z.array(z.record(z.string(), z.any())).optional(),
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
   * Models of the Gemini family will emit a code execution Tool Call, then execute
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
   * - any: MUST use one tool at least
   * - function_call: MUST use a specific Function Tool
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
    acceptsOutputs: z.array(z.enum(['text', 'image', 'audio'])),
    temperature: z.number().min(0).max(2).optional()
      .nullable(), // [Deepseek, 2025-01-20] temperature unsupported, so we use 'null' to omit it from the request
    maxTokens: z.number().min(1).optional(),
    topP: z.number().min(0).max(1).optional(),
    forceNoStream: z.boolean().optional(),

    // Cross-vendor Structured Outputs

    /**
     * Constrain model response to a JSON schema for data extraction. Response will be valid JSON. Schema limitations vary by vendor.
     * Supported: Anthropic (output_format), OpenAI (response_format), Gemini (responseSchema)
     */
    strictJsonOutput: z.object({
      name: z.string().optional(),        // Required by OpenAI, optional elsewhere
      description: z.string().optional(), // Helps model understand the schema's purpose
      schema: z.any(),                    // JSON Schema object
    }).optional(),

    /**
     * Enable strict schema validation for tool/function call invocations. Guarantees tool inputs exactly match the input_schema. Eliminates validation/retry logic.
     * Supported: Anthropic (strict:true), OpenAI (strict:true). Gemini: not supported yet.
     */
    strictToolInvocations: z.boolean().optional(),

    // Anthropic
    vndAnt1MContext: z.boolean().optional(),
    vndAntEffort: z.enum(['low', 'medium', 'high']).optional(),
    vndAntSkills: z.string().optional(),
    vndAntThinkingBudget: z.number().nullable().optional(),
    vndAntToolSearch: z.enum(['regex', 'bm25']).optional(), // Tool Search Tool variant
    vndAntWebFetch: z.enum(['auto']).optional(),
    vndAntWebSearch: z.enum(['auto']).optional(),
    // Gemini
    vndGeminiAspectRatio: z.enum(['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9']).optional(),
    vndGeminiCodeExecution: z.enum(['auto']).optional(),
    vndGeminiComputerUse: z.enum(['browser']).optional(),
    vndGeminiGoogleSearch: z.enum(['unfiltered', '1d', '1w', '1m', '6m', '1y']).optional(),
    vndGeminiImageSize: z.enum(['1K', '2K', '4K']).optional(),
    vndGeminiMediaResolution: z.enum(['mr_high', 'mr_medium', 'mr_low']).optional(),
    vndGeminiShowThoughts: z.boolean().optional(),
    vndGeminiThinkingBudget: z.number().optional(), // old param
    vndGeminiThinkingLevel: z.enum(['high', 'medium', 'low']).optional(), // new param
    vndGeminiUrlContext: z.enum(['auto']).optional(),
    // Moonshot
    vndMoonshotWebSearch: z.enum(['auto']).optional(),
    // OpenAI
    vndOaiResponsesAPI: z.boolean().optional(),
    vndOaiReasoningEffort: z.enum(['none', 'minimal', 'low', 'medium', 'high', 'xhigh']).optional(),
    vndOaiRestoreMarkdown: z.boolean().optional(),
    vndOaiVerbosity: z.enum(['low', 'medium', 'high']).optional(),
    vndOaiWebSearchContext: z.enum(['low', 'medium', 'high']).optional(),
    vndOaiImageGeneration: z.enum(['mq', 'hq', 'hq_edit', 'hq_png']).optional(),
    // OpenRouter
    vndOrtWebSearch: z.enum(['auto']).optional(),
    // Perplexity
    vndPerplexityDateFilter: z.enum(['unfiltered', '1m', '3m', '6m', '1y']).optional(),
    vndPerplexitySearchMode: z.enum(['default', 'academic']).optional(),
    // xAI
    vndXaiSearchMode: z.enum(['auto', 'on', 'off']).optional(),
    vndXaiSearchSources: z.string().optional(),
    vndXaiSearchDateFilter: z.enum(['unfiltered', '1d', '1w', '1m', '6m', '1y']).optional(),
    /**
     * [OpenAI, 2025-03-11] This is the generic version of the `web_search_options.user_location` field
     * This AIX field mimics on purpose: https://platform.openai.com/docs/api-reference/chat/create
     */
    userGeolocation: z.object({
      city: z.string().optional(),      // free text input for the city of the user, e.g. San Francisco.
      country: z.string().optional(),   // two-letter ISO country code of the user, e.g. US
      region: z.string().optional(),    // free text input for the reg. of the user the user, e.g. California
      timezone: z.string().optional(),  // IANA timezone of the user, e.g. America/Los_Angeles
    }).optional(),
  });

  /// Resume Handle

  /**
   * TEMP - Not well defined yet - OpenAI Responses-only implementation
   * [OpenAI Responses API] Allows reconnecting to an in-progress response by its ID.
   */
  export const ResumeHandle_schema = z.object({
    responseId: z.string(),
    startingAfter: z.number().optional(), // the sequence number of event after which to start streaming
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
      'aifn-image-caption',       // generating image captions - attachmentId
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

  export const ConnectionOptionsChatGenerate_schema = z.object({

    /**
     * Request an echo of the upstream AIX dispatch request. Fulfillment is decided by the server, and 'production' builds will NOT include 'headers', just the 'body'.
     */
    debugDispatchRequest: z.boolean().optional(),

    /**
     * Request profiling data for a streaming call: time spent preparing, connecting, waiting, receiving, etc. Fulfillment is decided by the server, and won't be available on 'production' builds.
     */
    debugProfilePerformance: z.boolean().optional(),

    /**
     * Request a resumable connection, if the model/service supports it.
     * - enables response storage for resumability (first found in the OpenAI Responses API)
     */
    enableResumability: z.boolean().optional(),

    // Old ideas:
    // throttleParticleTransmitter: z.number().optional(), // in ms
    // retry: z.number().optional(), // retry upstream

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

  export type ChatControlOp =
  // | { cg: 'start' } // not really used for now
    | { cg: 'end', reason: CGEndReason, tokenStopReason: GCTokenStopReason }
    | { cg: 'issue', issueId: CGIssueId, issueText: string }
    | { cg: 'retry-reset', rScope: 'srv-dispatch' | 'srv-op' | 'cli-ll', rShallClear: boolean, reason: string, attempt: number, maxAttempts: number, delayMs: number, causeHttp?: number, causeConn?: string }
    | { cg: 'set-metrics', metrics: CGSelectMetrics }
    | { cg: 'set-model', name: string }
    | { cg: 'set-upstream-handle', handle: { uht: 'vnd.oai.responses', responseId: string, expiresAt: number | null } }
    | { cg: '_debugDispatchRequest', security: 'dev-env', dispatchRequest: { url: string, headers: string, body: string, bodySize: number } } // may generalize this in the future
    | { cg: '_debugProfiler', measurements: Record<string, number | string>[] };

  export type CGEndReason =     // the reason for the end of the chat generation
    | 'abort-client'            // user aborted before the end of stream
    | 'done-dialect'            // OpenAI signals the '[DONE]' event, or Anthropic sends the 'message_stop' event
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
    | 'ok-pause_continue'       // clean, but paused (e.g. Anthropic server tools like web search) - requires continuation
    // premature:
    | 'cg-issue'                // [1][2] chat-generation issue (see CGIssueId, mostly a dispatch or dialect issue)
    | 'client-abort-signal'     // the client aborted - likely a user/auto initiation
    | 'filter-content'          // content filter (e.g. profanity)
    | 'filter-recitation'       // recitation filter (e.g. recitation)
    | 'filter-refusal'          // safety refusal filter (e.g. Anthropic safety concerns)
    | 'out-of-tokens';          // got out of tokens

  /**
   * NOTE: break compatibility with this D-stored-type only when we'll
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

    // $c = Cents of USD
    $cReported?: number,  // Total cost in cents as reported by provider (e.g. Perplexity usage.cost.total_cost)
  };

  // TextParticle / PartParticle - keep in line with the DMessage*Part counterparts

  export type TextParticleOp =
    | { t: string }; // special: incremental text, but with a more optimized/succinct representation compared to { p: 't_', i_t: string }

  export type PartParticleOp =
    | { p: '❤' } // heart beat
    | { p: 'tr_', _t: string, weak?: 'tag', restart?: boolean } // reasoning text, incremental; could be a 'weak' detection, e.g. heuristic from '<think>' rather than API-provided
    | { p: 'trs', signature: string } // reasoning signature
    | { p: 'trr_', _data: string } // reasoning raw (or redacted) data
    // | { p: 'ii', mimeType: string, i_b64?: string /* never undefined */ }
    // | { p: '_ii', i_b64: string }
    // | { p: 'di', type: string, ref: string, l1Title: string, i_text?: string /* never undefined */ }
    // | { p: '_di', i_text: string }
    | { p: 'fci', id: string, name: string, i_args?: string /* never undefined */ }
    | { p: '_fci', _args: string }
    | { p: 'cei', id: string, language: string, code: string, author: 'gemini_auto_inline' }
    | { p: 'cer', id: string, error: DMessageToolResponsePart['error'], result: string, executor: 'gemini_auto_inline', environment: DMessageToolResponsePart['environment'] }
    | { p: 'ia', mimeType: string, a_b64: string, label?: string, generator?: string, durationMs?: number } // inline audio, complete
    | { p: 'ii', mimeType: string, i_b64: string, label?: string, generator?: string, prompt?: string } // inline image, complete
    | { p: 'urlc', title: string, url: string, num?: number, from?: number, to?: number, text?: string, pubTs?: number } // url citation - pubTs: publication timestamp
    | { p: 'svs', vendor: string, state: Record<string, unknown> } // set vendor state - applies to the last emitted part (opaque protocol state)
    | { p: 'vp', text: string, mot: 'search-web' | 'gen-image' | 'code-exec' }; // void placeholder - temporary status text that gets wiped when real content arrives

}
