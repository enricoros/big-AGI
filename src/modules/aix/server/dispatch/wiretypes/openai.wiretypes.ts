import * as z from 'zod/v4';


//
// Implementation notes (see https://platform.openai.com/docs/changelog for upstream changes):
// - 2024-12-17: "Reasoning Effort" - added reasoning_effort and the 'developer' message role
// - 2024-11-05: "Predicted Outputs"
// - 2024-10-17: "gpt-4o-audio-preview" - not fully added: "Audio inputs and outputs are now available in the Chat Completions API" - TBA
// - 2024-10-01: "DevDay" - added prompt_tokens_details, audio_tokens, and refusal messages
// - 2024-09-12: "o1" - max_tokens is deprecated in favor of max_completion_tokens, added completion_tokens_details
// - 2024-08-06: "Structured Outputs" - added JSON Schema and strict schema adherence
// - 2024-07-09: skipping Functions as they're deprecated
// - 2024-07-09: ignoring logprobs
// - 2024-07-09: ignoring the advanced model configuration
//


export namespace OpenAIWire_ContentParts {

  /// Content parts - Input

  export type TextContentPart = z.infer<typeof TextContentPart_schema>;
  const TextContentPart_schema = z.object({
    type: z.literal('text'),
    text: z.string(),
  });

  const ImageContentPart_schema = z.object({
    type: z.literal('image_url'),
    image_url: z.object({
      // Either a URL of the image or the base64 encoded image data.
      url: z.string(),
      // Control how the model processes the image and generates its textual understanding.
      // https://platform.openai.com/docs/guides/vision/low-or-high-fidelity-image-understanding
      detail: z.enum(['auto', 'low', 'high']).optional(),
    }),
  });

  const OpenAI_AudioContentPart_schema = z.object({
    // [OpenAI, 2024-10-17] input content: audio
    type: z.literal('input_audio'),
    input_audio: z.object({
      // Base64 encoded audio data.
      data: z.string(),
      // The format of the encoded audio data. Currently supports "wav" and "mp3".
      format: z.enum(['wav', 'mp3']),
    }),
  });

  export const ContentPart_schema = z.discriminatedUnion('type', [
    TextContentPart_schema,
    ImageContentPart_schema,
    OpenAI_AudioContentPart_schema,
  ]);

  export function TextContentPart(text: string): z.infer<typeof TextContentPart_schema> {
    return { type: 'text', text };
  }

  export function ImageContentPart(url: string, detail?: 'auto' | 'low' | 'high'): z.infer<typeof ImageContentPart_schema> {
    return { type: 'image_url', image_url: { url, detail } };
  }

  export function OpenAI_AudioContentPart(data: string, format: 'wav' | 'mp3'): z.infer<typeof OpenAI_AudioContentPart_schema> {
    return { type: 'input_audio', input_audio: { data, format } };
  }

  /// Content parts - Output

  const PredictedFunctionCall_schema = z.object({
    /*
     * .optional: for Mistral non-streaming generation - this is fairly weak, and does not let the discriminator work;
     *            please remove this hack asap.
     */
    type: z.literal('function').optional(),
    id: z.string(),
    function: z.object({
      name: z.string(),
      /**
       * Note that the model does not always generate valid JSON, and may hallucinate parameters
       * not defined by your function schema.
       * Validate the arguments in your code before calling your function.
       */
      arguments: z.string(), // FC args STRING
    }),
  });

  export function PredictedFunctionCall(toolCallId: string, functionName: string, functionArgs: string): z.infer<typeof PredictedFunctionCall_schema> {
    return { type: 'function', id: toolCallId, function: { name: functionName, arguments: functionArgs } };
  }

  export const ToolCall_schema = z.discriminatedUnion('type', [
    PredictedFunctionCall_schema,
  ]);

  /// Annotation - Output - maybe not even content parts

  export const OpenAI_AnnotationObject_schema = z.object({
    type: z.literal('url_citation'),
    url_citation: z.object({
      start_index: z.number().optional(),
      end_index: z.number().optional(),
      title: z.string(),
      url: z.string(),
    }),
  });

}

export namespace OpenAIWire_Messages {

  /// Messages - Input

  // const _optionalParticipantName = z.string().optional();

  const SystemMessage_schema = z.object({
    role: z.literal('system'),
    content: z.string(),
    // name: _optionalParticipantName,
  });

  const OpenAI_DeveloperMessage_schema = z.object({
    // [OpenAI, 2024-12-17] The developer message
    role: z.literal('developer'),
    content: z.string(), // Note: content could be an unspecified 'array' according to the docs, but we constrain it to string here
    // name: _optionalParticipantName,
  });

  const UserMessage_schema = z.object({
    role: z.literal('user'),
    content: z.union([z.string(), z.array(OpenAIWire_ContentParts.ContentPart_schema)]),
    // name: _optionalParticipantName,
  });

  export const AssistantMessage_schema = z.object({
    role: z.literal('assistant'),
    /**
     * The contents of the assistant message. Required unless tool_calls or function_call is specified.
     *
     * NOTE: the assistant message is also extending to be an array, but as of 2024-12-24, it's not important
     *       enough to require array support. The documentation of the array[] behavior of the field is:
     *       "An array of content parts with a defined type. Can be one or more of type text, or exactly one of type refusal."
     */
    content: z.string().nullable(),
    /**
     * The tool calls generated by the model, such as function calls.
     */
    tool_calls: z.array(OpenAIWire_ContentParts.ToolCall_schema).optional()
      .nullable(), // [Mistral] added .nullable()
    /**
     * [OpenAI, 2024-10-01] The refusal message generated by the model.
     */
    refusal: z.string().nullable().optional(),
    /**
     * [OpenAI, 2024-10-17] Data about a previous audio response from the model. Usage depends on the context:
     * - request (this schema): has an id, if present
     * - non-streaming response: has the generated audio and some metadata
     * - streaming response: NO audio fields
     */
    audio: z.object({
      id: z.string(),
    }).nullable().optional(),

    /**
     * [OpenRouter, 2025-06-05] The reasoning text generated by the model (e.g. with Anthropic thinking requests).
     */
    reasoning: z.string().nullable().optional(),

    // function_call: // ignored, as it's deprecated
    // name: _optionalParticipantName, // omitted by choice: generally unsupported
  });

  const ToolMessage_schema = z.object({
    role: z.literal('tool'),
    content: z.string(), // FC-R response STRING
    tool_call_id: z.string(),
  });

  export function ToolMessage(toolCallId: string, content: string): z.infer<typeof ToolMessage_schema> {
    return { role: 'tool', content, tool_call_id: toolCallId };
  }

  export const Message_schema = z.discriminatedUnion('role', [
    SystemMessage_schema,
    OpenAI_DeveloperMessage_schema,
    UserMessage_schema,
    AssistantMessage_schema,
    ToolMessage_schema,
  ]);

}

export namespace OpenAIWire_Tools {

