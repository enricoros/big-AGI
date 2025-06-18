import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, publicProcedure, router } from '~/server/trpc/trpc.server'; // Assuming your trpc setup
import { minumanResolver, type ResolvedRun } from '~/modules/aix/server/dispatch/resolve';

// Import ZhipuAIAccessSchema if it's in a .types file, or define here if not already
// For this example, assuming it's defined in the vendor file and imported via context or similar
import type { ZhipuAIAccessSchema } from '../vendors/zhipuai/zhipuai.vendor';

// Helper to get API key from context or input - adjust as per your TRPC context setup
const getApiKey = (ctx: any, input: Partial<ZhipuAIAccessSchema>): string => {
  const apiKey = input.apiKey || ctx?.apiKey || (ctx?.req?.headers as any)?.['x-zhipuai-api-key'];
  if (!apiKey) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'ZhipuAI API key not provided.' });
  return apiKey;
};

const chatCompletionsInputSchema = z.object({
  apiKey: z.string().optional(), // Optional here if primarily from context
  model: z.string(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system', 'tool']),
    content: z.string(),
    tool_calls: z.array(z.object({
      id: z.string(),
      type: z.literal('function'),
      function: z.object({
        name: z.string(),
        arguments: z.string(),
      }),
    })).optional(),
    tool_call_id: z.string().optional(),
  })),
  temperature: z.number().optional(),
  top_p: z.number().optional(),
  max_tokens: z.number().optional(),
  stream: z.boolean().optional(),
  // TODO: Add other ZhipuAI specific params: request_id, tool_choice, tools
});

const imageGenerationInputSchema = z.object({
  apiKey: z.string().optional(),
  model: z.string(), // e.g., "cogview-3"
  prompt: z.string(),
  size: z.string().optional(), // e.g., "1024x1024"
  quality: z.string().optional(), // e.g., "standard" or "hd"
  user_id: z.string().optional(), // For tracking and abuse prevention
});

const videoGenerationStartInputSchema = z.object({
  apiKey: z.string().optional(),
  model: z.string(), // e.g., "cogvideox"
  prompt: z.string(),
  image_url: z.string().optional(),
  quality: z.string().optional(),
  with_audio: z.boolean().optional(),
  size: z.string().optional(),
  fps: z.number().optional(),
});

const videoCheckStatusInputSchema = z.object({
  apiKey: z.string().optional(),
  task_id: z.string(),
});


