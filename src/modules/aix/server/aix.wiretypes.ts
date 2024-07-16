import { z } from 'zod';

//
// Design notes:
// - [Client -> AIX API calls] This encodes the structure sent to the AIX server API calls
// - Parts: mirror the Typescript definitions from the frontend-side, on 'chat.fragments.ts'
//


// Export types
// export type IntakeWire_DocPart = z.infer<typeof IntakeWire_Parts.DocPart_schema>;
// export type IntakeWire_InlineImagePart = z.infer<typeof IntakeWire_Parts.InlineImagePart_schema>;
// export type IntakeWire_MetaReplyToPart = z.infer<typeof IntakeWire_Parts.MetaReplyToPart_schema>;
// export type IntakeWire_ChatMessage = z.infer<typeof IntakeWire_Messages.ChatMessage_schema>;
// export type IntakeWire_SystemMessage = z.infer<typeof IntakeWire_Messages.SystemMessage_schema>;


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
  export const Object = z.object({
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

  // Content Parts

  export const TextPart_schema = z.object({
    pt: z.literal('text'),
    text: z.string(),
  });

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
    type: z.enum([
      'application/vnd.agi.ego',
      'application/vnd.agi.ocr',
      'text/html',
      'text/markdown',
      'text/plain',
    ]),

    // identifier of the document, to be known to the model, as unique as possible, for the purpose of versioning
    ref: z.string(),

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
    args: z.string().nullable(),
    // _description: z.string().optional(),
    // _args_schema: z.object({}).optional(),
  });

  const _CodeExecutionInvocation_schema = z.object({
    type: z.literal('code_execution'),
    variant: z.literal('gemini_auto_inline').optional(),
    arguments: z.object({
      code: z.string(),
      language: z.string().optional(),
    }),
  });

  export const ToolInvocationPart_schema = z.object({
    pt: z.literal('tool_call'),
    id: z.string(),
    call: z.discriminatedUnion('type', [
      _FunctionCallInvocation_schema,
      _CodeExecutionInvocation_schema,
    ]),
  });

  // Tool Response

  const _FunctionCallResponse_schema = z.object({
    type: z.literal('function_call'),
    result: z.string(),
    // _name: z.string().optional(),
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

  export const MetaReplyToPart_schema = z.object({
    pt: z.literal('meta_reply_to'),
    replyTo: z.string(),
  });

}

export namespace AixWire_Messages {

  /// System Message

  export const SystemMessage_schema = z.object({
    parts: z.array(AixWire_Parts.TextPart_schema),
  });

  /// Chat Message

  const _UserMessage_schema = z.object({
    role: z.literal('user'),
    parts: z.array(z.discriminatedUnion('pt', [
      AixWire_Parts.TextPart_schema,
      AixWire_Parts.InlineImagePart_schema,
      AixWire_Parts.DocPart_schema,
      AixWire_Parts.MetaReplyToPart_schema,
    ])),
  });

  const _ModelMessage_schema = z.object({
    role: z.literal('model'),
    parts: z.array(z.discriminatedUnion('pt', [
      AixWire_Parts.TextPart_schema,
      AixWire_Parts.InlineImagePart_schema,
      AixWire_Parts.ToolInvocationPart_schema,
    ])),
  });

  const _ToolMessage_schema = z.object({
    role: z.literal('tool'),
    parts: z.array(z.discriminatedUnion('pt', [
      AixWire_Parts.ToolResponsePart_schema,
    ])),
  });

  export const ChatMessage_schema = z.discriminatedUnion('role', [
    _UserMessage_schema,
    _ModelMessage_schema,
    _ToolMessage_schema,
  ]);

}

export namespace AixWire_Tools {

  /// Function Call Tool

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
     *  (OpenAI, Google: parameters, Anthropic: input_schema)
     */
    input_schema: z.object({
      properties: z.record(OpenAPI_Schema.Object),
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

export namespace AixWire_API_ChatGenerate {

  /// Request

  export const Request_schema = z.object({
    systemMessage: AixWire_Messages.SystemMessage_schema.optional(),
    chatSequence: z.array(AixWire_Messages.ChatMessage_schema),
    tools: z.array(AixWire_Tools.Tool_schema).optional(),
    toolsPolicy: AixWire_Tools.ToolsPolicy_schema.optional(),
  });

  export const Context_ChatStream_schema = z.object({
    method: z.literal('chat-stream'),
    name: z.enum(['conversation', 'ai-diagram', 'ai-flattener', 'call', 'beam-scatter', 'beam-gather', 'persona-extract']),
    ref: z.string(),
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
