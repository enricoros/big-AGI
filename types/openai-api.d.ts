declare module 'openai-api' {
  export default class OpenAI {
    constructor(apiKey: string);
    completions: {
      create: (args: {
        engine: string;
        prompt: string;
        maxTokens: number;
        n?: number;
        stop?: string | string[];
        temperature?: number;
        logprobs?: number;
        echo?: boolean;
        presencePenalty?: number;
        frequencyPenalty?: number;
        bestOf?: number;
      }) => Promise<{
        id: string;
        object: string;
        created: number;
        model: string;
        choices: {
          text: string;
          index: number;
          logprobs: null;
          finish_reason: string;
        }[];
      }>;
    };
  }
}
