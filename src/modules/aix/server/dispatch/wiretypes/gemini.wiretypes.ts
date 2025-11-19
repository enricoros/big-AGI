import * as z from 'zod/v4';


export namespace GeminiWire_ContentParts {

  // The IANA standard MIME type of the source data. Examples: - image/png - image/jpeg
  // For a complete list of supported types, see Supported file formats:
  // https://ai.google.dev/gemini-api/docs/prompting_with_media?lang=node#supported_file_formats
  const ianaStandardMimeType_schema = z.enum([
    // Image formats
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/heic',
    'image/heif',
    // Audio formats
    'audio/wav',
    'audio/mp3',
    'audio/aiff',
    'audio/aac',
    'audio/ogg',
    'audio/flac',
    // Video formats
    'video/mp4',
    'video/mpeg',
    'video/mov',
    'video/avi',
    'video/x-flv',
    'video/mpg',
    'video/webm',
    'video/wmv',
    'video/3gpp',
    // Plain text formats
    'text/plain',
    'text/html',
    'text/css',
    'text/javascript',
    'application/x-javascript',
    'text/x-typescript',
    'application/x-typescript',
    'text/csv',
    'text/markdown',
    'text/x-python',
    'application/x-python-code',
    'application/json',
    'text/xml',
    'application/rtf',
    'text/rtf',
  ]);

  export const ContentPartModality_enum = z.enum([
    'MODALITY_UNSPECIFIED',
    'TEXT', // plain text
    'IMAGE',
    'VIDEO',
    'AUDIO',
    'DOCUMENT', // e.g. PDF
  ]);

  /** Media resolution for the input media. */
  export const mediaResolution_enum = z.enum([
    'MEDIA_RESOLUTION_UNSPECIFIED', // Media resolution has not been set
    'MEDIA_RESOLUTION_LOW',         // Images: 280 tokens | Video: 70 tokens per frame
    'MEDIA_RESOLUTION_MEDIUM',      // Images: 560 tokens | Video: 70 tokens per frame (same as low)
    'MEDIA_RESOLUTION_HIGH',        // Images: 1120 tokens | Video: 280 tokens per frame
  ]);


  /// Content parts - Input

  const _ContentPart_fields_schema = z.object({
    thought: z.boolean().optional(), // (Text) [Gemini, 2025-01-23] CoT support
    /**
     * [Gemini 3, 2025-11-18] Encrypted signature preserving reasoning context across multi-turn function calling, base64-encoded.
     * - Required for Gemini 3 Pro function calling (strict validation)
     * - Sequential calls: Each function call includes its signature
     * - Parallel calls: Only first function call has signature
     * - Bypass: Use "context_engineering_is_the_way_to_go" for migrated conversations
     */
    thoughtSignature: z.string().optional(),
    // partMetadata: z.looseObject({}).optional(),
    mediaResolution: mediaResolution_enum.optional(), // [Gemini, 2025-11-18] Media resolution for the input media
  });


  export const TextPart_schema = z.object({
    text: z.string(),
  });

  const InlineDataPart_schema = z.object({
    inlineData: z.object({
      mimeType: z.union([z.string(), ianaStandardMimeType_schema]),
      data: z.string(), // base64-encoded string
    }),
  });

  export const FunctionCallPart_schema = z.object({
    functionCall: z.object({
      id: z.string().optional(), // if populated, the client to execute the functionCall and return the response with the matching id
      name: z.string(),
      /** The function parameters and values in JSON object format. */
      args: z.json().optional(), // FC args
    }),
  });

  /**
   * The result output from a FunctionCall that contains a string representing the FunctionDeclaration.name
   * and a structured JSON object containing any output from the function is used as context to the model.
   * This should contain the result of a FunctionCall made based on model prediction.
   *
   * NOTE from the online Google docs on 2024-07-20:
   * - The next conversation turn may contain a [FunctionResponse][content.part.function_response] with
   *   the [content.role] "function" generation context for the next model turn.
   *   This is extremely weird, because role should only be 'user' or 'model'. FIXME GOOGLE!
   */
  const FunctionResponsePart_schema = z.object({
    functionResponse: z.object({
      /** The id of the function call this response is for */
      id: z.string().optional(), // populated by the client to match the corresponding function call id.
      /** Corresponds to the related FunctionDeclaration.name */
      name: z.string(),
      /** The function response in JSON object format */
      response: z.json().optional(), // FC-R response

      // -- the following fields are only applicable to NON_BLOCKING function calls

      /** Signals that function call continues, and more responses will be returned, turning the function call into a generator. */
      willContinue: z.boolean().optional(),
      /** Specifies how the response should be scheduled in the conversation */
      scheduling: z.enum([
        'SCHEDULING_UNSPECIFIED', // unused
        'SILENT', // only add the result to the conversation context, do not interrupt or trigger generation
        'WHEN_IDLE', // add the result to the conversation context, and prompt to generate output without interrupting ongoing generation
        'INTERRUPT', // add the result to the conversation context, interrupt ongoing generation and prompt to generate output.
      ]).optional(),
    }),
  });

