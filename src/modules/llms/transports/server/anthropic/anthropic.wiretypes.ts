export namespace AnthropicWire {
  export namespace Complete {
    export interface Request {
      prompt: string;
      model: string;
      max_tokens_to_sample: number;
      stop_sequences?: string[];
      stream?: boolean;
      temperature?: number;
      top_k?: number;
      top_p?: number;
      metadata?: {
        user_id?: string;
      };
    }

    export interface Response {
      completion: string;
      stop_reason: 'stop_sequence' | 'max_tokens' | string;
      model: string;
      stop: string | null; // the stop sequence, if stop_reason is 'stop_sequence'
      log_id: string; // some log

      // removed since the 2023-06-01 API version
      // truncated: boolean;
      // exception: string | null;
    }
  }
}