  /// Tool definitions - Input

  export type FunctionDefinition = z.infer<typeof FunctionDefinition_schema>;
  export const FunctionDefinition_schema = z.object({
    /**
     * The name of the function to be called. Must be a-z, A-Z, 0-9, or contain underscores and dashes, with a maximum length of 64.
     */
    name: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/, {
      message: 'Tool name must be 1-64 characters long and contain only letters, numbers, underscores, and hyphens',
    }),
    /**
     * A description of what the function does, used by the model to choose when and how to call the function.
     */
    description: z.string().optional(),
    /**
     * The parameters the functions accepts, described as a JSON Schema object.
     * Omitting parameters defines a function with an empty parameter list.
     */
    parameters: z.object({
      type: z.literal('object'),
      /**
       * For stricter validation, use the OpenAPI_Schema.Object_schema
       */
      properties: z.json().optional(), // FC-DEF params schema
      required: z.array(z.string()).optional(),
    }).optional(),
    /**
     * [OpenAI Structured Outputs, 2024-08-06]
     * Whether to enable strict schema adherence when generating the function call. Defaults to false.
     * [OpenAI] Only a subset of the schema would be supported and enforced.
     */
    strict: z.boolean().optional(),
  });

  export const ToolDefinition_schema = z.discriminatedUnion('type', [
    z.object({
      type: z.literal('function'),
      function: FunctionDefinition_schema,
    }),
  ]);

  export const ToolChoice_schema = z.union([
    z.literal('none'), // Do not use any tools
    z.literal('auto'), // Let the model decide whether to use tools or generate content
    z.literal('required'), // Must call one or more
    z.object({
      type: z.literal('function'),
      function: z.object({ name: z.string() }),
    }),
    // [Mistral] Mistral only, requires an 'any' value
    // Commented because we'll disable Mistral function calling instead
    // z.literal('any'),
  ]);

}


//
// Chat > Create chat completion
//
export namespace OpenAIWire_API_Chat_Completions {

  /// Request

  export type Request = z.infer<typeof Request_schema>;
  export const Request_schema = z.object({

    // basic input
    model: z.string(),
    messages: z.array(OpenAIWire_Messages.Message_schema),

    // tool definitions and calling policy
    tools: z.array(OpenAIWire_Tools.ToolDefinition_schema).optional(),
    tool_choice: OpenAIWire_Tools.ToolChoice_schema.optional(),
    parallel_tool_calls: z.boolean().optional(), // defaults to true

    // common model configuration
    max_completion_tokens: z.number().int().positive().optional(), // [OpenAI o1, 2024-09-12]
    max_tokens: z.number().optional(), // Deprecated in favor of max_completion_tokens - but still used by pre-o1 models and OpenAI-compatible APIs
    temperature: z.number().min(0).max(2).optional(),
    top_p: z.number().min(0).max(1).optional(),

    // new output modalities
    modalities: z.array(z.enum(['text', 'audio'])).optional(), // defaults to ['text']
    audio: z.object({  // Parameters for audio output. Required when audio output is requested with `modalities: ["audio"]`
      voice: z.enum([
        'ash', 'ballad', 'coral', 'sage', 'verse', // recommended
        'alloy', 'echo', 'shimmer', // discouraged
      ]),
      format: z.enum(['wav', 'mp3', 'flac', 'opus', 'pcm16']),
    }).optional(),

    // API configuration
    n: z.number().int().positive().optional(), // Defaults to 1, as the derived-ecosystem does not support it
    stream: z.boolean().optional(), // If set, partial message deltas will be sent, with the stream terminated by a `data: [DONE]` message.
    stream_options: z.object({
      include_usage: z.boolean().optional(), // If set, an additional chunk will be streamed with a 'usage' field on the entire request.
    }).optional(),
    reasoning_effort: z.enum(['low', 'medium', 'high']).optional(), // [OpenAI, 2024-12-17] [Perplexity, 2025-06-23] reasoning effort
    include_reasoning: z.boolean().optional(), // [OpenRouter, 2025-01-24] enables reasoning tokens
    reasoning: z.object({ // [OpenRouter, 2025-06-05] Reasoning parameter for Claude models
      max_tokens: z.number().int().positive(),
    }).optional(),
    prediction: z.object({ // [OpenAI, 2024-11-05] Predicted Outputs - for regenerating a file with only minor changes to most of the content.
      type: z.literal('content'),
      content: z.union([z.string(), z.array(OpenAIWire_ContentParts.ContentPart_schema)]),
    }).optional(),
    response_format: z.discriminatedUnion('type', [
      z.object({
        type: z.literal('text'), // Default
      }),
      /**
       * When using JSON mode, you must also instruct the model to produce JSON
       * yourself via a system or user message. Without this, the model may generate
       * an unending stream of whitespace until the generation reaches the token limit,
       * resulting in a long-running and seemingly "stuck" request.
       *
       * Also note that the message content may be partially cut off if
       * finish_reason="length", which indicates the generation exceeded max_tokens or
       * the conversation exceeded the max context length.
       */
      z.object({
        type: z.literal('json_object'),
      }),
      /**
       * [OpenAI Structured Outputs, 2024-08-06]
       * Whether to enable strict schema adherence when generating the output.
       * If set to true, the model will always follow the exact schema defined
       * in the schema field.
       * Only a subset of JSON Schema is supported when strict is true.
       */
      z.object({
        type: z.literal('json_schema'),
        json_schema: z.object({
          name: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
          description: z.string().optional(),
          schema: z.json().optional(), // JSON Mode: schema
          strict: z.boolean().optional(),
        }),
      }),
    ]).optional(),
    web_search_options: z.object({
      /**
       * High level guidance for the amount of context window space to use for the search. One of low, medium, or high. medium is the default.
       */
      search_context_size: z.enum(['low', 'medium', 'high']).optional(),
      /**
       * Approximate location parameters for the search.
       */
      user_location: z.object({
        type: z.literal('approximate'),
        approximate: z.object({
          city: z.string().optional(),      // free text for the city of the user, e.g. 'San Francisco'
          country: z.string().optional(),   // two-letter ISO country code of the user, e.g. 'US'
          region: z.string().optional(),    // free text, e.g. 'California'
          timezone: z.string().optional(),  // IANA timezone of the user, e.g. 'America/Los_Angeles'
        }),
      }).nullable().optional(),
    }).optional(),

    // [Perplexity, 2025-06-23] Perplexity-specific search parameters
    search_mode: z.enum(['academic']).optional(), // Academic filter for scholarly sources
    search_after_date_filter: z.string().optional(), // Date filter in MM/DD/YYYY format

    seed: z.number().int().optional(),
    stop: z.array(z.string()).optional(), // Up to 4 sequences where the API will stop generating further tokens.
    user: z.string().optional(),

    // (deprecated upstream, OMITTED BY CHOICE): function_call and functions

    // (OMITTED BY CHOICE) advanced model configuration
    // frequency_penalty: z.number().min(-2).max(2).optional(), // Defaults to 0
    // presence_penalty: z.number().min(-2).max(2).optional(),  // Defaults to 0
    // logit_bias: z.record(z.number()).optional(),
    // logprobs: z.boolean().optional(), // Defaults to false
    // top_logprobs: z.number().int().min(0).max(20).optional(),

    // (OMITTED BY CHOICE) advanced API configuration
    // store: z.boolean().optional(), // Defaults to false. Whether or not to store the output of this chat completion request for use in our model distillation or evals products.
    // metadata: z.record(z.string(), z.any()).optional(), // Developer-defined tags and values used for filtering completions in [the dashboard](https://platform.openai.com/completions)
    // service_tier: z.string().optional(),

  });