  const FileDataPart_schema = z.object({
    fileData: z.object({
      mimeType: z.union([z.string(), ianaStandardMimeType_schema]).optional(),
      fileUri: z.string(),
    }),
  });

  export const ExecutableCodePart_schema = z.object({
    executableCode: z.object({
      language: z.enum([
        // /**
        //  * Unspecified language. This value should not be used.
        //  */
        // 'LANGUAGE_UNSPECIFIED',
        /** Python >= 3.10, with numpy and simpy available. */
        'PYTHON',
      ]),
      /** The code to be executed. */
      code: z.string(),
    }),
  });

  export const CodeExecutionResultPart_schema = z.object({
    codeExecutionResult: z.object({
      outcome: z.enum([
        // /**
        //  * Unspecified status. This value should not be used.
        //  */
        // 'OUTCOME_UNSPECIFIED',
        /**
         * Code execution completed successfully.
         */
        'OUTCOME_OK',
        /**
         * Code execution finished but with a failure. stderr should contain the reason.
         */
        'OUTCOME_FAILED',
        /**
         * Code execution ran for too long, and was cancelled. There may or may not be a partial output present.
         */
        'OUTCOME_DEADLINE_EXCEEDED',
      ]),
      /**
       * Contains stdout when code execution is successful, stderr or other description otherwise.
       */
      output: z.string().optional(),
    }),
  });


  /// Content Parts (union of) - (input) request.contents[number].parts

  const _ContentPartData_Input_schema = z.union([
    TextPart_schema,
    InlineDataPart_schema,
    FunctionCallPart_schema,
    FunctionResponsePart_schema, // Input only
    FileDataPart_schema, // Input only
    ExecutableCodePart_schema,
    CodeExecutionResultPart_schema,
  ]);

  export type ContentPart = z.infer<typeof ContentPart_Input_schema>;
  export const ContentPart_Input_schema = z.intersection(
    _ContentPart_fields_schema,
    _ContentPartData_Input_schema,
  );


  /// Content Parts (union of) - (model output) response.candidates[number].content.parts

  const _ContentPartData_Output_schema = z.union([
    TextPart_schema,
    InlineDataPart_schema,
    FunctionCallPart_schema,
    // FunctionResponsePart_schema,
    // FileDataPart_schema,
    ExecutableCodePart_schema,
    CodeExecutionResultPart_schema,
  ]);

  export const ContentPart_Output_schema = z.intersection(
    _ContentPart_fields_schema,
    _ContentPartData_Output_schema,
  );


  /// Content Parts - Factories

  export function TextPart(text: string): z.infer<typeof TextPart_schema> {
    return { text };
  }

  export function InlineDataPart(mimeType: string, data: string): z.infer<typeof InlineDataPart_schema> {
    return { inlineData: { mimeType, data } };
  }

  export function FunctionCallPart(name: string, args?: Record<string, any>): z.infer<typeof FunctionCallPart_schema> {
    return { functionCall: { name, args } };
  }

  export function FunctionResponsePart(name: string, response?: Record<string, any>): z.infer<typeof FunctionResponsePart_schema> {
    return { functionResponse: { name, response } };
  }

  export function ExecutableCodePart(language: 'PYTHON', code: string): z.infer<typeof ExecutableCodePart_schema> {
    return { executableCode: { language, code } };
  }

  export function CodeExecutionResultPart(outcome: 'OUTCOME_OK' | 'OUTCOME_FAILED' | 'OUTCOME_DEADLINE_EXCEEDED', output?: string): z.infer<typeof CodeExecutionResultPart_schema> {
    return { codeExecutionResult: { outcome, output } };
  }

}

export namespace GeminiWire_Messages {

  /// System Instruction

  export const SystemInstruction_schema = z.object({
    // Note: should be 'contents' object, but since it's text-only, we cast it down with a custom definition
    parts: z.array(GeminiWire_ContentParts.TextPart_schema),
  });

