export namespace OpenAI {

  /// Client (Browser) -> Server (Next.js)
  export namespace API {
    
    export namespace Chat {

      export interface Response {
        role: 'assistant' | 'system' | 'user';
        content: string;
        finish_reason: 'stop' | 'length' | null;
      }

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

  /// This is the upstream API, for Server (Next.js) -> Upstream Server
  export namespace Wire {
    export namespace Chat {
      export interface Message {
        role: 'assistant' | 'system' | 'user';
        content: string;
      }

      export interface CompletionRequest {
        model: string;
        messages: Message[];
        temperature?: number;
        top_p?: number;
        frequency_penalty?: number;
        presence_penalty?: number;
        max_tokens?: number;
        stream: boolean;
        n: number;
      }

      export interface CompletionResponse {
        id: string;
        object: 'chat.completion';
        created: number; // unix timestamp in seconds
        model: string; // can differ from the ask, e.g. 'gpt-4-0314'
        choices: {
          index: number;
          message: Message;
          finish_reason: 'stop' | 'length' | null;
        }[];
        usage: {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        };
      }

      export interface CompletionResponseChunked {
        id: string;
        object: 'chat.completion.chunk';
        created: number;
        model: string;
        choices: {
          index: number;
          delta: Partial<Message>;
          finish_reason: 'stop' | 'length' | null;
        }[];
      }
    }

    export namespace Models {
      export interface ModelDescription {
        id: string;
        object: 'model';
        created: number;
        owned_by: 'openai' | 'openai-dev' | 'openai-internal' | 'system' | string;
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
