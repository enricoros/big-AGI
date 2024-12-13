import { z } from 'zod';

import { createTRPCRouter, publicProcedure } from '~/server/trpc/trpc.server';
import { env } from '~/server/env.mjs';
import { fetchJsonOrTRPCThrow, fetchResponseOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';


// configuration
const SAFETY_TEXT_LENGTH = 1000;
const MIN_CHUNK_SIZE = 4096; // Minimum chunk size in bytes


// Schema definitions
export type SpeechInputSchema = z.infer<typeof speechInputSchema>;
export const speechInputSchema = z.object({
  xiKey: z.string().optional(),
  voiceId: z.string().optional(),
  text: z.string(),
  nonEnglish: z.boolean(),
  audioStreaming: z.boolean(),
  audioTurbo: z.boolean(),
});

export type VoiceSchema = z.infer<typeof voiceSchema>;
const voiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  previewUrl: z.string().nullable(),
  category: z.string(),
  default: z.boolean(),
});


export const elevenlabsRouter = createTRPCRouter({

  /**
   * List Voices available to this API key
   */
  listVoices: publicProcedure
    .input(z.object({
      elevenKey: z.string().optional(),
    }))
    .output(z.object({
      voices: z.array(voiceSchema),
    }))
    .query(async ({ input }) => {

      const { elevenKey } = input;
      const { headers, url } = elevenlabsAccess(elevenKey, '/v1/voices');

      const voicesList = await fetchJsonOrTRPCThrow<ElevenlabsWire.VoicesList>({
        url,
        headers,
        name: 'ElevenLabs',
      });

      // bring category != 'premade' to the top
      voicesList.voices.sort((a, b) => {
        if (a.category === 'premade' && b.category !== 'premade') return 1;
        if (a.category !== 'premade' && b.category === 'premade') return -1;
        return 0;
      });

      return {
        voices: voicesList.voices.map((voice, idx) => ({
          id: voice.voice_id,
          name: voice.name,
          description: voice.description,
          previewUrl: voice.preview_url,
          category: voice.category,
          default: idx === 0,
        })),
      };

    }),

  /**
   * Speech synthesis procedure using tRPC streaming
   */
  speech: publicProcedure
    .input(speechInputSchema)
    .mutation(async function* ({ input: { xiKey, text, voiceId, nonEnglish, audioStreaming, audioTurbo }, ctx }) {

      // start streaming back
      yield { control: 'start' };

      // Safety check: trim text that's too long
      if (text.length > SAFETY_TEXT_LENGTH) {
        text = text.slice(0, SAFETY_TEXT_LENGTH);
        yield { warningMessage: 'text was truncated to maximum length' };
      }

      let response: Response;
      try {

        // Prepare the upstream request
        const path = `/v1/text-to-speech/${elevenlabsVoiceId(voiceId)}${audioStreaming ? '/stream' : ''}`;
        const { headers, url } = elevenlabsAccess(xiKey, path);
        const body: ElevenlabsWire.TTSRequest = {
          text: text,
          model_id:
            audioTurbo ? 'eleven_turbo_v2_5'
              : nonEnglish ? 'eleven_multilingual_v2'
                : 'eleven_multilingual_v2', // even for english, use the latest multilingual model
        };

        // Blocking fetch
        response = await fetchResponseOrTRPCThrow({ url, method: 'POST', headers, body, signal: ctx.reqSignal, name: 'ElevenLabs' });

      } catch (error: any) {
        yield { errorMessage: `fetch issue: ${error.message || 'Unknown error'}` };
        return;
      }

      // Parse headers
      const responseHeaders = _safeParseTTSResponseHeaders(response.headers);

      // If not streaming, return the entire audio
      if (!audioStreaming) {
        const audioArrayBuffer = await response.arrayBuffer();
        yield {
          audio: {
            base64: Buffer.from(audioArrayBuffer).toString('base64'),
            contentType: responseHeaders.contentType,
            characterCost: responseHeaders.characterCost,
            ttsLatencyMs: responseHeaders.ttsLatencyMs,
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

      // end streaming (if a control error wasn't thrown)
      yield { control: 'end' };
    }),

});

/**
 * Helper function to construct ElevenLabs API access details
 */
export function elevenlabsAccess(elevenKey: string | undefined, apiPath: string): { headers: HeadersInit; url: string } {
  // API key
  elevenKey = (elevenKey || env.ELEVENLABS_API_KEY || '').trim();
  if (!elevenKey)
    throw new Error('Missing ElevenLabs API key.');

  // API host
  let host = (env.ELEVENLABS_API_HOST || 'api.elevenlabs.io').trim();
  if (!host.startsWith('http'))
    host = `https://${host}`;
  if (host.endsWith('/') && apiPath.startsWith('/'))
    host = host.slice(0, -1);

  return {
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': elevenKey,
    },
    url: host + apiPath,
  };
}

export function elevenlabsVoiceId(voiceId?: string): string {
  return voiceId?.trim() || env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
}


function _safeParseTTSResponseHeaders(headers: Headers): ElevenlabsWire.TTSResponseHeaders {
  return {
    contentType: headers.get('content-type') || 'audio/mpeg',
    characterCost: parseInt(headers.get('character-cost') || '0'),
    currentConcurrentRequests: parseInt(headers.get('current-concurrent-requests') || '0'),
    maximumConcurrentRequests: parseInt(headers.get('maximum-concurrent-requests') || '0'),
    ttsLatencyMs: parseInt(headers.get('tts-latency-ms') || '0'),
  };
}


/// This is the upstream API [rev-eng on 2023-04-12]
export namespace ElevenlabsWire {
  export interface TTSRequest {
    text: string;
    model_id?:
      | 'eleven_monolingual_v1'
      | 'eleven_multilingual_v1'
      | 'eleven_multilingual_v2'
      | 'eleven_turbo_v2'
      | 'eleven_turbo_v2_5';
    voice_settings?: {
      stability: number;
      similarity_boost: number;
    };
  }

  export interface TTSResponseHeaders {
    // Response metadata
    contentType: string;                // Should be 'audio/mpeg'

    // Cost and usage metrics
    characterCost: number;               // Cost in characters for this generation
    currentConcurrentRequests: number;   // Current number of concurrent requests
    maximumConcurrentRequests: number;   // Maximum allowed concurrent requests
    ttsLatencyMs?: number;               // Time taken to generate speech (not in streaming mode)
  }

  export interface VoicesList {
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
    settings: {
      stability: number;
      similarity_boost: number;
    };
  }
}