  /// Response

  const FinishReason_Enum = z.enum([
    'stop', // natural completion, or stop sequence hit
    'length', // max_tokens exceeded
    'tool_calls', // the model called a tool
    'content_filter', // upstream content was omitted due to a flag from content filters

    // Disabling Function Call, OMITTED BY CHOICE
    // 'function_call', // (deprecated) the model called a function

    // Extensions // disabled: we now use a string union to accept any value without breaking
    // '', // [LocalAI] bad response from LocalAI which breaks the parser
    // 'COMPLETE', // [OpenRouter->Command-R+]
    // 'STOP', // [OpenRouter->Gemini]
    // 'end_turn', // [OpenRouter->Anthropic]
    // 'eos', // [OpenRouter->Phind]
    // 'error', // [OpenRouter] their network error
    // 'stop_sequence', // [OpenRouter->Anthropic] added 'stop_sequence' which is the same as 'stop'
  ]);

  const Usage_schema = z.object({
    prompt_tokens: z.number(),
    completion_tokens: z.number(),
    total_tokens: z.number(),

    // [OpenAI, 2024-10-01] breaks down the input tokens into components
    prompt_tokens_details: z.object({
      audio_tokens: z.number().optional(),
      cached_tokens: z.number().optional(),
    }).optional()
      .nullable(), // [2025-06-02] Chutes.ai using slang server returns null for prompt_tokens_details

    // [OpenAI o1, 2024-09-12] breaks down the completion tokens into components
    completion_tokens_details: z.object({
      reasoning_tokens: z.number().optional(), // [Discord, 2024-04-10] reported missing
      // text_tokens: z.number().optional(), // [Discord, 2024-04-10] revealed as present on custom OpenAI endpoint - not using it here yet
      audio_tokens: z.number().optional(), // [OpenAI, 2024-10-01] audio tokens used in the completion (charged at a different rate)
      accepted_prediction_tokens: z.number().optional(), // [OpenAI, 2024-11-05] Predicted Outputs
      rejected_prediction_tokens: z.number().optional(), // [OpenAI, 2024-11-05] Predicted Outputs
    }).optional() // not present in other APIs yet
      .nullable(), // [2025-06-02] no issues yet, but preventive

    // [DeepSeek, 2024-08-02] context caching on disk
    prompt_cache_hit_tokens: z.number().optional(),
    prompt_cache_miss_tokens: z.number().optional(),
  }).nullable();

  /**
   * NOTE: this is effectively the OUTPUT message (from the Chat Completion output object).
   * - 2025-03-11: the docs show that 'role' is not mandated to be 'assistant' anymore and could be different
   */
  const ChoiceMessage_NS_schema = OpenAIWire_Messages.AssistantMessage_schema.extend({
    //
    // IMPORTANT - this message *extends* the AssistantMessage_schema, to inherit all fields while performing any other change
    //

    // .string, instead of .assistant -- but we keep it strict for now, for parser correctness
    // role: z.string(),

    // .optional: when parsing a non-streaming message with just a FC, the content can be missing
    content: z.string().nullable().optional(),

    /**
     * [OpenAI, 2025-03-11] Annotations
     * This is a full assistant message, which is parsed by the non-streaming parser.
     */
    annotations: z.array(OpenAIWire_ContentParts.OpenAI_AnnotationObject_schema).nullable().optional(),

    /**
     * [OpenAI, 2024-10-17] Audio output (non-streaming only)
     * If the audio output modality is requested, this object contains data about the audio response from the model
     */
    audio: z.object({
      id: z.string(),
      data: z.string(), // Base64 encoded audio data
      expires_at: z.number(), // Unix timestamp
      transcript: z.string().optional(),
    }).nullable().optional(),

  });

  const Choice_NS_schema = z.object({
    index: z.number(),

    // NOTE: the OpenAI api does not force role: 'assistant', it's only induced
    // We recycle the assistant message response here, with either content or tool_calls
    message: ChoiceMessage_NS_schema,

    finish_reason: z.union([FinishReason_Enum, z.string()])
      .nullable(),

    // (OMITTED BY CHOICE) We will not support logprobs for now, so it's disabled here and in the request
    // logprobs: z.any().nullable().optional() // Log probability information for the choice.
  });

  export type Response = z.infer<typeof Response_schema>;
  export const Response_schema = z.object({
    object: z.literal('chat.completion'),
    id: z.string(), // A unique identifier for the chat completion.

    /**
     * A list of chat completion choices. Can be more than one if n is greater than 1.
     */
    choices: z.array(Choice_NS_schema),

    model: z.string(), // The model used for the chat completion.
    usage: Usage_schema.optional(), // If requested
    created: z.number(), // The Unix timestamp (in seconds) of when the chat completion was created.
    system_fingerprint: z.string().optional() // The backend configuration that the model runs with.
      .nullable(), // [Groq, undocumented OpenAI] fingerprint is null on some OpenAI examples too
    // service_tier: z.string().optional().nullable(), // OMITTED BY CHOICE

    // undocumented messages that are not part of the official schema, but can be found when the server sends and error
    error: z.any().optional(),
    warning: z.unknown().optional(),

    // [Perplexity] String array of citations, the first element is the first reference, i.e. '[1]'.
    // DEPRECATED: The citations field is being deprecated in favor of the new search_results field
    citations: z.array(z.any()).optional(),
    // [Perplexity, 2025-06-23] Search results
    search_results: z.array(z.object({
      title: z.string().optional().nullable(), // Title of the search result
      url: z.string().optional().nullable(), // URL of the search result
      date: z.string().optional().nullable(), // Date of the search result, e.g. '2024-01-01'
    })).optional(),
  });

  /// Streaming Response

  const _UndocumentedError_schema = z.object({
    // (undocumented) first experienced on 2023-06-19 on streaming APIs
    message: z.string().optional(),
    type: z.string().optional(),
    param: z.string().nullable().optional(),
    code: z.string().nullable().optional()
      .or(z.number()), // [OpenRouter, 2024-11-21] code can be a number too

    // [OpenRouter, 2024-11-21] OpenRouter can have an additional 'metadata' field
    metadata: z.record(z.string(), z.any()).optional(),
  });