  // Content - request.contents[]

  export type Content = z.infer<typeof Content_schema>;
  export const Content_schema = z.object({
    // Must be either 'user' or 'model'. Optional but must be set if there are multiple "Content" objects in the parent array.
    role: z.enum(['user', 'model']).optional(),
    // Ordered Parts that constitute a single message. Parts may have different MIME types.
    parts: z.array(GeminiWire_ContentParts.ContentPart_Input_schema),
  });

  // Model Content - response.candidates[number].content

  export const ModelContent_schema = Content_schema.extend({
    role: z.literal('model')
      .or(z.literal('MODEL')) // [Gemini]: 2024-10-29: code execution seems to return .role='MODEL' instead of 'model' when .parts=[codeExecutionResult]
      .optional(), // 2025-01-10: added because sometimes gemini sends the empty `{"candidates": [{"content": {}, ...` just for the finishreason
    // 'Model' generated contents are of fewer types compared to the ContentParts, which represent also user objects
    parts: z.array(GeminiWire_ContentParts.ContentPart_Output_schema)
      .optional(), // 2025-01-10: added because sometimes gemini sends the empty `{"candidates": [{"content": {}, ...` just for the finishreason
  });

  // export const UserMessage_schema = Content_schema.extend({
  //   role: z.literal('user'),
  // });

}

export namespace GeminiWire_ToolDeclarations {

  /// Tool definitions - Input

  const Tool_CodeExecution_schema = z.object({
    // This type has no fields.
    // Tool that executes code generated by the model, and automatically returns the result to the model.
    // See also ExecutableCode and CodeExecutionResult which are only generated when using this tool.
  });

  export type FunctionDeclaration = z.infer<typeof FunctionDeclaration_schema>;
  export const FunctionDeclaration_schema = z.object({
    name: z.string(),
    description: z.string(),

    /**
     *  Subset of OpenAPI 3.0 schema object
     *  https://ai.google.dev/api/rest/v1beta/cachedContents#schema
     *  Here we relax the check.
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
     * The Schema defines the type used for the 'future' response value of the function.
     * JSON Schema output format (per-function). Reflects the Open API 3.03 Response Object.
     */
    response: z.json().optional(), // FC-DEF output schema

    /** Specifies the function Behavior. Currently only supported by the BidiGenerateContent method. */
    behavior: z.enum([
      'UNSPECIFIED', // unused
      'BLOCKING', // if set, the system will wait to receive the function response before continuing the conversation
      'NON_BLOCKING', // if set, the system will attempt to handle function responses as they become available while maintaining the conversation between the user and the model
    ]).optional(),
  });

  const Tool_GoogleSearch_schema = z.object({
    // Optional time range filter for Google Search results
    timeRangeFilter: z.object({
      /** Start time in ISO 8601 format (e.g., "2024-01-01T00:00:00Z") */
      startTime: z.string(),
      /** End time in ISO 8601 format (e.g., "2024-12-31T23:59:59Z") */
      endTime: z.string(),
    }).optional(),
  });

  // [Gemini, 2025-10-07] Computer Use tool for browser automation
  const Tool_ComputerUse_schema = z.object({
    /** Environment type for Computer Use tool - currently only 'ENVIRONMENT_BROWSER' is supported */
    environment: z.enum(['ENVIRONMENT_BROWSER']),
    /** Optional list of predefined functions to exclude from Computer Use */
    excludedPredefinedFunctions: z.array(z.string()).optional(),
  });

  // [Gemini, 2025-08-18] URL Context tool for fetching and analyzing web page content (GA)
  const Tool_UrlContext_schema = z.object({
    // This type has no fields - URLs are provided directly in the prompt text
    // Supports up to 20 URLs per request, maximum 34MB per URL
  });

  // 2025-03-14: Gemini has de-facto phased out GoogleSearchRetrieval, there's no more
  // const GoogleSearchRetrieval_schema = z.object({
  //   dynamicRetrievalConfig: z.object({
  //     /** The mode of the predictor to be used in dynamic retrieval. */
  //     mode: z.enum(['MODE_UNSPECIFIED', 'MODE_DYNAMIC']),
  //     /** The threshold to be used in dynamic retrieval. If not set, a system default value is used. */
  //     dynamicThreshold: z.number().optional(),
  //   }).optional(),
  // });

