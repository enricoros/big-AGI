/**
 * OpenAI API types - https://platform.openai.com/docs/api-reference/
 *
 * Notes:
 *  - 2023-12-22:
 *    Below we have the manually typed types for the OpenAI API. Everywhere else we are switching
 *    to Zod inferred types, and we shall do it here sooner (so we can validate upon parsing too).
 */
export namespace OpenAIWire {

  export namespace ChatCompletion {

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

  }
}
