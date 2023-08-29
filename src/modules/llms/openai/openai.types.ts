export namespace OpenAI {

  /// Client (Browser) -> Server (Next.js)
  export namespace API {

    export namespace Chat {

      /**
       * The client will be sent a stream of words. As an extra (an totally optional) 'data channel' we send a
       * string JSON object with the few initial variables. We hope in the future to adopt a better
       * solution (e.g. websockets, but that will exclude deployment in Edge Functions).
       */
      export interface StreamingFirstResponse {
        model: string;
      }
    }
  }


  /**
   * OpenAI API types - https://platform.openai.com/docs/api-reference/
   *
   * Notes:
   *  - [FN0613]: function calling capability - only 2023-06-13 and later Chat models
   */
  export namespace Wire {
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
        n: number;
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
        object: 'chat.completion.chunk';
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


    export namespace Models {
      export interface ModelDescription {
        id: string;
        object: 'model';
        created: number;
        owned_by: 'openai' | 'openai-dev' | 'openai-internal' | 'system' | string; // 'user' for Oobabooga models
        permission: any[];
        root: string;
        parent: null;
      }

      export interface Response {
        object: string;
        data: ModelDescription[];
      }
    }
  }
}