  const _UndocumentedWarning_schema = z.string();

  /* Note: this is like the predicted function call, but with fields optional,
     as after the first chunk (which carries type and id), the model will just emit
     some index and function.arguments

     Note2: we found issues with Together, Openrouter, Mistral, and others we don't remember
     This object's status is really a mess for OpenAI and their downstream 'compatibles'.
   */
  const ChunkDeltaToolCalls_schema = z.object({
    index: z.number() // index is not present in non-streaming calls
      .optional(), // [Mistral] not present

    type: z.literal('function').optional(), // currently (2024-10-01) only 'function' is supported

    id: z.string().optional(), // id of the tool call - set likely only in the first chunk

    function: z.object({
      /**
       * Empirical observations:
       * - the name field seems to be set, in full, in the first call
       * - [TogetherAI] added .nullable() - exclusive with 'arguments'
       */
      name: z.string().optional().nullable(),
      /**
       * Note that the model does not always generate valid JSON, and may hallucinate parameters
       * not defined by your function schema.
       * Validate the arguments in your code before calling your function.
       * [TogetherAI] added .nullable() - exclusive with 'name'
       */
      arguments: z.string().optional().nullable(),
    }),
  });

  const ChunkDelta_schema = z.object({
    role: z.literal('assistant').optional()
      .nullable(), // [Deepseek] added .nullable()
    // delta-text content
    content: z.string().nullable().optional(),
    // delta-reasoning content
    reasoning_content: z.string().nullable().optional(), // [Deepseek, 2025-01-20]
    reasoning: z.string().optional() // [OpenRouter, 2025-01-24]
      .nullable(), // [OpenRouter, 2025-06-05] null on Anthropic text responses past the reasoning blocks
    // delta-tool-calls content
    tool_calls: z.array(ChunkDeltaToolCalls_schema).optional()
      .nullable(), // [TogetherAI] added .nullable(), see https://github.com/togethercomputer/together-python/issues/160
    refusal: z.string().nullable().optional(), // [OpenAI, 2024-10-01] refusal message
    /**
     * [OpenAI, 2025-03-11] Annotations
     * not documented yet in the API guide; shall improve this once defined
     */
    annotations: z.array(OpenAIWire_ContentParts.OpenAI_AnnotationObject_schema).optional(),
  });

  const ChunkChoice_schema = z.object({
    index: z.number()
      .optional(), // [OpenRouter] added .optional() which implies index=0 I guess

    // A chat completion delta generated by streamed model responses.
    delta: ChunkDelta_schema,

    finish_reason: z.union([FinishReason_Enum, z.string()])
      .nullable()   // very common, e.g. Azure
      .optional(),  // [OpenRouter] added .optional() which only has the delta field in the whole chunk choice

    // (OMITTED BY CHOICE) We will not support logprobs for now, so it's disabled here and in the request
    // logprobs: z.any().nullable().optional() // Log probability information for the choice.
  });

  export const ChunkResponse_schema = z.object({
    object: z.enum([
      'chat.completion.chunk',
      'chat.completion', // [Perplexity] sent an email on 2024-07-14 to inform them about the misnomer
      '', // [Azure] bad response: the first packet communicates 'prompt_filter_results'
    ])
      .optional(), // [FastAPI, 2025-04-24] the FastAPI dialect sadly misses the 'chat.completion.chunk' type
    id: z.string(),

    /**
     * A list of chat completion choices.
     * Can contain more than one elements if n is greater than 1.
     * Can also be empty for the last chunk if you set stream_options: {"include_usage": true}
     */
    choices: z.array(ChunkChoice_schema),

    model: z.string(), // The model used for the chat completion.
    usage: Usage_schema.optional(), // If requested
    created: z.number() // The Unix timestamp (in seconds) of when the chat completion was created.
      .optional(), // [FastAPI, 2025-04-24] the FastAPI dialect sadly misses the 'created' field
    system_fingerprint: z.string().optional() // The backend configuration that the model runs with.
      .nullable(), // [Grow, undocumented OpenAI] fingerprint is null on some OpenAI examples too
    // service_tier: z.unknown().optional(),

    // [OpenAI] undocumented streaming messages
    error: _UndocumentedError_schema.optional(),
    warning: _UndocumentedWarning_schema.optional(),

    // [Groq] undocumented statistics message
    x_groq: z.object({
      id: z.string().optional(),
      usage: z.object({
        queue_time: z.number().optional(),
        prompt_tokens: z.number().optional(),
        prompt_time: z.number().optional(),
        completion_tokens: z.number().optional(),
        completion_time: z.number().optional(),
        total_tokens: z.number().optional(),
        total_time: z.number().optional(),
      }).optional(),
      queue_length: z.number().optional(),
    }).optional(),

    // [Perplexity] String array of citations, the first element is the first reference, i.e. '[1]'.
    // DEPRECATED: The citations field is being deprecated in favor of the new search_results field
    citations: z.array(z.any()).optional(),
    // [Perplexity, 2025-06-23] Search results
    search_results: z.array(z.object({
      title: z.string().optional().nullable(), // Title of the search result
      url: z.string().optional().nullable(), // URL of the search result
      date: z.string().optional().nullable(), // Date of the search result, e.g. '2024-01-01'
    })).optional(),
  });

}


//
// Images > Create Image
// https://platform.openai.com/docs/api-reference/images/create
//
export namespace OpenAIWire_API_Images_Generations {

  export type Request = z.infer<typeof Request_schema>;
  const Request_schema = z.object({

    // 32,000 for gpt-image-1, 4,000 for dall-e-3, 1,000 for dall-e-2
    prompt: z.string().max(32000),

    model: z.enum([
      'gpt-image-1',
      'dall-e-3',
      'dall-e-2', // default
    ]).optional(),

    // The number of images to generate. Must be between 1 and 10. For dall-e-3, only n=1 is supported.
    n: z.number().min(1).max(10).nullable().optional(),

    // Image quality
    quality: z.enum([
      'auto',                   // default
      'high', 'medium', 'low',  // gpt-image-1
      'hd', 'standard',         // dall-e-3: hd | standard, dall-e-2: only standard
    ]).optional(),

    // The format in which generated images with dall-e-2 and dall-e-3 are returned.
    //`gpt-image-1` will always return base64-encoded images and does NOT support this parameter.
    response_format: z.enum(['url', 'b64_json']).optional(),

    // size of the generated images
    size: z.enum([
      'auto',       // GI (or default if omitted)
      '256x256',    //          D2
      '512x512',    //          D2
      '1024x1024',  // GI  D3  D2
      // landscape
      '1536x1024',  // GI
      '1792x1024',  //      D3
      // portrait
      '1024x1536',  // GI
      '1024x1792',  //      D3
    ]).optional(),

    // optional unique identifier representing your end-user
    user: z.string().optional(),


    // -- GPT Image 1 Specific Parameters --

    // Allows to set transparency (in that case, format = png or webp)
    background: z.enum(['transparent', 'opaque', 'auto' /* default */]).optional(),

    // Control the content-moderation level for images generated by gpt-image-1.
    moderation: z.enum(['low', 'auto' /* default */]).optional(),

    // The format in which the generated images are returned
    output_format: z.enum(['png' /* default */, 'jpeg', 'webp']).optional(),

    // WEBP/JPEG compression level for gpt-image-1
    output_compression: z.number().min(0).max(100).int().optional(),


    // -- Dall-E 3 Specific Parameters --

    // DALL-E 3 ONLY - style - defaults to vivid
    style: z.enum(['vivid', 'natural']).optional(),

  });