  export const Tool_schema = z.object({
    codeExecution: Tool_CodeExecution_schema.optional(),
    computerUse: Tool_ComputerUse_schema.optional(),
    functionDeclarations: z.array(FunctionDeclaration_schema).optional(),
    googleSearch: Tool_GoogleSearch_schema.optional(),
    urlContext: Tool_UrlContext_schema.optional(),
    // 2025-03-14: disabled as it's gone for all models
    // googleSearchRetrieval: GoogleSearchRetrieval_schema.optional(),
  });

  export const ToolConfig_schema = z.object({
    functionCallingConfig: z.object({
      mode: z.enum([
        // /**
        //  * Unspecified function calling mode. This value should not be used.
        //  */
        // 'MODE_UNSPECIFIED',
        /**
         * (default) The model decides to predict either a function call or a natural language response.
         */
        'AUTO',
        /**
         * The model is constrained to always predict a function call.
         * If allowed_function_names is provided, the model picks from the set of allowed functions.
         * Also used to force a specific function by setting allowed_function_names to a single function name.
         */
        'ANY',
        /**
         * The model behavior is the same as if you don't pass any function declarations.
         */
        'NONE',
      ]).optional(),
      allowedFunctionNames: z.array(z.string()).optional(),
    }).optional(),
  });

}

export namespace GeminiWire_Safety {

  /// Safety Rating

  export const HarmCategory_enum = z.enum([
    'HARM_CATEGORY_UNSPECIFIED',
    // PaLM-only classifications:
    'HARM_CATEGORY_DEROGATORY',
    'HARM_CATEGORY_TOXICITY',
    'HARM_CATEGORY_VIOLENCE',
    'HARM_CATEGORY_SEXUAL',
    'HARM_CATEGORY_MEDICAL',
    'HARM_CATEGORY_DANGEROUS',
    // Gemini classifications:
    'HARM_CATEGORY_HARASSMENT',
    'HARM_CATEGORY_HATE_SPEECH',
    'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    'HARM_CATEGORY_DANGEROUS_CONTENT',
    'HARM_CATEGORY_CIVIC_INTEGRITY', // 2025-01-10
  ]);

  export const HarmProbability_enum = z.enum([
    'HARM_PROBABILITY_UNSPECIFIED',
    'NEGLIGIBLE',
    'LOW',
    'MEDIUM',
    'HIGH',
  ]);

  export type SafetyRating = z.infer<typeof SafetyRating_schema>;
  export const SafetyRating_schema = z.object({
    category: GeminiWire_Safety.HarmCategory_enum,
    probability: GeminiWire_Safety.HarmProbability_enum,
    blocked: z.boolean().optional(),
  });

  /// Settings

  export type HarmBlockThreshold = z.infer<typeof HarmBlockThreshold_enum>;
  export const HarmBlockThreshold_enum = z.enum([
    'HARM_BLOCK_THRESHOLD_UNSPECIFIED',
    'BLOCK_LOW_AND_ABOVE',      // allows NEGLIGIBLE
    'BLOCK_MEDIUM_AND_ABOVE',   // allows NEGLIGIBLE, LOW
    'BLOCK_ONLY_HIGH',          // allows NEGLIGIBLE, LOW, MEDIUM
    'BLOCK_NONE',               // allows all
    /**
     * 2025-01-10: see bug #720 and https://discuss.ai.google.dev/t/flash-2-0-doesnt-respect-block-none-on-all-harm-categories/59352/1
     */
    'OFF', // turns off the safety filter.
  ]);

  export const SafetySetting_schema = z.object({
    category: HarmCategory_enum,
    /** Block at and beyond a specified harm probability. */
    threshold: HarmBlockThreshold_enum,
  });

  /// Blocking

  const BlockReason_enum = z.enum([
    'BLOCK_REASON_UNSPECIFIED', // unused
    'SAFETY',                   // inspect safetyRatings to see the category that blocked
    'OTHER',                    // unknown reason
    'BLOCKLIST',                // terms are included in the terminology blocklist
    'PROHIBITED_CONTENT',       // prohibited content
    'IMAGE_SAFETY',             // unsafe image generation content
  ]);

  export const PromptFeedback_schema = z.object({
    /** Optional. If set, the prompt was blocked and no candidates are returned. */
    blockReason: BlockReason_enum.optional(),
    /** At most one rating per category. */
    safetyRatings: z.array(SafetyRating_schema)
      .optional(), // [Gemini, 2025-11-09] Optional because PROHIBITED_CONTENT blocks omit safetyRatings
  });

}


