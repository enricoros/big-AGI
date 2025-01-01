import { z } from 'zod';


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

  /// Content parts - Input

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
      name: z.string(),
      /** The function parameters and values in JSON object format. */
      args: z.record(z.any()).optional(),
    }),
  });

  /**
   * The result output from a FunctionCall that contains a string representing the FunctionDeclaration.name
   * and a structured JSON object containing any output from the function is used as context to the model.
   * This should contain the result of aFunctionCall made based on model prediction.
   *
   * NOTE from the online Google docs on 2024-07-20:
   * - The next conversation turn may contain a [FunctionResponse][content.part.function_response] with
   *   the [content.role] "function" generation context for the next model turn.
   *   This is extremely weird, because role should only be 'user' or 'model'. FIXME GOOGLE!
   */
  const FunctionResponsePart_schema = z.object({
    functionResponse: z.object({
      /** Corresponds to the related FunctionDeclaration.name */
      name: z.string(),
      /** The function response in JSON object format. */
      response: z.record(z.any()).optional(),
    }),
  });

  const FileDataPart_schema = z.object({
    fileData: z.object({
      mimeType: z.union([z.string(), ianaStandardMimeType_schema]).optional(),
      uri: z.string(),
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

  export type ContentPart = z.infer<typeof ContentPart_schema>;
  export const ContentPart_schema = z.union([
    TextPart_schema,
    InlineDataPart_schema,
    FunctionCallPart_schema,
    FunctionResponsePart_schema,
    FileDataPart_schema,
    ExecutableCodePart_schema,
    CodeExecutionResultPart_schema,
  ]);


  /// Content Parts (union of) - (model output) response.candidates[number].content.parts

  export const ModelContentPart_schema = z.union([
    TextPart_schema,
    FunctionCallPart_schema,
    ExecutableCodePart_schema,
    CodeExecutionResultPart_schema,
  ]);


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
    parts: z.array(GeminiWire_ContentParts.ContentPart_schema),
  });

  // Model Content - response.candidates[number].content

  export const ModelContent_schema = Content_schema.extend({
    role: z.literal('model'),
    // 'Model' generated contents are of fewer types compared to the ContentParts, which represent also user objects
    parts: z.array(GeminiWire_ContentParts.ModelContentPart_schema),
  });

  // export const UserMessage_schema = Content_schema.extend({
  //   role: z.literal('user'),
  // });

}

export namespace GeminiWire_ToolDeclarations {

  /// Tool definitions - Input

  const CodeExecution_schema = z.object({
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
      properties: z.record(z.any()).optional(),
      required: z.array(z.string()).optional(),
    }).optional(),
  });

  export const Tool_schema = z.object({
    codeExecution: CodeExecution_schema.optional(),
    functionDeclarations: z.array(FunctionDeclaration_schema).optional(),
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

  /// Rating

  export const HarmCategory_enum = z.enum([
    'HARM_CATEGORY_UNSPECIFIED',
    'HARM_CATEGORY_DEROGATORY',
    'HARM_CATEGORY_TOXICITY',
    'HARM_CATEGORY_VIOLENCE',
    'HARM_CATEGORY_SEXUAL',
    'HARM_CATEGORY_MEDICAL',
    'HARM_CATEGORY_DANGEROUS',
    'HARM_CATEGORY_HARASSMENT',
    'HARM_CATEGORY_HATE_SPEECH',
    'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    'HARM_CATEGORY_DANGEROUS_CONTENT',
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
    'BLOCK_LOW_AND_ABOVE',
    'BLOCK_MEDIUM_AND_ABOVE',
    'BLOCK_ONLY_HIGH',
    'BLOCK_NONE',
  ]);

  export const SafetySetting_schema = z.object({
    category: HarmCategory_enum,
    threshold: HarmBlockThreshold_enum,
  });

  /// Blocking

  const BlockReason_enum = z.enum([
    'BLOCK_REASON_UNSPECIFIED',
    'SAFETY',
    'OTHER',
  ]);

  export const PromptFeedback_schema = z.object({
    blockReason: BlockReason_enum.optional(),
    safetyRatings: z.array(SafetyRating_schema),
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
    'text/plain', // default
    'application/json', // JSON mode
  ]);

  const GenerationConfig_schema = z.object({
    /**
     * The set of character sequences (up to 5) that will stop output generation. If specified, the API will stop at the first appearance of a stop sequence.
     */
    stopSequences: z.array(z.string()).optional(),

    /**
     * [JSON mode] use 'application/json', and set the responseSchema
     * - 'text/plain' is the default
     * - 'application/json' JSON response in the candidates
     */
    responseMimeType: responseMimeType_enum.optional(),
    responseSchema: z.record(z.any()).optional(), // if set, responseMimeType must be 'application/json'

    candidateCount: z.number().int().optional(), // currently can only be set to 1
    maxOutputTokens: z.number().int().optional(),
    temperature: z.number().min(0).max(2).optional(),
    topP: z.number().optional(),
    topK: z.number().int().optional(),
  });

  export type Request = z.infer<typeof Request_schema>;
  export const Request_schema = z.object({
    // required
    contents: z.array(GeminiWire_Messages.Content_schema),

    // all optional
    tools: z.array(GeminiWire_ToolDeclarations.Tool_schema).optional(),
    toolConfig: GeminiWire_ToolDeclarations.ToolConfig_schema.optional(),
    safetySettings: z.array(GeminiWire_Safety.SafetySetting_schema).optional(),
    systemInstruction: GeminiWire_Messages.SystemInstruction_schema.optional(),
    generationConfig: GenerationConfig_schema.optional(),
    // cachedContent: z.string().optional(),
  });

  // Response

  /** Last synced from https://ai.google.dev/api/generate-content#candidate on 2024-08-03 */
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
  ]);

  const CitationMetadata_schema = z.object({
    citationSources: z.array(
      z.object({
        startIndex: z.number().optional(),  // Start of segment of the response that is attributed to this source.
        endIndex: z.number().optional(),    // End of the attributed segment, exclusive.
        uri: z.string().optional(),         // URI that is attributed as a source for a portion of the text.
        license: z.string().optional(),     // License for the GitHub project that is attributed as a source for segment.
      }),
    ),
  });

  const Candidate_schema = z.object({
    /**
     * Index of the candidate in the list of candidates.
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
     * List of ratings for the safety of a response candidate.
     * At most one rating per category.
     *
     * Empirical observations:
     * - Not present on the first packet? Second and after?
     * - Not present when finishReason is 'RECITATION'
     * - Usually defined for 4 categories: SEXUALLY_EXPLICIT, HATE_SPEECH, HARASSMENT, DANGEROUS_CONTENT
     */
    safetyRatings: z.array(GeminiWire_Safety.SafetyRating_schema).optional(),
    /**
     * A citation to a source for a portion of a specific response.
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
     * - NOTE: not present(!), probably replaced by the ^usageMetadata field
     */
    tokenCount: z.number().optional(),
    // groundingAttributions: z.array(...).optional(), // This field is populated for GenerateAnswer calls.
  });

  const UsageMetadata_schema = z.object({
    promptTokenCount: z.number(),
    candidatesTokenCount: z.number().optional(), // .optional: in case the first message is 'RECITATION' there could be no output token count
    // totalTokenCount: z.number(),
    // cachedContentTokenCount: z.number().optional(), // Not supported for now, hence disabled
  });

  export type Response = z.infer<typeof Response_schema>;
  export const Response_schema = z.object({
    candidates: z.array(Candidate_schema)
      .optional(), // 2024-09-27: added for when Gemini only sends usageMetadata (happened firs this day, on gemini-pro-1.5-001)
    promptFeedback: GeminiWire_Safety.PromptFeedback_schema.optional(), // rarely sent (only on violations?)
    /**
     * Metadata on the generation requests' token usage.
     * Note: seems to be present on all packets now, so we're commending the .optional()
     */
    usageMetadata: UsageMetadata_schema, // .optional()
  });

}