  export type Response = z.infer<typeof Response_schema>;
  export const Response_schema = z.object({
    created: z.number(),
    data: z.array(z.object({
      b64_json: z.string().optional(),
      revised_prompt: z.string().optional(),
      url: z.url().optional(), // if the response_format is 'url' - DEPRECATED
    })),

    // gpt-image-1 only
    usage: z.object({
      total_tokens: z.number(),
      input_tokens: z.number(), // images + text tokens in the input prompt
      output_tokens: z.number(), // image tokens in the output image
      input_tokens_details: z.object({
        text_tokens: z.number(),
        image_tokens: z.number().optional(), // present if editing
      }).optional(),
    }).optional(),
  });

}

// Images > Edit Image
export namespace OpenAIWire_API_Images_Edits {

  export type Request = z.infer<typeof Request_schema>;

  /**
   * This API method only accepts 'multipart/form-data' requests.
   * The request body must be a FormData object, which we build outside.
   * The spec below represents the first part.
   */
  export const Request_schema = z.object({

    // 32,000 for gpt-image-1, 1,000 for dall-e-2
    prompt: z.string().max(32000),

    // image: file | file[] - REQUIRED - Handled as file uploads in FormData ('image' field)

    // mask: file - OPTIONAL - Handled as file upload in FormData ('mask' field)

    model: z.enum(['gpt-image-1', 'dall-e-2']).optional(),

    // Number of images to generate, between 1 and 10
    n: z.number().min(1).max(10).nullable().optional(),

    // Image quality
    quality: z.enum([
      'auto',                   // default
      'high', 'medium', 'low',  // gpt-image-1
      'standard',               // dall-e-2: only standard
    ]).optional(),

    // response_format: string - OPTIONAL - Defaults to 'url'. Only for DALL-E 2. gpt-image-1 always returns b64_json.
    // OMITTED here as we'll enforce b64_json or handle it based on model if DALL-E 2 edit were supported.

    // size of the generated images
    size: z.enum([
      'auto',       // GI (or default if omitted)
      '256x256',    //          D2
      '512x512',    //          D2
      '1024x1024',  // GI       D2
      // landscape
      '1536x1024',  // GI
      // portrait
      '1024x1536',  // GI
    ]).optional(),

    // optional unique identifier representing your end-user
    user: z.string().optional(),

  });

  // The response schema is identical to OpenAIWire_API_Images_Generations.Response_schema
  export type Response = OpenAIWire_API_Images_Generations.Response;

}


//
// Models > List Models
//
export namespace OpenAIWire_API_Models_List {

  export type Model = z.infer<typeof Model_schema>;
  const Model_schema = z.object({
    id: z.string(),
    object: z.literal('model'),
    created: z.number().optional(),
    // [dialect:OpenAI] 'openai' | 'openai-dev' | 'openai-internal' | 'system'
    owned_by: z.string().optional(),

    // **Extensions**
    // [Openrouter] non-standard - commented because dynamically added by the Openrouter vendor code
    // context_length: z.number().optional(),
  });

  export type Response = z.infer<typeof Response_schema>;
  const Response_schema = z.object({
    object: z.literal('list'),
    data: z.array(Model_schema),
  });

}


//
// Moderations > Create Moderation
//
export namespace OpenAIWire_API_Moderations_Create {

  export type Request = z.infer<typeof Request_schema>;
  const Request_schema = z.object({
    // input: z.union([z.string(), z.array(z.string())]),
    input: z.string(),
    model: z.enum(['text-moderation-stable', 'text-moderation-latest']).optional(),
  });

  const Category_schema = z.enum([
    'sexual',
    'hate',
    'harassment',
    'self-harm',
    'sexual/minors',
    'hate/threatening',
    'violence/graphic',
    'self-harm/intent',
    'self-harm/instructions',
    'harassment/threatening',
    'violence',
  ]);

  const Result_schema = z.object({
    flagged: z.boolean(),
    categories: z.record(Category_schema, z.boolean()),
    category_scores: z.record(Category_schema, z.number()),
  });

  export type Response = z.infer<typeof Response_schema>;
  const Response_schema = z.object({
    id: z.string(),
    model: z.string(),
    results: z.array(Result_schema),
  });

}


// Chat > Responses API

export namespace OpenAIWire_Responses_Items {

  // Parts - Input

  const Input_TextPart_schema = z.object({
    type: z.literal('input_text'),
    text: z.string(),
  });

  const Input_ImagePart_schema = z.object({
    type: z.literal('input_image'),
    detail: z.enum(['auto', 'low', 'high']).optional(), // defaults to 'auto'
    image_url: z.string().optional(), // URL or base64 encoded image in a data URL.
    file_id: z.string().optional(),
  });

  const Input_FilePart_schema = z.object({
    type: z.literal('input_file'),
    file_data: z.string().optional(), // content of the file
    file_id: z.string().optional(), // ID of the file
    filename: z.string().optional(), // name of the file
  });


  // Parts - Output

  export const ContentItem_TextPart_schema = z.object({
    type: z.literal('output_text'),
    text: z.string(),
    // NOTE: this could also be file_citation, container_file_citation, file_path
    annotations: z.array(z.object({
      type: z.literal('url_citation'),
      url: z.string(),
      title: z.string(),
      start_index: z.number().optional(),
      end_index: z.number().optional(),
    })).optional(),
    // Log Probabilities are ignored on purpose
  });

  export const ContentItem_RefusalPart_schema = z.object({
    type: z.literal('refusal'),
    refusal: z.string(), // explanation
  });

  export const _ContentItem_Parts_schema = z.union([
    ContentItem_TextPart_schema,
    ContentItem_RefusalPart_schema,
  ]);

  export const ReasoningItem_SummaryTextPart_schema = z.object({
    type: z.literal('summary_text'),
    text: z.string(), // summary text
  });


  // Output Items: Content ('message': ['output_text', 'refusal']), Reasoning ('reasoning': [ReasoningItemSummaryTextPart_schema]), Function Call ('function_call': [OutputFunctionCallItem_schema]), and more

  const _OutputItemBase_schema = z.object({
    status: z.enum(['in_progress', 'completed', 'incomplete']).optional(), // status of the output item
  });

