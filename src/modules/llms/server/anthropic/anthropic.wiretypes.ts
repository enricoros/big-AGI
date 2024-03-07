export namespace AnthropicWire {
  export namespace Messages {
    export interface CreateRequest {
      messages: {
        content: string;
        role: 'user' | 'assistant';
      }[];
      model: string;
      max_tokens_to_sample?: number;
      stop_sequences?: string[];
      max_tokens?: number;
      stream?: boolean;
      temperature?: number;
      top_k?: number;
      top_p?: number;
      metadata?: {
        user_id?: string;
      };
    }

    export interface CreateResponse {
      messages: {
        content: string;
        role: 'user' | 'assistant';
      }[];
      model: string;
      log_id: string; // some log
    }
  }
}