//
// Models > Generate Content
//
export namespace GeminiWire_API_Generate_Content {

  export const postPath = '/v1beta/{model=models/*}:generateContent';
  export const streamingPostPath = '/v1beta/{model=models/*}:streamGenerateContent?alt=sse'; // https://cloud.google.com/apis/docs/system-parameters#definitions

  /// Request

  const responseMimeType_enum = z.enum([
    'text/plain',       // default
    'application/json', // JSON mode (JSON response in the response candidates)
    'text/x.enum',      // ENUM as a string response in the response candidates
  ]);

  const responseModality_enum = z.enum([
    'MODALITY_UNSPECIFIED',
    'TEXT', // model should return text
    'IMAGE', // model should return images
    'AUDIO', // model should return audio
  ]);

  const SpeechConfig_schema = z.object({
    /** The configuration for the speaker to use. */
    voiceConfig: z.object({
      /** The configuration for the prebuilt voice to use. */
      prebuiltVoiceConfig: z.object({
        /** The name of the preset voice to use. */
        voiceName: z.string(),
      }).optional(),
    }).optional(),
  });

  const GenerationConfig_schema = z.object({
    /**
     * The set of character sequences (up to 5) that will stop output generation. If specified, the API will stop at the first appearance of a stop sequence.
     */
    stopSequences: z.array(z.string()).optional(),

    /**
     * - [default] 'text/plain'
     * - [JSON mode] 'application/json' + set .responseSchema => JSON response in the candidates
     * - [Classify mode] 'text/x.enum' + { "type": "STRING", "enum": ["A", "B", "C"] } = ENUM as a string response
     */
    responseMimeType: responseMimeType_enum.optional(),
    /**
     * Output schema of the generated candidate text.
     * Schemas must be a subset of the OpenAPI schema and can be objects, primitives or arrays.
     * if set -> responseMimeType must be 'application/json'
     */
    responseSchema: z.json().optional(), // JSON Mode: schema

    /**
     * Requested modalities of the response. (if empty this is equivalent ot ['TEXT'])
     * Exact match to the modalities of the response.
     * An Error is raised if the array doesn't exactly match a supported combo for the model.
     */
    responseModalities: z.array(responseModality_enum).optional(), // TODO

    /** Optional. Enables enhanced civic answers. Not be available for all models. */
    enableEnhancedCivicAnswers: z.boolean().optional(), // TODO
    /** Optional. The speech generation config. Still in preview (allowlist, 2025-03-14) */
    speechConfig: SpeechConfig_schema.optional(), // TODO
    /** Optional. The media resolution for the response. */
    mediaResolution: GeminiWire_ContentParts.mediaResolution_enum.optional(), // [Gemini, 2025-11-18] This is also on the 'Part' object now.. not sure which has precedence, but we do not use this one

    candidateCount: z.number().int().optional(), // currently can only be set to 1
    maxOutputTokens: z.number().int().optional(),
    temperature: z.number().min(0).max(2).optional(),
    topP: z.number().optional(),
    topK: z.number().int().optional(),

    // [Gemini, 2025-01-23] CoT support - undocumented yet
    thinkingConfig: z.object({
      /**
       * [2025-04-17] Used to work with v1alpha API, now it seems to not work in any model/api version combo.
       */
      includeThoughts: z.boolean().optional(),
      /**
       * [Gemini, 2025-04-17] Introduced in Flash-2.5-Preview to set the thinking budget.
       * - must be an integer in the range 0 to 24576; budgets from 1 to 1024 tokens will be set to 1024
       * - set to 0 to disable thinking
       */
      thinkingBudget: z.number().optional(),
      /**
       * [Gemini 3, 2025-11-18] Replaces thinkingBudget for Gemini 3 models.
       * - 'low': Minimizes latency and cost
       * - 'medium': Balanced (coming soon, not yet supported)
       * - 'high': Maximizes reasoning depth (default when set)
       * - undefined: Dynamic (model decides - which is equivalent to 'high' for now)
       * CRITICAL: Cannot use both thinkingLevel and thinkingBudget (400 error)
       */
      thinkingLevel: z.enum(['low', 'medium', 'high']).optional(),
    }).optional(),

    // Image generation configuration
    imageConfig: z.object({
      /** Controls the aspect ratio of generated images */
      aspectRatio: z.enum(['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9']).optional(),
    }).optional(),

    // Added on 2025-01-10 - Low-level - not requested/used yet but added
    presencePenalty: z.number().optional(),     // A positive penalty increases the vocabulary of the response
    frequencyPenalty: z.number().optional(),    // A positive penalty increases the vocabulary of the response
    responseLogprobs: z.boolean().optional(),   // if true, exports the logprobs
    logprobs: z.number().int().optional(),      // number of top logprobs to return
  });