  const OutputContentItem_schema = _OutputItemBase_schema.extend({
    type: z.literal('message'),
    id: z.string(), // unique ID of the output item
    role: z.literal('assistant'),
    content: z.array(_ContentItem_Parts_schema),
  });

  const OutputReasoningItem = _OutputItemBase_schema.extend({
    type: z.literal('reasoning'),
    /**
     * ID seems missing from the reasoning output (at least in response.reasoning_summary_part.added),
     * but the docs say it's required as input?
     */
    // id: z.string(),
    summary: z.array(ReasoningItem_SummaryTextPart_schema), // summary of the reasoning
    encrypted_content: z.string().nullish(), // populated when a response is generated with reasoning.encrypted_content in the include
  });

  export type OutputFunctionCallItem = z.infer<typeof OutputFunctionCallItem_schema>;
  const OutputFunctionCallItem_schema = _OutputItemBase_schema.extend({
    type: z.literal('function_call'),
    id: z.string().optional(), // unique ID of the output item - optional when looped back to input
    arguments: z.string(), // FC args STRING (Responses) - JSON string of the arguments to pass to the function
    call_id: z.string(), //  unique ID of the function tool call -- same as ID? verify
    name: z.string(), // name of the function to call
  });

  const OutputWebSearchCallItem_schema = _OutputItemBase_schema.extend({
    type: z.literal('web_search_call'),
    id: z.string(), // unique ID of the output item
    action: z.any().optional(), // TODO: expand this later
  });

  // const ImageGenerationCallOutput_schema = z.object({
  //   type: z.literal('image_generation_call'),
  //   id: z.string(), // unique ID of the image generation call (output item ID)
  //   result: z.string().nullish(), // base64 image data
  //   status: _OutputItemStatus_schema.optional(),
  // });

  /**
   * Output Items:
   *
   * - Content Item
   *   - output_text part
   *   - refusal part
   *
   * - Reasoning Item
   *   - summary_text part
   *
   * - Function Call Item (no parts, details are inside)
   *
   */
  export const OutputItem_schema = z.union([
    OutputContentItem_schema,
    OutputReasoningItem,
    OutputFunctionCallItem_schema,
    OutputWebSearchCallItem_schema,
    // ImageGenerationCallOutput_schema,
    // FileSearchCallOutput_schema,
    // WebSearchCallOutput_schema,
    // ComputerUseCallOutput_schema,
    // CodeInterpreterCallOutput_schema,
    // LocalShellCallOutput_schema,
    // MCPToolCallOutput_schema,
    // MCPListToolsOutput_schema,
    // MCPApprovalRequestOutput_schema,
  ]);


  // Request 'Input' Item

  const _InputItem_schema = z.object({
    status: z.enum(['incomplete', 'in_progress', 'completed']).optional(),
  });

  export type UserItemMessage = z.infer<typeof UserItemMessage_schema>;
  const UserItemMessage_schema = _InputItem_schema.extend({
    type: z.literal('message'),
    role: z.enum(['user', 'system', 'developer']),
    content: z.array(z.union([
      Input_TextPart_schema,
      Input_ImagePart_schema,
      Input_FilePart_schema,
    ])),
  });

  export type FunctionToolCallOutput = z.infer<typeof FunctionToolCallOutput_schema>;
  const FunctionToolCallOutput_schema = _InputItem_schema.extend({
    type: z.literal('function_call_output'),
    id: z.string().optional(), // The unique ID of the function tool call output. Populated when this item is returned via API.
    output: z.string(), // FC-R response STRING (Responses) - a JSON string of the output of the function call
    call_id: z.string(), // unique ID of the function tool call generated by the model.
  });

  // Ignoring for now:
  // - type: 'file_search_call'
  // - type: 'computer_call'
  // - type: 'web_search_call'
  // - type: 'image_generation_call'
  // - type: 'code_interpreter_call'
  // - type: 'local_shell_call'
  // - type: 'local_shell_call_output'
  // - type: 'mcp_list_tools'
  // - type: 'mcp_approval_request'
  // - type: 'mcp_approval_response'
  // - type: 'mcp_call'


  /*
   * Old-style Item Message, used for compatibility with older APIs.
   *
   * NOTE: Over time we will move to the 'Item' type below, but it requires tracking lots
   * of 3rd party IDs (to messages, reasoning items, calls, etc.), which will be a vendor
   * lock-in potentially.
   *
   * In the meantime this is a way out of that.
   */
  export type InputMessage_Compat = z.infer<typeof InputMessage_Compat_schema>;

  const _InputMessage_Compat_User_schema = z.object({
    type: z.literal('message'),
    role: z.enum(['user', 'system', 'developer']),
    // user/system/developer inputs: 'input_text', 'input_image', 'input_file'
    content: z.array(z.union([
      Input_TextPart_schema,
      Input_ImagePart_schema,
      Input_FilePart_schema,
    ])),
  });
  const _InputMessage_Compat_Model_schema = z.object({
    type: z.literal('message'),
    role: z.literal('assistant'),
    // assistant inputs: 'output_text', 'refusal'
    content: z.array(_ContentItem_Parts_schema),
  });

  const InputMessage_Compat_schema = z.union([
    _InputMessage_Compat_User_schema,
    _InputMessage_Compat_Model_schema,
  ]);

  // Input Item (combined)

  export type InputItem = z.infer<typeof InputItem_schema>;
  export const InputItem_schema = z.union([
    // Old-style Item Message
    InputMessage_Compat_schema,
    // Item:
    UserItemMessage_schema,
    FunctionToolCallOutput_schema,
    OutputItem_schema,
    // Item Reference (not used yet):
    z.object({
      type: z.literal('item_reference'),
      id: z.string(), // ID of the item to reference
    }),
  ]);
}

export namespace OpenAIWire_Responses_Tools {

  // Custom tool definitions

  const CustomFunctionTool_schema = z.object({
    type: z.literal('function'),
    name: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
    description: z.string(), // Used by the model to determine whether or not to call the function.
    parameters: z.object({
      type: z.literal('object'),
      properties: z.json().optional(), // FC-DEF params schema (Responses)
      required: z.array(z.string()).optional(),
    }).optional(),
    strict: z.boolean().optional(), // enforce strict parameter validation
  });

  // Hosted tools definitions

  const WebSearchTool_schema = z.object({
    type: z.enum(['web_search_preview', 'web_search_preview_2025_03_11']),
    search_context_size: z.enum(['low', 'medium', 'high']).optional(),
    user_location: z.object({
      type: z.literal('approximate'),
      city: z.string().optional(),
      country: z.string().optional(),
      region: z.string().optional(),
      timezone: z.string().optional(),
    }).optional(),
  });

  // Combined tools

  export type Tool = z.infer<typeof Tool_schema>;
  export const Tool_schema = z.union([
    // custom function tools
    CustomFunctionTool_schema,
    // hosted tools
    WebSearchTool_schema,
    // CodeInterpreterTool_schema,
    // ComputerUseTool_schema,
    // FileSearchTool_schema,
    // ImageGenerationTool_schema,
    // LocalShellTool_schema,
    // MCPTool_schema,
  ]);

