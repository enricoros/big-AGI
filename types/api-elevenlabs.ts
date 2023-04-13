export namespace ElevenLabs.API {
  export interface Configuration {
    apiKey?: string;
    apiHost?: string;
  }

  export namespace TextToSpeech {
    export interface Request {
      text: string;
      voice_settings?: {
        stability: number;
        similarity_boost: number;
      };
    }
  }
}
