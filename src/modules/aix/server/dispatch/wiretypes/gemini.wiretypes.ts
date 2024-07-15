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

  export const TextContentPart_schema = z.object({
    text: z.string(),
  });

  const InlineDataPart_schema = z.object({
    inlineData: z.object({
      mimeType: z.union([z.string(), ianaStandardMimeType_schema]),
      data: z.string(), // base64-encoded string
    }),
  });

  const FunctionCallPart_schema = z.object({
    functionCall: z.object({
      name: z.string(),
      args: z.record(z.any()), // JSON object format
    }),
  });

  const FunctionResponsePart_schema = z.object({
    functionResponse: z.object({
      name: z.string(),
      response: z.record(z.any()), // Optional. JSON object format
    }),
  });

  /*const FileDataPart_schema = z.object({
    fileData: z.object({
      mimeType: z.union([z.string(), ianaStandardMimeType_schema]).optional(),
      uri: z.string(),
    }),
  });*/

  export const ContentPart_schema = z.union([
    TextContentPart_schema,
    InlineDataPart_schema,
    FunctionCallPart_schema,
    FunctionResponsePart_schema,
  ]);

  export function TextContentPart(text: string): z.infer<typeof TextContentPart_schema> {
    return { text };
  }

  export function InlineDataPart(mimeType: string, data: string): z.infer<typeof InlineDataPart_schema> {
    return { inlineData: { mimeType, data } };
  }

}

export namespace GeminiWire_Messages {

  export const Content_schema = z.object({
    // Must be either 'user' or 'model'. Optional but must be set if there are multiple "Content" objects in the parent array.
    role: z.enum(['user', 'model']).optional(),
    // Ordered Parts that constitute a single message. Parts may have different MIME types.
    parts: z.array(GeminiWire_ContentParts.ContentPart_schema),
  });

  // export const UserMessage_schema = Content_schema.extend({
  //   role: z.literal('user'),
  // });
  //
  export const ModelContent_schema = Content_schema.extend({
    role: z.literal('model'),
  });
  //
  // export const SystemMessage_schema = z.object({
  //   parts: z.array(z.object({
  //     text: z.string(),
  //   })),
  // });

  export const SystemInstruction_schema = z.object({
    // Note: should be 'contents' object, but since it's text-only, we cast it down with a custom definition
    parts: z.array(GeminiWire_ContentParts.TextContentPart_schema),
  });


  //
  // export const Message_schema = z.union([
  //   UserMessage_schema,
  //   ModelMessage_schema,
  //   SystemMessage_schema,
  // ]);
}

export namespace GeminiWire_Tools {

  /// Tool definitions - Input

  const CodeExecution_schema = z.object({
    // Not documented yet, as of 2024-07-14
  });

  export const FunctionDeclaration_schema = z.object({
    name: z.string(),
    description: z.string(),
    /**
     *  Subset of OpenAPI 3.0 schema object
     *  https://ai.google.dev/api/rest/v1beta/cachedContents#schema
     *  Here we relax the check.
     */
    parameters: z.record(z.any()).optional(),
  });

  export const Tool_schema = z.object({
    codeExecution: CodeExecution_schema.optional(),
    functionDeclarations: z.array(FunctionDeclaration_schema).optional(),
  });

  export const ToolConfig_schema = z.object({
    functionCallingConfig: z.object({
      mode: z.enum([
        'AUTO', // (default) The model decides to predict either a function call or a natural language response.
        'ANY', // The model is constrained to always predict a function call. If allowed_function_names is provided, the model picks from the set of allowed functions.
        'NONE', // The model behavior is the same as if you don't pass any function declarations.
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
    stopSequences: z.array(z.string()).optional(),

    // [JSON mode] use 'application/json', and set the responseSchema
    responseMimeType: responseMimeType_enum.optional(), // defaults to 'text/plain'
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
    tools: z.array(GeminiWire_Tools.Tool_schema).optional(),
    toolConfig: GeminiWire_Tools.ToolConfig_schema.optional(),
    safetySettings: z.array(GeminiWire_Safety.SafetySetting_schema).optional(),
    systemInstruction: GeminiWire_Messages.SystemInstruction_schema.optional(),
    generationConfig: GenerationConfig_schema.optional(),
    cachedContent: z.string().optional(),
  });

  // Response

  const FinishReason_enum = z.enum([
    'FINISH_REASON_UNSPECIFIED',  // unused
    'STOP',                       // Natural stop point of the model or provided stop sequence.
    'MAX_TOKENS',                 // The maximum number of tokens as specified in the request was reached.
    'SAFETY',                     // The candidate content was flagged for safety reasons. See safetyRatings.
    'RECITATION',                 // The candidate content was flagged for recitation reasons. See citationMetadata.
    'OTHER',                      // Unknown reason
  ]);

  const CitationMetadata_schema = z.object({
    citationSources: z.array(z.object({
      startIndex: z.number().optional(),
      endIndex: z.number().optional(),
      uri: z.string().optional(),
      license: z.string().optional(),
    })),
  });

  const Candidate_schema = z.object({
    index: z.number(),
    content: GeminiWire_Messages.ModelContent_schema.optional(), // this can be missing if the finishReason is not 'MAX_TOKENS'
    finishReason: FinishReason_enum.optional(),
    safetyRatings: z.array(GeminiWire_Safety.SafetyRating_schema).optional(), // undefined when finishReason is 'RECITATION'
    citationMetadata: CitationMetadata_schema.optional(), // NOTE: may be defined on 'RECITATION'
    tokenCount: z.number().optional(),
    // groundingAttributions: z.array(...).optional(), // This field is populated for GenerateAnswer calls.
  });

  const UsageMetadata_schema = z.object({
    promptTokenCount: z.number(),
    cachedContentTokenCount: z.number().optional(),
    candidatesTokenCount: z.number(),
    totalTokenCount: z.number(),
  });

  export type Response = z.infer<typeof Response_schema>;
  export const Response_schema = z.object({
    candidates: z.array(Candidate_schema),
    promptFeedback: GeminiWire_Safety.PromptFeedback_schema.optional(), // sent when starting
    usageMetadata: UsageMetadata_schema.optional(), // sent when done
  });

}


//
// Models > List
//
export namespace GeminiWire_API_Models_List {

  export const getPath = '/v1beta/models?pageSize=1000';

  const Methods_enum = z.enum([
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
    supportedGenerationMethods: z.array(Methods_enum),
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