  export const ToolChoice_schema = z.union([
    z.literal('none'), // do not call any tool
    z.literal('auto'), // pick between generating a message or calling 1+ tools
    z.literal('required'), // must call 1+ tools
    z.object({ // function tool
      type: z.literal('function'),
      name: z.string(),
    }),
    z.object({ // hosted tool
      type: z.enum([
        // 'file_search',
        'web_search_preview',
        // 'computer_use_preview',
        // 'code_interpreter',
        // 'mcp',
        // 'image_generation',
        // 'local_shell' ?
      ]),
    }),
  ]);

}

export namespace OpenAIWire_API_Responses {

  /// Request

  export type Request = z.infer<typeof Request_schema>;
  export const Request_schema = z.object({

    // Model configuration
    model: z.string(),
    max_output_tokens: z.number().int().positive().nullish(),
    temperature: z.number().min(0).nullish(), // [OpenAI] Defaults to 1, max: 2
    top_p: z.number().min(0).nullish(), // [OpenAI] Defaults to 1, max: 1

    // Input
    instructions: z.string().nullish(),
    input: z.array(OpenAIWire_Responses_Items.InputItem_schema),

    // Tools
    tools: z.array(OpenAIWire_Responses_Tools.Tool_schema).optional(),
    tool_choice: OpenAIWire_Responses_Tools.ToolChoice_schema.optional(),
    parallel_tool_calls: z.boolean().nullish(),

    // configure reasoning
    reasoning: z.object({
      effort: z.enum(['low', 'medium', 'high']).nullish(), // defaults to 'medium'
      summary: z.enum(['auto', 'concise', 'detailed']).nullish(),
    }).nullish(),

    // configure text output
    text: z.object({
      format: z.union([
        z.object({ type: z.literal('text') }),
        z.object({
          type: z.literal('json_schema'),
          name: z.string(), // The name of the response format. Must be a-z, A-Z, 0-9, or contain underscores and dashes, with a maximum length of 64.
          description: z.string().optional(), // A description of what the response format is for, used by the model to determine how to respond in the format.
          schema: z.json(), // JSON Mode: schema (Responses)
          strict: z.boolean().nullish(), // only a subset of JSON Schema is supported when strict is true
        }),
        // z.object({ type: z.literal('json_object') }), // deprecated
      ]).optional(),
    }).optional(),

    // State management (we won't use this for stateless)
    store: z.boolean().nullish(), // defaults to true(!)
    previous_response_id: z.string().nullish(),

    // API options
    stream: z.boolean().nullish(),
    background: z.boolean().nullish(),
    truncation: z.enum(['auto', 'disabled']).nullish(), // defaults to 'disabled', 'auto' drops input items in the middle of the conversation.
    user: z.string().optional(), // stable identifier for your end-users

    // Unused
    // include: z.array(z.string()).nullish(), // additional output to include in the response: 'file_search_call.results', 'message.input_image.image_url', 'computer_call_output.output.image_url', 'reasoning.encrypted_content', 'code_interpreter_call.outputs'
    // metadata: z.record(z.string(), z.any()).optional(), // set of 16 key-value pairs that can be attached to an object
    // service_tier: z.enum(['auto', 'default', 'flex', 'priority']).nullish(),
    // prompt: z.object({
    //   id: z.string(),
    //   version: z.string().optional(),
    //   variables: z.record(z.string(), z.any()).optional(),
    // }).optional(),
  });


  /// Response


  export type Response = z.infer<typeof Response_schema>;
  export const Response_schema = z.object({
    object: z.literal('response'),

    id: z.string(), // unique ID for this response
    created_at: z.number(), // unix timestamp (in seconds)
    status: z.enum(['completed', 'failed', 'in_progress', 'cancelled', 'queued', 'incomplete']),
    incomplete_details: z.object({ reason: z.string() }).nullish(), // why the response is incomplete
    error: z.object({ code: z.string(), message: z.string() }).nullish(), // (null)

    model: z.string(), // model used for the response

    output: z.array(OpenAIWire_Responses_Items.OutputItem_schema),

    usage: z.object({
      input_tokens: z.number(),
      input_tokens_details: z.object({
        cached_tokens: z.number().optional(),
      }).optional(),
      output_tokens: z.number(),
      output_tokens_details: z.object({
        reasoning_tokens: z.number().optional(),
      }).optional(),
      total_tokens: z.number(),
    }).nullish(),

    // NOTE: the following fields seem an exact echo of what's in the request - let's ignore these for now
    // background: ... (false)
    // instructions: ...
    // max_output_tokens: ...
    // metadata: ...
    // parallel_tool_calls: ...
    // previous_response_id: ... (null)
    // prompt: ...
    // reasoning: ...
    // service_tier: ...
    // temperature: ...
    // text: ...
    // tool_choice: ...
    // tools: ...
    // top_p: ...
    // truncation: ...
    // user: ...

  });


  // Response - Streaming Events

  const _BaseEvent_schema = z.object({
    sequence_number: z.number(),
  });

  // Streaming > Response lifecycle

  const ResponseCreatedEvent_schema = _BaseEvent_schema.extend({
    type: z.literal('response.created'),
    response: Response_schema,
  });

  const ResponseInProgress_schema = _BaseEvent_schema.extend({
    type: z.literal('response.in_progress'),
    response: Response_schema,
  });

  const ResponseCompletedEvent_schema = _BaseEvent_schema.extend({
    type: z.literal('response.completed'),
    response: Response_schema,
  });

  // finishes as failed
  const ResponseFailedEvent_schema = _BaseEvent_schema.extend({
    type: z.literal('response.failed'),
    response: Response_schema,
  });

  // finishes as incomplete
  const ResponseIncompleteEvent_schema = _BaseEvent_schema.extend({
    type: z.literal('response.incomplete'),
    response: Response_schema,
  });

  // Streaming > Output item

  const _OutputItemEvent_schema = _BaseEvent_schema.extend({
    output_index: z.number(), // identifies the output item in the response
  });

  const OutputItemAddedEvent_schema = _OutputItemEvent_schema.extend({
    type: z.literal('response.output_item.added'),
    item: OpenAIWire_Responses_Items.OutputItem_schema,
  });

  const OutputItemDoneEvent_schema = _OutputItemEvent_schema.extend({
    type: z.literal('response.output_item.done'),
    item: OpenAIWire_Responses_Items.OutputItem_schema,
  });

  const _OutputIndexedEvent_schema = _OutputItemEvent_schema.extend({
    item_id: z.string(), // items[output_index].id
  });

  // Streaming > Output Item > Content Part

  const _PartIndexedEvent_schema = _OutputIndexedEvent_schema.extend({
    content_index: z.number(), // identifies the content part in the output item
  });

