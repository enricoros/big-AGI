import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, publicProcedure, router } from './trpc.server';

// Zod schemas for input validation
const textGenerationInputSchema = z.object({
  modelId: z.string(),
  prompt: z.string(),
});

const imageGenerationInputSchema = z.object({
  modelId: z.string(),
  prompt: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  seed: z.number().optional(),
});

export const llmPollinationsRouter = router({
  /**
   * Text generation
   */
  generateText: publicProcedure // Assuming public access for free models
    .input(textGenerationInputSchema)
    .mutation(async ({ input }) => {
      const { modelId, prompt } = input;
      const fullModelId = modelId.startsWith('pollinations-') ? modelId.substring('pollinations-'.length) : modelId;
      const encodedPrompt = encodeURIComponent(prompt);
      const apiUrl = `https://text.pollinations.ai/prompt/${fullModelId}/${encodedPrompt}`;

      try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
          const errorBody = await response.text();
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Pollinations text API request failed: ${response.statusText} - ${errorBody}`,
          });
        }
        // Assuming the API returns a JSON object with a "text" field or similar
        // For Pollinations, it seems to return the raw text directly for some models,
        // or a JSON for others. We might need to inspect headers or try parsing.
        // For now, let's assume it's raw text for simplicity in this step.
        const text = await response.text();
        // If it's JSON like { "output": "...", "status": "..." }
        // try {
        //   const jsonResponse = JSON.parse(text);
        //   return { text: jsonResponse.output || jsonResponse.text || text };
        // } catch (e) {
        //   // Not JSON, return raw text
        //   return { text };
        // }
        return { text }; // Simplification for now
      } catch (error: any) {
        console.error('Pollinations text generation error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to generate text via Pollinations',
          cause: error,
        });
      }
    }),

  /**
   * Image generation
   */
  generateImage: publicProcedure // Assuming public access
    .input(imageGenerationInputSchema)
    .mutation(async ({ input }) => {
      const { modelId, prompt, width, height, seed } = input;
      const fullModelId = modelId.startsWith('pollinations-') ? modelId.substring('pollinations-'.length) : modelId;
      const encodedPrompt = encodeURIComponent(prompt);

      let apiUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?model=${fullModelId}&nofeed=true`;
      if (width) apiUrl += `&width=${width}`;
      if (height) apiUrl += `&height=${height}`;
      if (seed !== undefined) apiUrl += `&seed=${seed}`;

      try {
        // Important: Pollinations image API returns the image directly, not a JSON response with a URL.
        // We need to fetch the image and decide how to return it.
        // Option 1: Return the URL (client fetches). Simpler, but client needs to handle image loading.
        // Option 2: Fetch image data on server, return as base64. More complex, increases server load.
        // For now, let's return the URL, as it's common for image generation APIs.
        // However, the Pollinations API itself seems to be the direct image URL.
        // So, the client could construct this URL. But proxying gives us control.
        // The challenge is that `fetch` here will get the image binary.
        // We can't just return `response.url` as that would be our TRPC endpoint.
        // The most straightforward for a TRPC mutation that *returns data* is to return the effective URL.

        // The client will use this URL to display the image.
        return { imageUrl: apiUrl };

      } catch (error: any) {
        console.error('Pollinations image generation error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to generate image via Pollinations',
          cause: error,
        });
      }
    }),
});