  export type Request = z.infer<typeof Request_schema>;
  export const Request_schema = z.object({
    // the 'model' parameter is in the path of the `generateContent` POST

    // required
    contents: z.array(GeminiWire_Messages.Content_schema),

    // all optional
    tools: z.array(GeminiWire_ToolDeclarations.Tool_schema).optional(),
    toolConfig: GeminiWire_ToolDeclarations.ToolConfig_schema.optional(),
    safetySettings: z.array(GeminiWire_Safety.SafetySetting_schema).optional(),
    systemInstruction: GeminiWire_Messages.SystemInstruction_schema.optional(),
    generationConfig: GenerationConfig_schema.optional(),
    cachedContent: z.string().optional(),
  });

  // Response

  /** Last synced from https://ai.google.dev/api/generate-content#candidate on 2025-10-13 */
  const FinishReason_enum = z.enum([
    'FINISH_REASON_UNSPECIFIED',  // unused
    'STOP',                       // Natural stop point of the model or provided stop sequence.
    'MAX_TOKENS',                 // The maximum number of tokens as specified in the request was reached.
    'SAFETY',                     // The candidate content was flagged for safety reasons. See safetyRatings.
    'RECITATION',                 // The candidate content was flagged for recitation reasons. See citationMetadata.
    'LANGUAGE',                   // The candidate content was flagged for using an unsupported language.
    'OTHER',                      // Unknown reason
    'BLOCKLIST',                  // Token generation stopped because the content contains forbidden terms.
    'PROHIBITED_CONTENT',         // Token generation stopped for potentially containing prohibited content.
    'SPII',                       // Token generation stopped because the content potentially contains Sensitive Personally Identifiable Information (SPII).
    'MALFORMED_FUNCTION_CALL',    // The function call generated by the model is invalid.
    'IMAGE_SAFETY',               // Token generation stopped because generated images contain safety violations.
    'IMAGE_PROHIBITED_CONTENT',   // Image generation stopped because generated images has other prohibited content.
    'IMAGE_OTHER',                // Image generation stopped because of other miscellaneous issue.
    'NO_IMAGE',                   // The model was expected to generate an image, but none was generated.
    'IMAGE_RECITATION',           // Image generation stopped due to recitation.
    'UNEXPECTED_TOOL_CALL',       // Model generated a tool call but no tools were enabled in the request.
    'TOO_MANY_TOOL_CALLS',        // Model called too many tools consecutively, thus the system exited execution.
  ]);

  /** A citation to a source for a portion of a specific response. **/
  const CitationSource_schema = z.object({
    startIndex: z.number().optional(),  // Start of segment of the response that is attributed to this source.
    endIndex: z.number().optional(),    // End of the attributed segment, exclusive.
    uri: z.string().optional(),         // URI that is attributed as a source for a portion of the text.
    license: z.string().optional(),     // License for the GitHub project that is attributed as a source for segment.
  });

  /** A collection of source attributions for a piece of content. */
  const CitationMetadata_schema = z.object({
    citationSources: z.array(CitationSource_schema),
  });

  // for GenerateAnswer calls - UNWANTED by us
  /*const GroundingAttribution_schema = z.object({
    sourceId: z.object({
      groundingPassage: z.object({
        passageId: z.string(),
        partIndex: z.number().int(),
      }).optional(),
      semanticRetrieverChunk: z.object({
        source: z.string(),
        chunk: z.string(),
      }).optional(),
    }),
    content: GeminiWire_Messages.ModelContent_schema,
  });*/

  const groundingMetadata_Segment_schema = z.object({
    partIndex: z.number().int().optional(),
    startIndex: z.number().int().optional(),
    endIndex: z.number().int(),
    text: z.string(),
  });

  const UrlRetrievalStatus_enum = z.enum([
    'URL_RETRIEVAL_STATUS_UNSPECIFIED',
    'URL_RETRIEVAL_STATUS_SUCCESS',
    'URL_RETRIEVAL_STATUS_ERROR',
    'URL_RETRIEVAL_STATUS_PAYWALL',
    'URL_RETRIEVAL_STATUS_UNSAFE',
  ]);

