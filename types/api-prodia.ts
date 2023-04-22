export namespace Prodia {
  /**
   * Client (Browser) -> Server (Next.js)
   */
  export namespace API {

    export namespace Imagine {
      export interface RequestBody {
        apiKey?: string;
        prompt: string;
      }

      export type Response = (
        { status: 'success', imageUrl: string }
        | { status: 'error', error: string }
        ) & { elapsed: number };
    }
  }

  /**
   * This is the API as defined by Prodia, for Server (Next.js) -> Server (Prodia)
   * [Rev-eng on Apr 22, 2023]
   */
  export namespace Wire {
    export namespace Imagine {
      export interface JobRequest {
        model: 'sdv1_4.ckpt [7460a6fa]' | string;
        prompt: string;
      }

      export interface JobResponse {
        job: string;
        params: {
          prompt: string;
          cfg_scale: number;
          steps: number;
          negative_prompt: string;
          seed: number;
          upscale: boolean;
          sampler_name: 'Euler' | string;
          width: 512 | number;
          height: 512 | number;
          options: { sd_model_checkpoint: 'sdv1_4.ckpt [7460a6fa]' | string; };
        };
        status: 'queued' | 'generating' | 'succeeded' | 'failed';
        imageUrl?: string;
      }
    }
  }
}
