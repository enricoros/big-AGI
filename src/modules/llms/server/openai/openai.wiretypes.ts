import { z } from 'zod';


/**
 * OpenAI API types - https://platform.openai.com/docs/api-reference/
 *
 * Notes:
 *  - 2023-12-22:
 *    Below we have the manually typed types for the OpenAI API. Everywhere else we are switching
 *    to Zod inferred types, and we shall do it here sooner (so we can validate upon parsing too).
 *
 *  - [FN0613]: function calling capability - only 2023-06-13 and later Chat models
 */
export namespace OpenAIWire {

  export namespace ChatCompletion {

    export interface Request {
      model: string;
      messages: RequestMessage[];
      temperature?: number;
      top_p?: number;
      frequency_penalty?: number;
      presence_penalty?: number;
      max_tokens?: number;
      stream: boolean;
      n?: number;
      // [FN0613]
      functions?: RequestFunctionDef[],
      function_call?: 'auto' | 'none' | {
        name: string;
      },
    }

    export interface RequestMessage {
      role: 'assistant' | 'system' | 'user'; // | 'function';
      content: string;
      //name?: string; // when role: 'function'
    }

    export interface RequestFunctionDef { // [FN0613]
      name: string;
      description?: string;
      parameters?: {
        type: 'object';
        properties: {
          [key: string]: {
            type: 'string' | 'number' | 'integer' | 'boolean';
            description?: string;
            enum?: string[];
          }
        }
        required?: string[];
      };
    }


    export interface Response {
      id: string;
      object: 'chat.completion';
      created: number; // unix timestamp in seconds
      model: string; // can differ from the ask, e.g. 'gpt-4-0314'
      choices: {
        index: number;
        message: ResponseMessage | ResponseFunctionCall; // [FN0613]
        finish_reason: 'stop' | 'length' | null | 'function_call'; // [FN0613]
      }[];
      usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
    }

    export interface ResponseMessage {
      role: 'assistant';
      content: string;
    }

    export interface ResponseFunctionCall { // [FN0613]
      role: 'assistant';
      content: null;
      function_call: { // if content is null and finish_reason is 'function_call'
        name: string;
        arguments: string; // a JSON object, to deserialize
      };
    }

    export interface ResponseStreamingChunk {
      id: string;
      object: 'chat.completion.chunk' | ''; // '' is for some Azure responses
      created: number;
      model: string;
      choices: {
        index: number;
        delta: Partial<ResponseMessage>;
        finish_reason: 'stop' | 'length' | null;
      }[];
      // undocumented, but can be present, e.g. "This model version is deprecated and a newer version \'gpt-4-0613\' is available. Migrate before..."
      warning?: string;
      // this could also be an error - first experienced on 2023-06-19 on streaming APIs (undocumented)
      error?: {
        message: string;
        type: 'server_error' | string;
        param: string | null;
        code: string | null;
      };
    }
  }


  export namespace Models {
    export interface ModelDescription {
      id: string;
      object: 'model';
      created: number;
      owned_by: 'openai' | 'openai-dev' | 'openai-internal' | 'system' | string; // 'user' for Oobabooga models
      // [2023-11-08] Note: the following properties are not present in OpenAI responses any longer
      // permission: any[];
      // root: string;
      // parent: null;

      // non-standard properties
      //context_length?: number; // Openrouter-only models, non-standard - commented because dynamically added by the Openrouter vendor code
    }

    export interface Response {
      object: string;
      data: ModelDescription[];
    }
  }


  export namespace Moderation {
    export interface Request {
      input: string | string[];
      model?: 'text-moderation-stable' | 'text-moderation-latest';
    }

    export enum ModerationCategory {
      // noinspection JSUnusedGlobalSymbols
      hate = 'hate',
      'hate/threatening' = 'hate/threatening',
      'self-harm' = 'self-harm',
      sexual = 'sexual',
      'sexual/minors' = 'sexual/minors',
      violence = 'violence',
      'violence/graphic' = 'violence/graphic',
    }

    export interface Response {
      id: string;
      model: string;
      results: [
        {
          categories: { [key in ModerationCategory]: boolean };
          category_scores: { [key in ModerationCategory]: number };
          flagged: boolean;
        }
      ];
    }
  }

}


// OpenAI text to image generation - https://platform.openai.com/docs/api-reference/images/create

const wireOpenAICreateImageRequestSchema = z.object({
  // The maximum length is 1000 characters for dall-e-2 and 4000 characters for dall-e-3
  prompt: z.string().max(4000),

  // The model to use for image generation
  model: z.enum(['dall-e-2', 'dall-e-3']).optional().default('dall-e-2'),

  // The number of images to generate. Must be between 1 and 10. For dall-e-3, only n=1 is supported.
  n: z.number().min(1).max(10).nullable().optional(),

  // 'hd' creates images with finer details and greater consistency across the image. This param is only supported for dall-e-3
  quality: z.enum(['standard', 'hd']).optional(),

  // The format in which the generated images are returned
  response_format: z.enum(['url', 'b64_json']).optional(), //.default('url'),

  // 'dall-e-2': must be one of 256x256, 512x512, or 1024x1024
  // 'dall-e-3': must be one of 1024x1024, 1792x1024, or 1024x1792
  size: z.enum(['256x256', '512x512', '1024x1024', '1792x1024', '1024x1792']).optional().default('1024x1024'),

  // only used by 'dall-e-3': 'vivid' (hyper-real and dramatic images) or 'natural'
  style: z.enum(['vivid', 'natural']).optional().default('vivid'),

  // A unique identifier representing your end-user
  user: z.string().optional(),
});

export type WireOpenAICreateImageRequest = z.infer<typeof wireOpenAICreateImageRequestSchema>;

export const wireOpenAICreateImageOutputSchema = z.object({
  created: z.number(),
  data: z.array(z.object({
    b64_json: z.string().optional(),
    url: z.string().optional(),
    revised_prompt: z.string().optional(),
  })),
});

export type WireOpenAICreateImageOutput = z.infer<typeof wireOpenAICreateImageOutputSchema>;