export const llmZhipuAIRouter = router({

  /**
   * Text Generation (GLM-4-Flash and similar)
   */
  generateText: minumanResolver<ZhipuAIAccessSchema, typeof chatCompletionsInputSchema, ReadableStream>(
    chatCompletionsInputSchema,
    async ({ ctx, input, resolvedRun }): Promise<ResolvedRun<ReadableStream>> => {
      const apiKey = getApiKey(ctx, input);
      const { model, messages, stream, ...restPayload } = input;

      const ZHIPUAI_API_HOST = 'https://open.bigmodel.cn/api/paas/v4';
      const chatCompletionUrl = `${ZHIPUAI_API_HOST}/chat/completions`;

      const headers: HeadersInit = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };
      if (stream) {
        headers['Accept'] = 'text/event-stream';
      }

      const body = JSON.stringify({
        model,
        messages,
        stream: stream ?? false,
        ...restPayload,
        // ZhipuAI specific parameters can be added here if not covered by restPayload
        // e.g. meta: { user_id: '...', request_id: '...' } based on their docs for some models
      });

      try {
        const response = await fetch(chatCompletionUrl, { method: 'POST', headers, body });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `ZhipuAI API request failed: ${response.status} ${response.statusText} - ${errorBody}`,
          });
        }

        if (!stream || !response.body) {
          // Not streaming or no body, return full response
          const jsonResponse = await response.json();
          // Adapt to a stream-like response for consistency if needed by client, or handle differently
          const singleChunk = JSON.stringify(jsonResponse);
          const readableStream = new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(`data: ${singleChunk}\n\n`));
              controller.close();
            }
          });
          return { data: readableStream, resolvedRun: resolvedRun! };
        }

        // Return the stream directly
        return { data: response.body as ReadableStream, resolvedRun: resolvedRun! };

      } catch (error: any) {
        console.error('ZhipuAI text generation error:', error);
        const message = error.message || 'Failed to generate text via ZhipuAI';
        throw new TRPCError({
          code: error.code && typeof error.code === 'string' ? error.code as any : 'INTERNAL_SERVER_ERROR',
          message,
          cause: error,
        });
      }
    }),

  /**
   * Image Generation (CogView-3-Flash)
   */
  generateImage: publicProcedure // Or protectedProcedure if API key comes from context securely
    .input(imageGenerationInputSchema)
    .mutation(async ({ ctx, input }) => {
      const apiKey = getApiKey(ctx, input);
      const { model, prompt, size, quality, user_id } = input;

      const ZHIPUAI_API_HOST = 'https://open.bigmodel.cn/api/paas/v4';
      const imageGenerationUrl = `${ZHIPUAI_API_HOST}/images/generations`;

      const headers: HeadersInit = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };

      const payload: any = {
        model,
        prompt,
      };
      if (size) payload.size = size;
      if (quality) payload.quality = quality;
      if (user_id) payload.user_id = user_id;
      // Default to 1 image if not specified, though ZhipuAI's image API seems to generate one by default.
      // payload.n = 1;

      try {
        const response = await fetch(imageGenerationUrl, { method: 'POST', headers, body: JSON.stringify(payload) });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `ZhipuAI Image API request failed: ${response.status} ${response.statusText} - ${errorBody}`,
          });
        }

        const jsonResponse = await response.json();
        // Expects response like: { created: number, data: [{ url: string }] }
        if (!jsonResponse.data || !jsonResponse.data.length || !jsonResponse.data[0].url) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'ZhipuAI Image API response did not contain expected image URL.',
            cause: jsonResponse,
          });
        }

        // Return the URL of the first image
        return { imageUrl: jsonResponse.data[0].url, response: jsonResponse };

      } catch (error: any) {
        console.error('ZhipuAI image generation error:', error);
        const message = error.message || 'Failed to generate image via ZhipuAI';
        throw new TRPCError({
          code: error.code && typeof error.code === 'string' ? error.code as any : 'INTERNAL_SERVER_ERROR',
          message,
          cause: error,
        });
      }
    }),

  /**
   * Video Generation Start (CogVideoX-Flash)
   */
  generateVideoStart: publicProcedure
    .input(videoGenerationStartInputSchema)
    .mutation(async ({ ctx, input }) => {
      const apiKey = getApiKey(ctx, input);
      const { model, prompt, image_url, quality, with_audio, size, fps } = input;

      const ZHIPUAI_API_HOST = 'https://open.bigmodel.cn/api/paas/v4';
      const videoGenerationUrl = `${ZHIPUAI_API_HOST}/videos/generations`;

      const headers: HeadersInit = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };

      const payload: any = { model, prompt };
      if (image_url) payload.image_url = image_url;
      if (quality) payload.quality = quality;
      if (with_audio !== undefined) payload.with_audio = with_audio;
      if (size) payload.size = size;
      if (fps) payload.fps = fps;

      try {
        const response = await fetch(videoGenerationUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
        if (!response.ok) {
          const errorBody = await response.text();
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `ZhipuAI Video Start API request failed: ${response.status} ${response.statusText} - ${errorBody}`,
          });
        }
        const jsonResponse = await response.json();
        // Expects response like: { id: string (task_id), model: string, task_status: string, created_at: number }
        if (!jsonResponse.id || !jsonResponse.task_status) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'ZhipuAI Video Start API response did not contain expected fields.',
            cause: jsonResponse,
          });
        }
        return jsonResponse; // Contains id (task_id) and task_status
      } catch (error: any) {
        console.error('ZhipuAI video generation start error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to start video generation via ZhipuAI',
          cause: error,
        });
      }
    }),

  /**
   * Video Check Status (CogVideoX-Flash)
   */
  checkVideoStatus: publicProcedure
    .input(videoCheckStatusInputSchema)
    .query(async ({ ctx, input }) => { // Using .query as this is a GET request and idempotent
      const apiKey = getApiKey(ctx, input);
      const { task_id } = input;

      const ZHIPUAI_API_HOST = 'https://open.bigmodel.cn/api/paas/v4';
      const videoStatusUrl = `${ZHIPUAI_API_HOST}/async-result/${task_id}`;

      const headers: HeadersInit = {
        'Authorization': `Bearer ${apiKey}`,
      };

      try {
        const response = await fetch(videoStatusUrl, { method: 'GET', headers });
        if (!response.ok) {
          const errorBody = await response.text();
          // Handle 404 specifically if task ID not found or expired, though API might return specific status for that
          if (response.status === 404) {
             throw new TRPCError({ code: 'NOT_FOUND', message: `ZhipuAI Video Task ${task_id} not found or expired.` });
          }
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `ZhipuAI Video Status API request failed: ${response.status} ${response.statusText} - ${errorBody}`,
          });
        }
        const jsonResponse = await response.json();
        // Expects response like: { id: string, model: string, task_status: string, videos?: [{url: string, cover_image_url: string}], error?: {code: string, message: string} }
        return jsonResponse;
      } catch (error: any) {
        console.error('ZhipuAI video status check error:', error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to check video status via ZhipuAI',
          cause: error,
        });
      }
    }),
});
