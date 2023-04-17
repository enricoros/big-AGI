export namespace ElevenLabs {
  /**
   * Client (Browser) -> Server (Next.js)
   */
  export namespace API {

    export namespace TextToSpeech {
      export interface RequestBody {
        apiKey?: string;
        text: string;
        voiceId?: string;
      }

      export type Response = ArrayBuffer;
    }

    export namespace Voices {
      export interface RequestBody {
        apiKey?: string;
      }

      export interface Response {
        voices: {
          id: string;
          name: string;
          description: string;
          previewUrl: string;
          category: string;
          default: boolean;
        }[];
      }
    }
  }

  /**
   * This is the API as defined by ElevenLabs, for Server (Next.js) -> Server (ElevenLabs)
   */
  export namespace Wire {
    export namespace TextToSpeech {
      export interface Request {
        text: string;
        voice_settings?: {
          stability: number;
          similarity_boost: number;
        };
      }
    }

    export namespace Voices {
      export interface List {
        voices: Voice[];
      }

      interface Voice {
        voice_id: string;
        name: string;
        //samples: Sample[];
        category: string;
        // fine_tuning: FineTuning;
        labels: Record<string, string>;
        description: string;
        preview_url: string;
        // available_for_tiers: string[];
        settings: Settings;
      }

      interface Settings {
        stability: number;
        similarity_boost: number;
      }
    }
  }
}
