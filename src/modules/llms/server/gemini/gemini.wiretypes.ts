import { z } from 'zod';

// PATHS

export const geminiModelsListPath = '/v1beta/models?pageSize=1000';
export const geminiModelsGenerateContentPath = '/v1beta/{model=models/*}:generateContent';
// see alt=sse on https://cloud.google.com/apis/docs/system-parameters#definitions
export const geminiModelsStreamGenerateContentPath = '/v1beta/{model=models/*}:streamGenerateContent?alt=sse';


// models.list = /v1beta/models

const geminiModelSchema = z.object({
  name: z.string(),
  version: z.string(),
  displayName: z.string(),
  description: z.string(),
  inputTokenLimit: z.number().int().min(1),
  outputTokenLimit: z.number().int().min(1),
  supportedGenerationMethods: z.array(z.enum([
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
  ])),
  temperature: z.number().optional(),
  topP: z.number().optional(),
  topK: z.number().optional(),
});
export type GeminiModelSchema = z.infer<typeof geminiModelSchema>;

export const geminiModelsListOutputSchema = z.object({
  models: z.array(geminiModelSchema),
});


// /v1/{model=models/*}:generateContent, /v1beta/{model=models/*}:streamGenerateContent

// Request

const geminiContentPartSchema = z.union([

  // TextPart
  z.object({
    text: z.string().optional(),
  }),

  // InlineDataPart
  z.object({
    inlineData: z.object({
      mimeType: z.string(),
      data: z.string(), // base64-encoded string
    }),
  }),

  // A predicted FunctionCall returned from the model
  z.object({
    functionCall: z.object({
      name: z.string(),
      args: z.record(z.any()), // JSON object format
    }),
  }),

  // The result output of a FunctionCall
  z.object({
    functionResponse: z.object({
      name: z.string(),
      response: z.record(z.any()), // JSON object format
    }),
  }),
]);

const geminiToolSchema = z.object({
  functionDeclarations: z.array(z.object({
    name: z.string(),
    description: z.string(),
    parameters: z.record(z.any()).optional(), // Schema object format
  })).optional(),
});

const geminiHarmCategorySchema = z.enum([
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

export const geminiBlockSafetyLevelSchema = z.enum([
  'HARM_BLOCK_THRESHOLD_UNSPECIFIED',
  'BLOCK_LOW_AND_ABOVE',
  'BLOCK_MEDIUM_AND_ABOVE',
  'BLOCK_ONLY_HIGH',
  'BLOCK_NONE',
]);

export type GeminiBlockSafetyLevel = z.infer<typeof geminiBlockSafetyLevelSchema>;

const geminiSafetySettingSchema = z.object({
  category: geminiHarmCategorySchema,
  threshold: geminiBlockSafetyLevelSchema,
});

const geminiGenerationConfigSchema = z.object({
  stopSequences: z.array(z.string()).optional(),
  candidateCount: z.number().int().optional(),
  maxOutputTokens: z.number().int().optional(),
  temperature: z.number().optional(),
  topP: z.number().optional(),
  topK: z.number().int().optional(),
});

const geminiContentSchema = z.object({
  // Must be either 'user' or 'model'. Optional but must be set if there are multiple "Content" objects in the parent array.
  role: z.enum(['user', 'model']).optional(),
  // Ordered Parts that constitute a single message. Parts may have different MIME types.
  parts: z.array(geminiContentPartSchema),
});

export type GeminiContentSchema = z.infer<typeof geminiContentSchema>;

export const geminiGenerateContentRequest = z.object({
  contents: z.array(geminiContentSchema),
  tools: z.array(geminiToolSchema).optional(),
  safetySettings: z.array(geminiSafetySettingSchema).optional(),
  generationConfig: geminiGenerationConfigSchema.optional(),
});

export type GeminiGenerateContentRequest = z.infer<typeof geminiGenerateContentRequest>;


// Response

const geminiHarmProbabilitySchema = z.enum([
  'HARM_PROBABILITY_UNSPECIFIED',
  'NEGLIGIBLE',
  'LOW',
  'MEDIUM',
  'HIGH',
]);

const geminiSafetyRatingSchema = z.object({
  'category': geminiHarmCategorySchema,
  'probability': geminiHarmProbabilitySchema,
  'blocked': z.boolean().optional(),
});

const geminiFinishReasonSchema = z.enum([
  'FINISH_REASON_UNSPECIFIED',
  'STOP',
  'MAX_TOKENS',
  'SAFETY',
  'RECITATION',
  'OTHER',
]);

export const geminiGeneratedContentResponseSchema = z.object({
  // either all requested candidates are returned or no candidates at all
  // no candidates are returned only if there was something wrong with the prompt (see promptFeedback)
  candidates: z.array(z.object({
    index: z.number(),
    content: geminiContentSchema.optional(), // this can be missing if the finishReason is not 'MAX_TOKENS'
    finishReason: geminiFinishReasonSchema.optional(),
    safetyRatings: z.array(geminiSafetyRatingSchema).optional(), // undefined when finishReason is 'RECITATION'
    citationMetadata: z.object({
      startIndex: z.number().optional(),
      endIndex: z.number().optional(),
      uri: z.string().optional(),
      license: z.string().optional(),
    }).optional(),
    tokenCount: z.number().optional(),
    // groundingAttributions: z.array(GroundingAttribution).optional(), // This field is populated for GenerateAnswer calls.
  })).optional(),
  // NOTE: promptFeedback is only send in the first chunk in a streaming response
  promptFeedback: z.object({
    blockReason: z.enum(['BLOCK_REASON_UNSPECIFIED', 'SAFETY', 'OTHER']).optional(),
    safetyRatings: z.array(geminiSafetyRatingSchema).optional(),
  }).optional(),
});