  const UrlMetadata_schema = z.object({
    /** Retrieved url by the tool. */
    retrievedUrl: z.string(),
    /** Status of the url retrieval. */
    urlRetrievalStatus: UrlRetrievalStatus_enum,
  });

  const UrlContextMetadata_schema = z.object({
    urlMetadata: z.array(UrlMetadata_schema),
  });

  const GroundingMetadata_schema = z.object({
    /** supporting references retrieved from specified grounding source */
    groundingChunks: z.array(/*z.union([*/z.object({
      web: z.object({
        uri: z.string(),
        title: z.string(),
      }),
    })).optional(),

    /** List of grounding support: segment + arrays of chunks + arrays of probabilities  */
    groundingSupports: z.array(z.object({
      groundingChunkIndices: z.array(z.number().int()), // citations associated with the claim, indices into ../groundingChunks[]
      confidenceScores: z.array(z.number()).optional(), // 0..1 - optional: not always returned by Gemini API
      segment: groundingMetadata_Segment_schema,
    })).optional(),

    /** Web search queries for the following-up web search. */
    webSearchQueries: z.array(z.string()).optional(),

    /** Optional. Google search entry for the following-up web searches. */
    searchEntryPoint: z.object({
      renderedContent: z.string().optional(),   // Web content snippet that can be embedded in a web page or an app webview
      sdkBlob: z.string().optional(),           // Base64 encoded JSON representing array of <search term, search url> tuple
    }).optional(),

    /** Metadata related to retrieval in the grounding flow. */
    retrievalMetadata: z.object({
      googleSearchDynamicRetrievalScore: z.number().optional(), // 0..1 indicating how likely information from google search could help answer the prompt
    }).optional(),
  });

  const Candidate_schema = z.object({
    /**
     * Index of the candidate in the list of response candidates.
     * NOTE: see GenerationConfig_schema.candidateCount, which can only be set to 1, so index is supposed to be 0.
     */
    index: z.number()
      .optional(), // for `1.5-002` models, on Sept 24, 2024, this became optional
    /**
     * This seems to be equal to 'STOP' on all streaming chunks.
     * In theory: if empty, the model has not stopped generating the tokens.
     */
    finishReason: z.union([FinishReason_enum, z.string()]).optional(),
    /**
     * Generated content returned from the model.
     */
    content: GeminiWire_Messages.ModelContent_schema.optional(), // this can be missing if the finishReason is not 'MAX_TOKENS'
    /**
     * List of ratings for the safety of this response candidate. At most one rating per category.
     *
     * Empirical observations:
     * - Not present on the first packet? Second and after?
     * - Not present when finishReason is 'RECITATION'
     * - Usually defined for 4 categories: SEXUALLY_EXPLICIT, HATE_SPEECH, HARASSMENT, DANGEROUS_CONTENT (verified 2025-03-14)
     */
    safetyRatings: z.array(GeminiWire_Safety.SafetyRating_schema).optional(),
    /**
     * Automatic - will cite sources seldomly (e.g. when asking for the national anthem)
     * This field may be populated with recitation information for any text included in the content.
     * These are passages that are "recited" from copyrighted material in the foundational LLM's training data.
     *
     * Empirical observations:
     * - 2024-07-15: Unreliable: some of the sources seem to be hallucinated
     * - 2024-07-15: Not present when finishReason is 'RECITATION'; maybe the packet before it?
     */
    citationMetadata: CitationMetadata_schema.optional(),
    /**
     * Token count for this candidate.
     * Empirical observations:
     * - NOTE: not present(!), probably replaced by the ^usageMetadata field, so we DISABLE this field
     */
    // tokenCount: z.number(),

    /**
     * Attribution information for sources that contributed to a grounded answer.
     * ONLY FOR GenerateAnswer calls - so we do not want this
     */
    // groundingAttributions: z.array(GroundingAttribution_schema).optional(),
    /**
     * Grounding metadata for the candidate.
     * This field is populated for GenerateContent calls.
     * ONLY for GenerateContent calls with grounding enabled:
     * - tools = [{googleSearch: {}}]
     */
    groundingMetadata: GroundingMetadata_schema.optional(),

    /**
     * Metadata related to url context retrieval tool.
     * This field is populated when URL context retrieval is used.
     */
    urlContextMetadata: UrlContextMetadata_schema.optional(),

    /**
     * Details the reason why the model stopped generating tokens.
     * This is populated only when finishReason is set.
     */
    finishMessage: z.string().optional(),

    // We choose to ignore the following and save the parsing time (we do not use or support logProbs):
    // avgLogprobs: z.number().optional(),
    // logprobsResult: LogprobsResult_schema.optional(),
  });


