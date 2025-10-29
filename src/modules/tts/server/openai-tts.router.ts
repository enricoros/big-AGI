import * as z from 'zod/v4';

import { createTRPCRouter, publicProcedure } from '~/server/trpc/trpc.server';
import { env } from '~/server/env';
import { fetchResponseOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';


// Configuration
const SAFETY_TEXT_LENGTH = 4096; // OpenAI limit
const MIN_CHUNK_SIZE = 4096; // Minimum chunk size in bytes for streaming


// Schema definitions
export const openaiTTSSpeechInputSchema = z.object({
  access: z.object({
    oaiKey: z.string().optional(),
    oaiHost: z.string().optional(),
    oaiOrgId: z.string().optional(),
  }),
  text: z.string(),
  voice: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']).default('alloy'),
  model: z.enum(['tts-1', 'tts-1-hd']).default('tts-1'),
  speed: z.number().min(0.25).max(4.0).optional(),
  format: z.enum(['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm']).optional(),
  streaming: z.boolean().default(false),
});

export type OpenAITTSSpeechInputSchema = z.infer<typeof openaiTTSSpeechInputSchema>;


export const openaiTTSRouter = createTRPCRouter({

  /**
   * Speech synthesis procedure using OpenAI TTS API
   */
  speech: publicProcedure
    .input(openaiTTSSpeechInputSchema)
    .mutation(async function* ({ input, ctx }) {

      // Start streaming back
      yield { control: 'start' };

      let text = input.text;

      // Safety check: trim text that's too long
      if (text.length > SAFETY_TEXT_LENGTH) {
        text = text.slice(0, SAFETY_TEXT_LENGTH);
        yield { warningMessage: 'text was truncated to maximum length' };
      }

      let response: Response;
      try {

        // Prepare the upstream request
        const { headers, url } = openaiTTSAccess(input.access);
        const body: OpenAITTSWire.TTSRequest = {
          input: text,
          voice: input.voice,
          model: input.model,
          response_format: input.format || 'mp3',
          ...(input.speed ? { speed: input.speed } : {}),
        };

        // Blocking fetch
        response = await fetchResponseOrTRPCThrow({
          url,
          method: 'POST',
          headers,
          body,
          signal: ctx.reqSignal,
          name: 'OpenAI TTS',
        });

      } catch (error: any) {
        yield { errorMessage: `fetch issue: ${error.message || 'Unknown error'}` };
        return;
      }

      // If not streaming, return the entire audio
      if (!input.streaming) {
        const audioArrayBuffer = await response.arrayBuffer();
        yield {
          audio: {
            base64: Buffer.from(audioArrayBuffer).toString('base64'),
            contentType: response.headers.get('content-type') || 'audio/mpeg',
          },
        };
        yield { control: 'end' };
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        yield { errorMessage: 'stream issue: No reader' };
        return;
      }

      // STREAM the audio chunks back to the client
      try {

        // Initialize a buffer to accumulate chunks
        const accumulatedChunks: Uint8Array[] = [];
        let accumulatedSize = 0;

        // Read loop
        while (true) {
          const { value, done: readerDone } = await reader.read();
          if (readerDone) break;
          if (!value) continue;

          // Accumulate chunks
          accumulatedChunks.push(value);
          accumulatedSize += value.length;

          // When accumulated size reaches or exceeds MIN_CHUNK_SIZE, yield the chunk
          if (accumulatedSize >= MIN_CHUNK_SIZE) {
            yield {
              audioChunk: {
                base64: Buffer.concat(accumulatedChunks).toString('base64'),
              },
            };
            // Reset the accumulation
            accumulatedChunks.length = 0;
            accumulatedSize = 0;
          }
        }

        // If there's any remaining data, yield it as well
        if (accumulatedSize) {
          yield {
            audioChunk: {
              base64: Buffer.concat(accumulatedChunks).toString('base64'),
            },
          };
        }
      } catch (error: any) {
        yield { errorMessage: `stream issue: ${error.message || 'Unknown error'}` };
        return;
      }

      // End streaming
      yield { control: 'end' };
    }),

});


/**
 * Helper function to construct OpenAI TTS API access details
 */
export function openaiTTSAccess(access: OpenAITTSSpeechInputSchema['access']): { headers: HeadersInit; url: string } {
  // API key
  const apiKey = (access.oaiKey || env.OPENAI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('Missing OpenAI API key.');
  }

  // API host
  let host = (access.oaiHost || env.OPENAI_API_HOST || 'api.openai.com').trim();
  if (!host.startsWith('http')) {
    host = `https://${host}`;
  }
  if (host.endsWith('/')) {
    host = host.slice(0, -1);
  }

  // Build headers
  const headers: HeadersInit = {
    'Accept': 'audio/*',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  // Add org ID if provided
  if (access.oaiOrgId) {
    headers['OpenAI-Organization'] = access.oaiOrgId;
  }

  return {
    headers,
    url: `${host}/v1/audio/speech`,
  };
}


/// OpenAI TTS API Wire Types
export namespace OpenAITTSWire {
  export interface TTSRequest {
    input: string;
    voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
    model: 'tts-1' | 'tts-1-hd';
    response_format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
    speed?: number; // 0.25 to 4.0
  }
}