//
// Models > List
//
export namespace GeminiWire_API_Models_List {

  export const getPath = '/v1beta/models?pageSize=1000';

  const Methods_enum = z.enum([
    'bidiGenerateContent', // appeared on 2024-12, see https://github.com/enricoros/big-AGI/issues/700
    'createCachedContent', // appeared on 2024-06-10, see https://github.com/enricoros/big-AGI/issues/565
    'countMessageTokens',
    'countTextTokens',
    'countTokens',
    'createTunedModel',
    'createTunedTextModel',
    'embedContent',
    'embedText',
    'generateAnswer',
    'generateContent',
    'generateMessage',
    'generateText',
  ]);

  export type Model = z.infer<typeof Model_schema>;
  const Model_schema = z.object({
    name: z.string(),           // The resource name of the Model. Format: models/{model} with a {model} naming convention of: "{baseModelId}-{version}"
    // baseModelId: z.string(),    // [Gemini]: documented as required, but not present! The name of the base model, pass this to the generation request.
    version: z.string(),
    displayName: z.string(),    // Human readable
    description: z.string(),
    inputTokenLimit: z.number(),
    outputTokenLimit: z.number(),
    supportedGenerationMethods: z.array(z.union([Methods_enum, z.string()])), // relaxed with z.union to not break on expansion
    temperature: z.number().optional(),
    topP: z.number().optional(),
    topK: z.number().int().optional(),
  });

  export type Response = z.infer<typeof Response_schema>;
  export const Response_schema = z.object({
    models: z.array(Model_schema),
    nextPageToken: z.string().optional(),
  });

}