  const ModalityTokenCount_schema = z.object({
    modality: GeminiWire_ContentParts.ContentPartModality_enum,
    tokenCount: z.number(),
  });

  const UsageMetadata_schema = z.object({
    // effective prompt size, including tokens in the cached content
    promptTokenCount: z.number(),

    // (usually there: missing on first packets, or 'RECITATION' answers) total tokens across all the generated candidates
    candidatesTokenCount: z.number().optional(),

    // (never missing, but optional for future safety) total tokens across all the generated candidates
    // if candidatesTokenCount is missing, this is = promptTokenCount
    totalTokenCount: z.number().optional(),

    // Input parts
    // (optional: only if caching) tokens in the cached part of the prompt (the cached content)
    cachedContentTokenCount: z.number().optional(),
    // (optional: only if tool usage) tokens in tool-use prompt(s)
    toolUsePromptTokenCount: z.number().optional(),

    // Output parts
    // (optional: only for thinking models - and not in all packets) tokens of thoughts for thinking models
    thoughtsTokenCount: z.number().optional(),

    // Modality breakdowns - mostly commented out because we don't want to spend energy parsing them for now (we don't use them)
    promptTokensDetails: z.array(ModalityTokenCount_schema).optional(),
    cacheTokensDetails: z.array(ModalityTokenCount_schema).optional(),
    // candidatesTokensDetails: z.array(ModalityTokenCount_schema).optional(),
    // toolUsePromptTokensDetails: z.array(ModalityTokenCount_schema).optional(),
  });


  export type Response = z.infer<typeof Response_schema>;
  export const Response_schema = z.object({
    candidates: z.array(Candidate_schema)
      .optional(), // 2024-09-27: added for when Gemini only sends usageMetadata (happened firs this day, on gemini-pro-1.5-001)
    promptFeedback: GeminiWire_Safety.PromptFeedback_schema.optional(), // rarely sent (only on violations?)
    /**
     * Metadata on the generation requests' token usage.
     * Note: seems to be present on all packets now,
     *       BUT we keep .optional() for proxy error cases where infra errors are sent as message lookalikes
     *       (initially it was commented out)
     */
    usageMetadata: UsageMetadata_schema
      .optional(), // [Gemini, 2025-11-07] relaxed to optional for proxy error cases
    /** Real model version used to generate the response (what we got, not what we asked for). */
    modelVersion: z.string()
      .optional(), // [Gemini, 2025-11-07] relaxed to optional for proxy error cases
  });

}


//
// Models > List
//
export namespace GeminiWire_API_Models_List {

  export const getPath = '/v1beta/models?pageSize=1000';

  export const Methods_enum = z.enum([
    'bidiGenerateContent', // appeared on 2024-12, see https://github.com/enricoros/big-AGI/issues/700
    'countMessageTokens',
    'countTextTokens',
    'countTokens',
    'createCachedContent', // appeared on 2024-06-10, see https://github.com/enricoros/big-AGI/issues/565
    'createTunedModel',
    'createTunedTextModel',
    'embedContent',
    'embedText',
    'generateAnswer',
    'generateContent',
    'generateMessage',
    'generateText',
    'predict', // appeared on 2025-02-09, for `models/imagen-3.0-generate-002`
    'predictLongRunning', // appeared on 2025-04-10, for `models/veo-2.0-generate-001`
  ]);

  export type Model = z.infer<typeof Model_schema>;
  const Model_schema = z.object({
    name: z.string(),           // The resource name of the Model. Format: models/{model} with a {model} naming convention of: "{baseModelId}-{version}"
    // baseModelId: z.string(),    // [Gemini]: documented as required, but not present! The name of the base model, pass this to the generation request.
    version: z.string(),
    displayName: z.string(),    // Human readable
    description: z.string().optional(),
    inputTokenLimit: z.number(),
    outputTokenLimit: z.number(),
    supportedGenerationMethods: z.array(z.union([Methods_enum, z.string()])), // relaxed with z.union to not break on expansion
    temperature: z.number().optional(),
    topP: z.number().optional(),
    topK: z.number().int().optional(),
    maxTemperature: z.number().optional(),
    thinking: z.boolean().optional(),
  });

  export type Response = z.infer<typeof Response_schema>;
  export const Response_schema = z.object({
    models: z.array(Model_schema),
    nextPageToken: z.string().optional(),
  });

}