  const ContentPartAddedEvent_schema = _PartIndexedEvent_schema.extend({
    type: z.literal('response.content_part.added'),
    part: OpenAIWire_Responses_Items._ContentItem_Parts_schema,
  });

  const ContentPartDoneEvent_schema = _PartIndexedEvent_schema.extend({
    type: z.literal('response.content_part.done'),
    part: OpenAIWire_Responses_Items._ContentItem_Parts_schema,
  });

  const OutputTextDeltaEvent_schema = _PartIndexedEvent_schema.extend({
    type: z.literal('response.output_text.delta'),
    delta: z.string(),
  });

  const OutputTextDoneEvent_schema = _PartIndexedEvent_schema.extend({
    type: z.literal('response.output_text.done'),
    text: z.string(),
  });

  const OutputRefusalDeltaEvent_schema = _PartIndexedEvent_schema.extend({
    type: z.literal('response.output_refusal.delta'),
    delta: z.string(),
  });

  const OutputRefusalDoneEvent_schema = _PartIndexedEvent_schema.extend({
    type: z.literal('response.output_refusal.done'),
    refusal: z.string(),
  });

  const OutputTextAnnotationAddedEvent_schema = _PartIndexedEvent_schema.extend({
    type: z.enum([
      'response.output_text_annotation.added', // from the spec
      'response.output_text.annotation.added', // from unsing web_search_call
    ]),
    annotation_index: z.number(),
    annotation: z.any(), // TODO will spec later
  });

  const OutputResponseReasoningDeltaEvent_schema = _PartIndexedEvent_schema.extend({
    type: z.literal('response.reasoning.delta'),
    delta: z.any(), // will spec later - seems { text: string } from the spec? smells
  });

  const OutputResponseReasoningDoneEvent_schema = _PartIndexedEvent_schema.extend({
    type: z.literal('response.reasoning.done'),
    text: z.string(), // finalized reasoning text
  });

  // Streaming > Output Item > Reasoning Summary

  const _SummaryIndexedEvent_schema = _OutputIndexedEvent_schema.extend({
    summary_index: z.number(), // identifies the reasoning summary in the output item
  });

  const OutputReasoningSummaryDeltaEvent_schema = _SummaryIndexedEvent_schema.extend({
    type: z.literal('response.reasoning_summary.delta'),
    delta: z.any(), // object // will spec later
  });

  const OutputReasoningSummaryDoneEvent_schema = _SummaryIndexedEvent_schema.extend({
    type: z.literal('response.reasoning_summary.done'),
    text: z.string(), // finalized reasoning summary text.
  });

  const OutputReasoningSummaryPartAddedEvent_schema = _SummaryIndexedEvent_schema.extend({
    type: z.literal('response.reasoning_summary_part.added'),
    part: OpenAIWire_Responses_Items.ReasoningItem_SummaryTextPart_schema,
  });

  const OutputReasoningSummaryPartDoneEvent_schema = _SummaryIndexedEvent_schema.extend({
    type: z.literal('response.reasoning_summary_part.done'),
    part: OpenAIWire_Responses_Items.ReasoningItem_SummaryTextPart_schema,
  });

  const OutputReasoningSummaryTextDeltaEvent_schema = _SummaryIndexedEvent_schema.extend({
    type: z.literal('response.reasoning_summary_text.delta'),
    delta: z.string(),
  });

  const OutputReasoningSummaryTextDoneEvent_schema = _SummaryIndexedEvent_schema.extend({
    type: z.literal('response.reasoning_summary_text.done'),
    text: z.string(), // final summary text
  });

  // Streaming > Output Item: Function Call Arguments

  const FunctionCallArgumentsDeltaEvent_schema = _OutputIndexedEvent_schema.extend({
    type: z.literal('response.function_call_arguments.delta'),
    delta: z.string(),
  });

  const FunctionCallArgumentsDoneEvent_schema = _OutputIndexedEvent_schema.extend({
    type: z.literal('response.function_call_arguments.done'),
    arguments: z.string(), // JSON string of the arguments to pass to the function
  });

  // Streaming > Output Item: Web Search Call

  const OutputWebSearchCallInProgress_schema = _OutputIndexedEvent_schema.extend({
    type: z.literal('response.web_search_call.in_progress'),
  });

  const OutputWebSearchCallSearching_schema = _OutputIndexedEvent_schema.extend({
    type: z.literal('response.web_search_call.searching'),
  });

  const OutputWebSearchCallCompleted_schema = _OutputIndexedEvent_schema.extend({
    type: z.literal('response.web_search_call.completed'),
  });

  // Streaming > Output Item: Ignoring:
  // - file_search_call.*
  // - web_search_call.*
  // - image_generation_call.*
  // - mcp_call.*, mcp_list_tools.*
  // - code_interpreter_call.*, code_interpreter_call_code.*

  // Error event
  const ErrorEvent_schema = _BaseEvent_schema.extend({
    type: z.literal('error'),

    // error as per the docs
    code: z.number().or(z.string()).nullish(),
    message: z.string().nullish(),
    param: z.string().nullish(),

    // error received sometimes:
    error: z.object({
      type: z.union([z.enum(['invalid_request_error']), z.string()]).nullish(),
      message: z.string().nullish(),
      code: z.number().or(z.string()).nullish(),
      param: z.string().nullish(),
    }).nullish(),
  });

  // Combined streaming event
  export type StreamingEvent = z.infer<typeof StreamingEvent_schema>;
  export const StreamingEvent_schema = z.discriminatedUnion('type', [
    ResponseCreatedEvent_schema,
    ResponseInProgress_schema,
    ResponseCompletedEvent_schema,
    ResponseFailedEvent_schema,
    ResponseIncompleteEvent_schema,
    OutputItemAddedEvent_schema,
    OutputItemDoneEvent_schema,
    ContentPartAddedEvent_schema,
    ContentPartDoneEvent_schema,
    OutputTextDeltaEvent_schema,
    OutputTextDoneEvent_schema,
    OutputRefusalDeltaEvent_schema,
    OutputRefusalDoneEvent_schema,
    OutputTextAnnotationAddedEvent_schema,
    OutputResponseReasoningDeltaEvent_schema,
    OutputResponseReasoningDoneEvent_schema,
    OutputReasoningSummaryDeltaEvent_schema,
    OutputReasoningSummaryDoneEvent_schema,
    OutputReasoningSummaryPartAddedEvent_schema,
    OutputReasoningSummaryPartDoneEvent_schema,
    OutputReasoningSummaryTextDeltaEvent_schema,
    OutputReasoningSummaryTextDoneEvent_schema,
    FunctionCallArgumentsDeltaEvent_schema,
    FunctionCallArgumentsDoneEvent_schema,
    OutputWebSearchCallInProgress_schema,
    OutputWebSearchCallSearching_schema,
    OutputWebSearchCallCompleted_schema,
    ErrorEvent_schema,
  ]);

}
